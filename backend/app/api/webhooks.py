import os
import re
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.models import (
    Customer, CustomerInquiry, Campaign, CampaignRecipient, CampaignActivityLog,
    ConsentAuditLog, Conversation, Message
)
from backend.app.services.automation_service import AutomationService

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])

WEBHOOK_SECRET = os.getenv("GATEWAY_WEBHOOK_SECRET", "local_gateway_secure_token_123")

def verify_gateway_secret(x_gateway_secret: Optional[str] = Header(None)):
    # Strictly enforce gateway secret to prevent unauthorized forged inbound events
    if not x_gateway_secret or x_gateway_secret != WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing gateway webhook secret")
    return True

@router.post("/incoming")
def handle_incoming_message(
    payload: dict = Body(...),
    auth: bool = Depends(verify_gateway_secret),
    db: Session = Depends(get_db)
):
    raw_phone = payload.get("phone") or payload.get("fromPhone") or payload.get("from_phone") or ""
    text = (payload.get("text") or "").strip()
    message_id = payload.get("message_id")
    clean_digits = re.sub(r"\D", "", str(raw_phone))

    if not clean_digits or len(clean_digits) > 15 or clean_digits.startswith("12036"):
        return {"status": "ignored", "reason": "Not an individual customer phone number"}

    # Idempotency check: drop duplicate incoming message payloads
    if message_id:
        existing_inquiry = db.query(CustomerInquiry).filter(CustomerInquiry.message_id == message_id).first()
        if existing_inquiry:
            return {
                "status": "already_processed",
                "inquiry_id": existing_inquiry.id,
                "message": "Duplicate webhook payload ignored"
            }

    # Find customer in database
    customer = db.query(Customer).filter(
        (Customer.phone == clean_digits) |
        (Customer.phone.ilike(f"%{clean_digits[-10:]}"))
    ).first()

    customer_name = customer.full_name if customer else f"WhatsApp User (+{clean_digits})"
    customer_id = customer.id if customer else None

    # Find if this contact was part of any recent campaign
    recent_recipient = db.query(CampaignRecipient).filter(
        (CampaignRecipient.recipient_phone == clean_digits) |
        (CampaignRecipient.recipient_phone.ilike(f"%{clean_digits[-10:]}"))
    ).order_by(desc(CampaignRecipient.created_at)).first()

    campaign_id = recent_recipient.campaign_id if recent_recipient else None

    # Handle numbered quick-reply triggers (Option B: e.g. "1", "2", "1️⃣", "2️⃣")
    import json
    clean_input = text.replace("1️⃣", "1").replace("2️⃣", "2").replace("3️⃣", "3").replace("4️⃣", "4").replace("5️⃣", "5").strip()
    upper_text = clean_input.upper()

    if clean_input.isdigit():
        digit = int(clean_input)
        mapped = False
        if recent_recipient and recent_recipient.campaign and recent_recipient.campaign.buttons_json:
            try:
                camp_btns = json.loads(recent_recipient.campaign.buttons_json)
                quick_btns = [b for b in camp_btns if b.get("type") != "url" and not b.get("url")]
                if 1 <= digit <= len(quick_btns):
                    target_btn = quick_btns[digit - 1]
                    upper_text = (target_btn.get("text") or "").upper()
                    mapped = True
            except Exception:
                pass
        if not mapped:
            if clean_input == "1":
                upper_text = "ENQUIRE"
            elif clean_input == "2":
                upper_text = "STOP"

    auto_reply = None
    action_type = "general_reply"
    now = datetime.utcnow()

    # 1. STOP / UNSUBSCRIBE Keyword
    if any(k in upper_text for k in ["STOP", "UNSUBSCRIBE", "OPT OUT", "OPTOUT", "CANCEL", "BLOCK"]):
        action_type = "stop"
        prev_status = customer.consent_status if customer else "unverified"
        if customer:
            customer.is_suppressed = True
            customer.consent_status = "opted_out"
            customer.notes = (customer.notes or "") + f"\n[Automated] Opted out via WhatsApp reply: '{text}' at {now.strftime('%Y-%m-%d %H:%M')}"
            
            # Log audit trail
            audit_log = ConsentAuditLog(
                customer_id=customer.id,
                phone=clean_digits,
                action="opt_out",
                previous_status=prev_status,
                new_status="opted_out",
                source="WhatsApp Inbound Message",
                reason=f"Customer sent keyword '{text}'",
                created_at=now
            )
            db.add(audit_log)

        if recent_recipient:
            recent_recipient.status = "skipped"
            recent_recipient.notes = (recent_recipient.notes or "") + f" Opted out: {text}"
            campaign = db.query(Campaign).filter(Campaign.id == recent_recipient.campaign_id).first()
            if campaign:
                campaign.opt_out_count = (campaign.opt_out_count or 0) + 1

        auto_reply = "You have been successfully unsubscribed from our updates. Reply START anytime to re-subscribe."

    # 2. START / RE-SUBSCRIBE Keyword
    elif any(k in upper_text for k in ["START", "RESUBSCRIBE", "SUBSCRIBE", "OPT IN"]):
        action_type = "start"
        prev_status = customer.consent_status if customer else "opted_out"
        if customer:
            customer.is_suppressed = False
            customer.consent_status = "verified"
            customer.notes = (customer.notes or "") + f"\n[Automated] Re-subscribed via WhatsApp reply: '{text}' at {now.strftime('%Y-%m-%d %H:%M')}"
            
            # Log audit trail
            audit_log = ConsentAuditLog(
                customer_id=customer.id,
                phone=clean_digits,
                action="opt_in",
                previous_status=prev_status,
                new_status="verified",
                source="WhatsApp Inbound Message",
                reason=f"Customer sent keyword '{text}'",
                created_at=now
            )
            db.add(audit_log)

        auto_reply = "Welcome back! You have successfully opted back in to receive our WhatsApp updates."

    # 3. ENQUIRE / INQUIRE / INTERESTED Keyword
    elif any(k in upper_text for k in ["ENQUIRE", "INQUIRE", "INTERESTED", "PRICE", "DETAILS", "MORE INFO", "INFO", "COST", "CALL ME", "YES"]):
        action_type = "enquire"
        if recent_recipient:
            recent_recipient.replied_at = now
            recent_recipient.reply_text = text
            campaign = db.query(Campaign).filter(Campaign.id == recent_recipient.campaign_id).first()
            if campaign and not recent_recipient.reply_text:
                campaign.replied_count = (campaign.replied_count or 0) + 1

        if customer and customer.lead_stage == "New":
            customer.lead_stage = "Interested"

        auto_reply = "Thank you for reaching out! Our team has received your enquiry and will connect with you shortly."

    # 4. General Message
    else:
        action_type = "general_reply"
        if recent_recipient:
            recent_recipient.replied_at = now
            recent_recipient.reply_text = text

    # Record the inquiry in database
    inquiry = CustomerInquiry(
        customer_id=customer_id,
        phone=clean_digits,
        customer_name=customer_name,
        inquiry_type=action_type,
        message_text=text,
        status="new",
        campaign_id=campaign_id,
        message_id=message_id,
        created_at=now,
        updated_at=now
    )
    db.add(inquiry)

    # Maintain persistent Conversation & Message record
    conversation = db.query(Conversation).filter(Conversation.phone == clean_digits).first()
    if not conversation:
        conversation = Conversation(
            customer_id=customer_id,
            phone=clean_digits,
            customer_name=customer_name,
            status="open",
            last_message_at=now,
            created_at=now,
            updated_at=now
        )
        db.add(conversation)
        db.flush()
    else:
        conversation.last_message_at = now
        conversation.status = "open"
        if customer_id and not conversation.customer_id:
            conversation.customer_id = customer_id

    # Add Message item
    msg_entry = Message(
        conversation_id=conversation.id,
        customer_id=customer_id,
        direction="inbound",
        sender_type="customer",
        body=text,
        provider_message_id=message_id,
        delivery_status="read",
        created_at=now
    )
    db.add(msg_entry)

    # If auto-reply is generated, also record it into conversation thread
    if auto_reply:
        reply_msg = Message(
            conversation_id=conversation.id,
            customer_id=customer_id,
            direction="outbound",
            sender_type="auto_reply",
            body=auto_reply,
            delivery_status="sent",
            created_at=now
        )
        db.add(reply_msg)

    # Trigger automation rules (lead progression, auto-tasks, tags)
    AutomationService.process_inbound_automation(db, customer_id, action_type, text)

    db.commit()

    return {
        "status": "success",
        "action": action_type,
        "customer_id": customer_id,
        "customer_name": customer_name,
        "auto_reply": auto_reply
    }

