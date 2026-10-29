import json
import re
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from backend.app.models.models import (
    Customer, Category, Campaign, CampaignRecipient, CampaignActivityLog,
    Conversation, Message
)
from backend.app.services.phone_service import build_click_to_chat_url
from backend.app.services.template_service import render_template
from backend.app.schemas.schemas import CampaignCreate

def format_buttons_footer(body: str, buttons_json: Optional[str]) -> str:
    """
    Formats buttons into clean numbered quick-reply triggers (Option B).
    e.g.:
    ──────────────────
    Reply with a number:
    1️⃣ *ENQUIRE*
    2️⃣ *STOP*

    🔗 *Shop now*: https://...
    """
    if not buttons_json:
        return body
    try:
        btns = json.loads(buttons_json) if isinstance(buttons_json, str) else buttons_json
        if not btns or not isinstance(btns, list):
            return body

        quick_replies = []
        url_links = []
        number_emojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣"]

        for b in btns:
            b_text = (b.get("text") or "").strip()
            b_type = b.get("type", "quick_reply")
            b_url = (b.get("url") or "").strip()

            if (b_type == "url" or b.get("action") == "url") and b_url:
                url_links.append(f"🔗 *{b_text}*: {b_url}")
            elif b_text:
                quick_replies.append(b_text)

        blocks = []
        if quick_replies:
            reply_lines = [
                f"{number_emojis[i] if i < len(number_emojis) else f'{i+1}.'} *{text}*"
                for i, text in enumerate(quick_replies)
            ]
            blocks.append("Reply with a number:\n" + "\n".join(reply_lines))

        if url_links:
            blocks.append("\n".join(url_links))

        if blocks:
            full_footer = "\n\n──────────────────\n" + "\n\n".join(blocks)
            if "──────────────────" not in body:
                return f"{body.strip()}{full_footer}"
    except Exception:
        pass
    return body

def select_campaign_recipients(
    db: Session,
    criteria: CampaignCreate
) -> Tuple[List[Customer], List[Dict[str, Any]]]:
    """
    Selects eligible customers and tracks excluded contacts with reasons.
    Enforces opt-out suppression and optional verified-consent enforcement.
    """
    query = db.query(Customer)

    # Filter by specific customer IDs or Categories
    if criteria.customer_ids and len(criteria.customer_ids) > 0:
        query = query.filter(Customer.id.in_(criteria.customer_ids))
    elif criteria.category_ids and len(criteria.category_ids) > 0:
        query = query.filter(Customer.category_id.in_(criteria.category_ids))

    all_matching = query.all()

    eligible: List[Customer] = []
    excluded: List[Dict[str, Any]] = []
    seen_phones = set()

    for cust in all_matching:
        # Mandatory Exclusion 1: Suppression / Opt-out (Non-bypassable backend safeguard)
        if cust.is_suppressed or cust.consent_status == "opted_out":
            excluded.append({
                "id": cust.id,
                "name": cust.full_name,
                "phone": cust.phone,
                "reason": "Customer is on the opt-out / suppression list (mandatory safeguard)"
            })
            continue

        # Exclusion 2: Verified consent required
        if criteria.only_verified_consent and cust.consent_status != "verified":
            excluded.append({
                "id": cust.id,
                "name": cust.full_name,
                "phone": cust.phone,
                "reason": f"Consent status is '{cust.consent_status}' (verified consent required)"
            })
            continue

        # Exclusion 3: Duplicate phone in selection
        if cust.phone in seen_phones:
            excluded.append({
                "id": cust.id,
                "name": cust.full_name,
                "phone": cust.phone,
                "reason": "Duplicate phone number in recipient list"
            })
            continue

        seen_phones.add(cust.phone)
        eligible.append(cust)

    return eligible, excluded

