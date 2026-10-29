import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.models.models import (
    Base, Customer, Conversation, Message, FollowUpTask, ConsentAuditLog,
    Campaign, CampaignRecipient, CustomerInquiry
)
from backend.app.services.ai_service import AIService
from backend.app.services.automation_service import AutomationService

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_follow_up_tasks_crud(db_session):
    """Verify task creation, completion, and ordering."""
    cust = Customer(
        phone="15551234567",
        formatted_phone="+1 555-123-4567",
        full_name="Alice Smith",
        consent_status="verified",
        lead_stage="New"
    )
    db_session.add(cust)
    db_session.commit()

    task = FollowUpTask(
        customer_id=cust.id,
        title="Send product catalog",
        description="Customer asked for wholesale pricing",
        due_date=datetime.utcnow() + timedelta(days=2),
        priority="high",
        status="pending"
    )
    db_session.add(task)
    db_session.commit()
    db_session.refresh(task)

    assert task.id is not None
    assert task.status == "pending"
    assert task.priority == "high"

    # Mark completed
    task.status = "completed"
    task.completed_at = datetime.utcnow()
    db_session.commit()

    updated = db_session.query(FollowUpTask).filter(FollowUpTask.id == task.id).first()
    assert updated.status == "completed"
    assert updated.completed_at is not None

def test_conversation_and_messages(db_session):
    """Verify 2-way conversation persistence and message tracking."""
    cust = Customer(
        phone="15559876543",
        formatted_phone="+1 555-987-6543",
        full_name="Bob Jones",
        consent_status="verified"
    )
    db_session.add(cust)
    db_session.commit()

    conv = Conversation(
        customer_id=cust.id,
        phone=cust.phone,
        customer_name=cust.full_name,
        status="open",
        last_message_at=datetime.utcnow()
    )
    db_session.add(conv)
    db_session.commit()

    # Inbound message
    inbound_msg = Message(
        conversation_id=conv.id,
        customer_id=cust.id,
        direction="inbound",
        sender_type="customer",
        body="Hi, what are your delivery terms?",
        delivery_status="read"
    )
    db_session.add(inbound_msg)

    # Outbound reply
    outbound_msg = Message(
        conversation_id=conv.id,
        customer_id=cust.id,
        direction="outbound",
        sender_type="user",
        body="We deliver within 24 hours nationwide!",
        delivery_status="sent"
    )
    db_session.add(outbound_msg)
    db_session.commit()

    loaded_conv = db_session.query(Conversation).filter(Conversation.id == conv.id).first()
    assert len(loaded_conv.messages) == 2
    assert loaded_conv.messages[0].direction == "inbound"
    assert loaded_conv.messages[1].direction == "outbound"

    loaded_conv = db_session.query(Conversation).filter(Conversation.id == conv.id).first()
    assert len(loaded_conv.messages) == 2
    assert loaded_conv.messages[0].direction == "inbound"
    assert loaded_conv.messages[1].direction == "outbound"

def test_customer_lead_stage_and_timeline(db_session):
    """Verify lead stage transitions and chronological timeline generation."""
    cust = Customer(
        phone="15558889999",
        formatted_phone="+1 555-888-9999",
        full_name="Carol White",
        consent_status="verified",
        lead_stage="New"
    )
    db_session.add(cust)
    db_session.commit()

    # Add audit log
    audit = ConsentAuditLog(
        customer_id=cust.id,
        phone=cust.phone,
        action="opt_in",
        previous_status="unverified",
        new_status="verified",
        source="Web Form"
    )
    db_session.add(audit)

    # Add inquiry
    inquiry = CustomerInquiry(
        customer_id=cust.id,
        phone=cust.phone,
        customer_name=cust.full_name,
        inquiry_type="enquire",
        message_text="Interested in VIP tier",
        status="new"
    )
    db_session.add(inquiry)

    # Add Task
    task = FollowUpTask(
        customer_id=cust.id,
        title="Call Carol",
        due_date=datetime.utcnow() + timedelta(days=1),
        priority="urgent",
        status="pending"
    )
    db_session.add(task)
    db_session.commit()

    # Verify timeline elements can be queried
    cust_refreshed = db_session.query(Customer).filter(Customer.id == cust.id).first()
    assert len(cust_refreshed.consent_logs) == 1
    assert len(cust_refreshed.inquiries) == 1
    assert len(cust_refreshed.tasks) == 1

def test_ai_service_heuristics():
    """Verify AI service provides compliant draft generation and classification even without Ollama."""
    import asyncio

    # Template draft
    draft_res = asyncio.run(AIService.draft_template("Summer Sale 20% discount", "friendly"))
    assert "template_text" in draft_res
    # Privacy rule: All drafts must have opt-out notice
    assert "STOP" in draft_res["template_text"]

    # Classifications
    res_optout = asyncio.run(AIService.classify_reply("Please STOP sending me messages"))
    assert res_optout["intent"] == "opt_out"

    res_enquiry = asyncio.run(AIService.classify_reply("How much does this plan cost?"))
    assert res_enquiry["intent"] == "enquiry"

    res_complaint = asyncio.run(AIService.classify_reply("The package was broken and delayed"))
    assert res_complaint["intent"] == "complaint"

    # Reply suggestions
    suggestions = asyncio.run(AIService.suggest_replies("Can you send me your pricing brochure?", "David"))
    assert len(suggestions["suggestions"]) >= 2
    assert any("David" in s for s in suggestions["suggestions"])


def test_automation_service_inbound_trigger(db_session):
    """Verify that an inbound enquiry automatically upgrades lead stage and generates a follow-up task."""
    cust = Customer(
        phone="15557776666",
        formatted_phone="+1 555-777-6666",
        full_name="Eve Adams",
        consent_status="verified",
        lead_stage="New"
    )
    db_session.add(cust)
    db_session.commit()

    # Trigger automation on enquiry
    task = AutomationService.process_inbound_automation(
        db=db_session,
        customer_id=cust.id,
        inquiry_type="enquire",
        message_text="I am ready to purchase the annual license"
    )
    db_session.commit()

    assert task is not None
    assert task.priority == "high"
    assert cust.lead_stage == "Interested"

    # Verify auto-tagging
    assert any(tag.name == "Warm Lead" for tag in cust.tag_items)
    assert "Warm Lead" in cust.tags