@router.post("/delivery-status")
def handle_delivery_status(
    payload: dict = Body(...),
    auth: bool = Depends(verify_gateway_secret),
    db: Session = Depends(get_db)
):
    message_id = payload.get("message_id")
    phone = payload.get("phone", "")
    new_status = payload.get("status") # "delivered" or "read"
    clean_digits = re.sub(r"\D", "", phone) if phone else None

    recipient = None
    if message_id:
        recipient = db.query(CampaignRecipient).filter(CampaignRecipient.message_id == message_id).first()
    
    if not recipient and clean_digits:
        recipient = db.query(CampaignRecipient).filter(
            (CampaignRecipient.recipient_phone == clean_digits) |
            (CampaignRecipient.recipient_phone.ilike(f"%{clean_digits[-10:]}"))
        ).order_by(desc(CampaignRecipient.created_at)).first()

    # Also update persistent Message table if matching provider_message_id exists
    if message_id:
        stored_msg = db.query(Message).filter(Message.provider_message_id == message_id).first()
        if stored_msg:
            stored_msg.delivery_status = new_status

    if not recipient:
        db.commit()
        return {"status": "not_found", "message": "No matching campaign recipient found"}

    now = datetime.utcnow()
    # Idempotent state transitions: don't regress if already read
    if new_status == "delivered":
        if not recipient.delivered_at:
            recipient.delivered_at = now
        if recipient.status in ["prepared", "opened", "sent"]:
            recipient.status = "delivered"
    elif new_status == "read":
        if not recipient.read_at:
            recipient.read_at = now
        if not recipient.delivered_at:
            recipient.delivered_at = now
        recipient.status = "read"

    # Refresh campaign aggregated counts reliably from actual records
    campaign = db.query(Campaign).filter(Campaign.id == recipient.campaign_id).first()
    if campaign:
        counts = db.query(CampaignRecipient.status).filter(CampaignRecipient.campaign_id == campaign.id).all()
        status_list = [c[0] for c in counts]
        campaign.delivered_count = status_list.count("delivered") + status_list.count("read")
        campaign.read_count = status_list.count("read")

    db.commit()
    return {"status": "updated", "recipient_id": recipient.id, "delivery_status": recipient.status}