def create_campaign_with_recipients(
    db: Session,
    campaign_data: CampaignCreate
) -> Tuple[Campaign, List[Dict[str, Any]]]:
    if campaign_data.is_test_mode and campaign_data.test_phone_number:
        # Test Sandbox Mode: Create a single test recipient
        raw_test_phone = campaign_data.test_phone_number.strip()
        from backend.app.services.phone_service import normalize_phone
        norm_res = normalize_phone(raw_test_phone)
        clean_phone = norm_res.get("normalized") or re.sub(r"\D", "", raw_test_phone)
        formatted_phone = norm_res.get("formatted") or f"+{clean_phone}"

        new_campaign = Campaign(
            name=f"[TEST] {campaign_data.name}",
            description=campaign_data.description or "Sandbox Test Campaign",
            notes="Dispatched in Sandbox Test Mode",
            template_id=campaign_data.template_id,
            message_body_snapshot=campaign_data.message_body,
            header_media_url=campaign_data.header_media_url,
            buttons_json=campaign_data.buttons_json,
            is_test_mode=True,
            status="in_progress",
            total_recipients=1,
            opened_count=0,
            sent_count=0,
            delivered_count=0,
            read_count=0,
            replied_count=0,
            opt_out_count=0,
            skipped_count=0,
            failed_count=0
        )
        db.add(new_campaign)
        db.flush()

        context = {
            "name": "Test Recipient",
            "company": "Your Company",
            "category": "Test Sandbox",
            "phone": formatted_phone
        }
        rendered_msg, _ = render_template(campaign_data.message_body, context)
        final_msg = format_buttons_footer(rendered_msg, campaign_data.buttons_json)
        click_url = build_click_to_chat_url(clean_phone, final_msg)

        test_recipient = CampaignRecipient(
            campaign_id=new_campaign.id,
            customer_id=None,
            recipient_name="Test Recipient",
            recipient_phone=clean_phone,
            recipient_company="Test Sandbox",
            recipient_category="Test",
            personalized_message=final_msg,
            click_to_chat_url=click_url,
            media_url=campaign_data.header_media_url,
            status="prepared"
        )
        db.add(test_recipient)

        log = CampaignActivityLog(
            campaign_id=new_campaign.id,
            action="created",
            details=f"Test sandbox campaign prepared for test phone {formatted_phone}."
        )
        db.add(log)
        db.commit()
        db.refresh(new_campaign)
        return new_campaign, []

    eligible_customers, excluded_customers = select_campaign_recipients(db, campaign_data)

    if not eligible_customers:
        raise ValueError("No eligible recipients found matching the specified criteria.")

    # Create Campaign Record
    new_campaign = Campaign(
        name=campaign_data.name,
        description=campaign_data.description,
        notes=campaign_data.notes,
        template_id=campaign_data.template_id,
        message_body_snapshot=campaign_data.message_body,
        header_media_url=campaign_data.header_media_url,
        buttons_json=campaign_data.buttons_json,
        is_test_mode=False,
        status="in_progress",
        total_recipients=len(eligible_customers),
        opened_count=0,
        sent_count=0,
        delivered_count=0,
        read_count=0,
        replied_count=0,
        opt_out_count=0,
        skipped_count=0,
        failed_count=0
    )
    db.add(new_campaign)
    db.flush()

    # Pre-render message and click-to-chat URL for each recipient
    for cust in eligible_customers:
        category_name = cust.category.name if cust.category else ""
        context = {
            "name": cust.full_name,
            "company": cust.company or "",
            "category": category_name,
            "phone": cust.formatted_phone
        }

        rendered_msg, missing_vars = render_template(campaign_data.message_body, context)
        final_msg = format_buttons_footer(rendered_msg, campaign_data.buttons_json)
        click_url = build_click_to_chat_url(cust.phone, final_msg)

        recipient_entry = CampaignRecipient(
            campaign_id=new_campaign.id,
            customer_id=cust.id,
            recipient_name=cust.full_name,
            recipient_phone=cust.phone,
            recipient_company=cust.company,
            recipient_category=category_name,
            personalized_message=final_msg,
            click_to_chat_url=click_url,
            media_url=campaign_data.header_media_url,
            status="prepared"
        )
        db.add(recipient_entry)

    # Activity log
    log = CampaignActivityLog(
        campaign_id=new_campaign.id,
        action="created",
        details=f"Campaign prepared with {len(eligible_customers)} recipients. {len(excluded_customers)} excluded."
    )
    db.add(log)

    db.commit()
    db.refresh(new_campaign)
    return new_campaign, excluded_customers

