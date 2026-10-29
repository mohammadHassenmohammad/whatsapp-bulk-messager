from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, Body
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.services.ai_service import AIService
from backend.app.services.automation_service import AutomationService

router = APIRouter(prefix="/ai", tags=["AI & Automation"])

class DraftTemplateRequest(BaseModel):
    topic: str
    tone: Optional[str] = "professional"
    include_customer_name: Optional[bool] = True

class ClassifyRequest(BaseModel):
    message_text: str

class SuggestRepliesRequest(BaseModel):
    last_message: str
    customer_name: Optional[str] = ""

class SummarizeRequest(BaseModel):
    messages: List[Dict[str, Any]]

class InactivityRequest(BaseModel):
    days_inactive: Optional[int] = 30

@router.get("/status")
async def get_ai_status():
    """Get status of the deterministic rule-based automation engine."""
    return await AIService.get_status()

@router.post("/draft-template")
async def draft_template(payload: DraftTemplateRequest):
    """Generate a compliant WhatsApp message template using deterministic copywriting rules."""
    return await AIService.draft_template(
        topic=payload.topic,
        tone=payload.tone or "professional",
        customer_name_var=payload.include_customer_name if payload.include_customer_name is not None else True
    )

@router.post("/classify-reply")
async def classify_reply(payload: ClassifyRequest):
    """Classify message intent into: enquiry, interested, complaint, not_interested, opt_out, general."""
    return await AIService.classify_reply(payload.message_text)

@router.post("/suggest-replies")
async def suggest_replies(payload: SuggestRepliesRequest):
    """Suggest 3 quick response snippets tailored to the incoming message."""
    return await AIService.suggest_replies(
        last_message=payload.last_message,
        customer_name=payload.customer_name or ""
    )

@router.post("/summarize-thread")
async def summarize_thread(payload: SummarizeRequest):
    """Summarize conversation history into actionable takeaways."""
    return await AIService.summarize_thread(payload.messages)

@router.post("/run-inactivity-check")
def run_inactivity_check(payload: InactivityRequest, db: Session = Depends(get_db)):
    """Auto-mark leads as Lost if they have been inactive for specified days."""
    days = payload.days_inactive or 30
    count = AutomationService.run_inactivity_check(db, days)
    return {
        "success": True,
        "days_inactive": days,
        "contacts_updated": count,
        "message": f"Updated {count} inactive contact(s) to 'Lost'."
    }
