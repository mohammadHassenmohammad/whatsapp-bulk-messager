from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import desc, asc

from backend.app.database import get_db
from backend.app.models.models import (
    Customer, Conversation, Message, FollowUpTask, ConsentAuditLog,
    CampaignRecipient, CampaignActivityLog, CustomerInquiry
)
from backend.app.schemas.schemas import (
    FollowUpTaskCreate, FollowUpTaskUpdate, FollowUpTaskResponse,
    ConversationResponse, MessageResponse, MessageCreate
)
from backend.app.providers.manager import ProviderManager
from backend.app.providers.base import MessagePayload

router = APIRouter(prefix="/crm", tags=["CRM"])

# ----------------- Follow-Up Tasks -----------------

@router.get("/tasks", response_model=List[FollowUpTaskResponse])
def get_tasks(
    status: Optional[str] = None, # "pending", "completed", "cancelled"
    priority: Optional[str] = None,
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(FollowUpTask)
    if status and status != "all":
        query = query.filter(FollowUpTask.status == status)
    if priority and priority != "all":
        query = query.filter(FollowUpTask.priority == priority)
    if customer_id:
        query = query.filter(FollowUpTask.customer_id == customer_id)

    tasks = query.order_by(asc(FollowUpTask.due_date)).all()
    res = []
    for t in tasks:
        cust = t.customer
        res.append(
            FollowUpTaskResponse(
                id=t.id,
                customer_id=t.customer_id,
                customer_name=cust.full_name if cust else "Unknown Contact",
                customer_phone=cust.formatted_phone if cust else "",
                title=t.title,
                description=t.description,
                due_date=t.due_date,
                priority=t.priority,
                status=t.status,
                completed_at=t.completed_at,
                created_at=t.created_at,
                updated_at=t.updated_at
            )
        )
    return res

@router.post("/tasks", response_model=FollowUpTaskResponse)
def create_task(payload: FollowUpTaskCreate, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    new_task = FollowUpTask(
        customer_id=payload.customer_id,
        title=payload.title.strip(),
        description=payload.description.strip() if payload.description else None,
        due_date=payload.due_date,
        priority=payload.priority or "medium",
        status="pending"
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)

    return FollowUpTaskResponse(
        id=new_task.id,
        customer_id=new_task.customer_id,
        customer_name=cust.full_name,
        customer_phone=cust.formatted_phone,
        title=new_task.title,
        description=new_task.description,
        due_date=new_task.due_date,
        priority=new_task.priority,
        status=new_task.status,
        completed_at=new_task.completed_at,
        created_at=new_task.created_at,
        updated_at=new_task.updated_at
    )

@router.put("/tasks/{task_id}", response_model=FollowUpTaskResponse)
def update_task(task_id: int, payload: FollowUpTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(FollowUpTask).filter(FollowUpTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    if payload.title is not None:
        task.title = payload.title.strip()
    if payload.description is not None:
        task.description = payload.description.strip()
    if payload.due_date is not None:
        task.due_date = payload.due_date
    if payload.priority is not None:
        task.priority = payload.priority
    if payload.status is not None:
        task.status = payload.status
        if payload.status == "completed":
            task.completed_at = datetime.utcnow()
        elif payload.status == "pending":
            task.completed_at = None

    db.commit()
    db.refresh(task)

    cust = task.customer
    return FollowUpTaskResponse(
        id=task.id,
        customer_id=task.customer_id,
        customer_name=cust.full_name if cust else "",
        customer_phone=cust.formatted_phone if cust else "",
        title=task.title,
        description=task.description,
        due_date=task.due_date,
        priority=task.priority,
        status=task.status,
        completed_at=task.completed_at,
        created_at=task.created_at,
        updated_at=task.updated_at
    )

@router.delete("/tasks/{task_id}")
def delete_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(FollowUpTask).filter(FollowUpTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"success": True, "message": "Task deleted"}

# ----------------- Unified 2-Way Conversations & Messaging -----------------

@router.get("/conversations", response_model=List[ConversationResponse])
def get_conversations(
    status: Optional[str] = None, # "open", "waiting_reply", "closed"
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Conversation)
    if status and status != "all":
        query = query.filter(Conversation.status == status)
    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            (Conversation.customer_name.ilike(search_fmt)) |
            (Conversation.phone.ilike(search_fmt))
        )

    conversations = query.order_by(desc(Conversation.last_message_at)).all()
    return conversations

@router.get("/conversations/{conversation_id}", response_model=ConversationResponse)
def get_conversation_detail(conversation_id: int, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv

@router.post("/conversations/{conversation_id}/reply", response_model=MessageResponse)
async def send_conversation_reply(
    conversation_id: int,
    payload: MessageCreate,
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Check recipient suppression
    if conv.customer_id:
        cust = db.query(Customer).filter(Customer.id == conv.customer_id).first()
        if cust and (cust.is_suppressed or cust.consent_status == "opted_out"):
            raise HTTPException(
                status_code=400,
                detail="Cannot send to this contact: Contact has opted out or is suppressed."
            )

    # Dispatch through active provider
    provider = ProviderManager.get_provider(db)
    msg_payload = MessagePayload(
        phone=conv.phone,
        text=payload.body.strip(),
        media_url=payload.media_url
    )

    send_res = await provider.send_message(msg_payload)
    now = datetime.utcnow()

    # Record message in conversation thread
    new_message = Message(
        conversation_id=conv.id,
        customer_id=conv.customer_id,
        direction="outbound",
        sender_type="user",
        body=payload.body.strip(),
        media_url=payload.media_url,
        provider_message_id=send_res.message_id,
        delivery_status="sent" if send_res.success else "failed",
        error_message=send_res.error,
        created_at=now
    )
    db.add(new_message)

    conv.last_message_at = now
    conv.status = "waiting_reply"
    conv.updated_at = now

    # Update customer lead stage if currently New
    if conv.customer_id:
        cust = db.query(Customer).filter(Customer.id == conv.customer_id).first()
        if cust and cust.lead_stage == "New":
            cust.lead_stage = "Contacted"

    db.commit()
    db.refresh(new_message)

    if not send_res.success:
        raise HTTPException(
            status_code=502,
            detail=f"Message recorded but provider dispatch failed: {send_res.error}"
        )

    return new_message

@router.put("/conversations/{conversation_id}/status")
def update_conversation_status(
    conversation_id: int,
    status: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if status not in ["open", "waiting_reply", "closed"]:
        raise HTTPException(status_code=400, detail="Invalid status. Choose open, waiting_reply, or closed.")

    conv.status = status
    conv.updated_at = datetime.utcnow()
    db.commit()
    return {"success": True, "status": status}

# ----------------- Customer Lead Stage & Interaction Timeline -----------------

@router.put("/customers/{customer_id}/lead-stage")
def update_customer_lead_stage(
    customer_id: int,
    stage: str = Body(..., embed=True),
    db: Session = Depends(get_db)
):
    valid_stages = ["New", "Contacted", "Interested", "Converted", "Lost"]
    if stage not in valid_stages:
        raise HTTPException(status_code=400, detail=f"Invalid lead stage. Choose from: {', '.join(valid_stages)}")

    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    old_stage = cust.lead_stage
    cust.lead_stage = stage
    cust.updated_at = datetime.utcnow()
    db.commit()

    return {"success": True, "customer_id": customer_id, "previous_stage": old_stage, "lead_stage": stage}

@router.get("/customers/{customer_id}/timeline")
def get_customer_timeline(customer_id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == customer_id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    events = []

    # 1. Contact Creation
    events.append({
        "type": "creation",
        "title": "Contact Created",
        "description": f"Customer profile created with consent status '{cust.consent_status}'",
        "timestamp": cust.created_at.isoformat() if cust.created_at else None,
        "badge_color": "emerald"
    })

    # 2. Consent Audit Logs
    for log in cust.consent_logs:
        events.append({
            "type": "consent",
            "title": f"Consent {log.action.replace('_', ' ').title()}",
            "description": f"{log.reason or ''} (Status: {log.previous_status} -> {log.new_status})",
            "source": log.source,
            "timestamp": log.created_at.isoformat() if log.created_at else None,
            "badge_color": "red" if "opt_out" in log.action or "revoked" in log.action else "emerald"
        })

    # 3. Campaign Broadcasts
    recipients = db.query(CampaignRecipient).filter(CampaignRecipient.customer_id == customer_id).all()
    for r in recipients:
        campaign_name = r.campaign.name if r.campaign else "Broadcast"
        events.append({
            "type": "campaign",
            "title": f"Campaign: {campaign_name}",
            "description": f"Status: {r.status}. Message: {r.personalized_message[:80]}...",
            "timestamp": (r.confirmed_sent_at or r.opened_at or r.created_at).isoformat(),
            "badge_color": "indigo"
        })

    # 4. Inbound Inquiries
    inquiries = db.query(CustomerInquiry).filter(CustomerInquiry.customer_id == customer_id).all()
    for inq in inquiries:
        events.append({
            "type": "inquiry",
            "title": f"Customer Inbound: {inq.inquiry_type.upper()}",
            "description": inq.message_text,
            "timestamp": inq.created_at.isoformat() if inq.created_at else None,
            "badge_color": "purple"
        })

    # 5. Follow-Up Tasks
    for t in cust.tasks:
        events.append({
            "type": "task",
            "title": f"Task: {t.title}",
            "description": f"Priority: {t.priority.upper()} | Status: {t.status.upper()} (Due: {t.due_date.strftime('%Y-%m-%d')})",
            "timestamp": (t.completed_at or t.created_at).isoformat() if t.created_at else None,
            "badge_color": "amber"
        })

    # Sort descending by timestamp
    events.sort(key=lambda e: e.get("timestamp") or "", reverse=True)

    return {
        "customer": {
            "id": cust.id,
            "name": cust.full_name,
            "phone": cust.formatted_phone,
            "lead_stage": cust.lead_stage,
            "category": cust.category.name if cust.category else "Uncategorized"
        },
        "timeline": events
    }