def update_recipient_queue_status(
    db: Session,
    campaign_id: int,
    recipient_id: int,
    new_status: str,
    notes: str = None,
    error_message: str = None,
    message_id: str = None
) -> CampaignRecipient:
    recipient = db.query(CampaignRecipient).filter(
        CampaignRecipient.id == recipient_id,
        CampaignRecipient.campaign_id == campaign_id
    ).first()

    if not recipient:
        raise ValueError("Campaign recipient record not found")

    old_status = recipient.status
    if old_status == new_status:
        # Idempotent re-submission: update metadata without corrupting state
        if notes:
            recipient.notes = notes
        if error_message:
            recipient.error_message = error_message
        if message_id and not recipient.message_id:
            recipient.message_id = message_id
        db.commit()
        db.refresh(recipient)
        return recipient

    # Valid state transitions
    valid_transitions = {
        "prepared": {"opened", "sent", "skipped", "failed"},
        "opened": {"sent", "skipped", "failed"},
        "sent": {"delivered", "read", "failed"},
        "delivered": {"read"},
        "read": set(), # terminal delivery state
        "skipped": set(), # terminal user decision
        "failed": {"prepared", "opened", "sent"} # allow retry
    }

    allowed = valid_transitions.get(old_status, set())
    if new_status not in allowed and old_status not in ["prepared", "opened", "failed"]:
        # If jumping to delivered/read from opened, allow progression
        if new_status in ["delivered", "read"] and old_status in ["prepared", "opened"]:
            pass
        else:
            raise ValueError(f"Invalid state transition from '{old_status}' to '{new_status}'")

    recipient.status = new_status
    if notes:
        recipient.notes = notes
    if error_message:
        recipient.error_message = error_message
    if message_id:
        recipient.message_id = message_id

    now = datetime.now(timezone.utc)
    if new_status == "opened":
        recipient.opened_at = now
    elif new_status == "sent":
        recipient.confirmed_sent_at = now
        # Also ensure unified Conversation and Message exist for this recipient in CRM Inbox
        clean_recipient_phone = re.sub(r"\D", "", recipient.recipient_phone or "")
        if clean_recipient_phone:
            conv = db.query(Conversation).filter(
                (Conversation.phone == clean_recipient_phone) |
                (Conversation.phone.ilike(f"%{clean_recipient_phone[-10:]}"))
            ).first()
            if not conv:
                conv = Conversation(
                    customer_id=recipient.customer_id,
                    phone=clean_recipient_phone,
                    customer_name=recipient.recipient_name or f"WhatsApp User (+{clean_recipient_phone[-10:]})",
                    status="waiting_reply",
                    last_message_at=now,
                    created_at=now,
                    updated_at=now
                )
                db.add(conv)
                db.flush()
            else:
                conv.last_message_at = now
                conv.status = "waiting_reply"
                if recipient.customer_id and not conv.customer_id:
                    conv.customer_id = recipient.customer_id
                if recipient.recipient_name and not conv.customer_name:
                    conv.customer_name = recipient.recipient_name
                conv.updated_at = now

            existing_msg = db.query(Message).filter(
                Message.conversation_id == conv.id,
                Message.provider_message_id == message_id
            ).first() if message_id else None

            if not existing_msg:
                outbound_msg = Message(
                    conversation_id=conv.id,
                    customer_id=recipient.customer_id,
                    direction="outbound",
                    sender_type="campaign",
                    body=recipient.personalized_message or "Campaign message sent",
                    media_url=recipient.media_url,
                    provider_message_id=message_id,
                    delivery_status="sent",
                    created_at=now
                )
                db.add(outbound_msg)
    elif new_status == "delivered":
        recipient.delivered_at = now
        if not recipient.confirmed_sent_at:
            recipient.confirmed_sent_at = now
    elif new_status == "read":
        recipient.read_at = now
        if not recipient.delivered_at:
            recipient.delivered_at = now
        if not recipient.confirmed_sent_at:
            recipient.confirmed_sent_at = now
    elif new_status == "skipped":
        recipient.skipped_at = now
    elif new_status == "failed":
        pass

    db.flush()

    # Update Campaign counts
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign:
        counts = db.query(CampaignRecipient.status).filter(
            CampaignRecipient.campaign_id == campaign_id
        ).all()
        status_list = [c[0] for c in counts]
        
        campaign.opened_count = status_list.count("opened") + status_list.count("sent") + status_list.count("delivered") + status_list.count("read")
        campaign.sent_count = status_list.count("sent") + status_list.count("delivered") + status_list.count("read")
        campaign.delivered_count = status_list.count("delivered") + status_list.count("read")
        campaign.read_count = status_list.count("read")
        campaign.skipped_count = status_list.count("skipped")
        campaign.failed_count = status_list.count("failed")

        # Check if all recipients have finalized status (sent, delivered, read, skipped, or failed)
        remaining = [s for s in status_list if s in ["prepared", "opened"]]
        if not remaining and len(status_list) > 0:
            campaign.status = "completed"

    # Activity log
    log = CampaignActivityLog(
        campaign_id=campaign_id,
        recipient_id=recipient_id,
        action=f"recipient_{new_status}",
        details=f"Recipient {recipient.recipient_name} ({recipient.recipient_phone}) marked as {new_status}"
    )
    db.add(log)

    db.commit()
    db.refresh(recipient)
    return recipient
