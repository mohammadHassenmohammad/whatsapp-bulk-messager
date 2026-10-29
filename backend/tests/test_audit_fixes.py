import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from backend.app.database import Base, get_db
from backend.app.main import app
from backend.app.models.models import (
    Customer, Category, MessageTemplate, Campaign, CampaignRecipient,
    Conversation, Message, FollowUpTask, ConsentAuditLog, Tag, AppSetting
)
from backend.app.services.backup_service import export_all_data, restore_all_data
from backend.app.services.import_service import process_import
from backend.app.services.ai_service import DeterministicRulesService
from backend.app.schemas.schemas import ColumnMapping

@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    # Enable foreign keys
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

@pytest.fixture
def test_client(test_db):
    def override_get_db():
        try:
            yield test_db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)
    yield client
    app.dependency_overrides.clear()

def test_backup_restore_full_crm_persistence(test_db):
    """Verify AUD-01: Conversations, messages, tasks, and consent logs are exported and restored."""
    cust = Customer(
        full_name="Sarah Connor",
        phone="15550001111",
        formatted_phone="+1 555-000-1111",
        consent_status="verified",
        lead_stage="Interested"
    )
    test_db.add(cust)
    test_db.commit()

    task = FollowUpTask(
        customer_id=cust.id,
        title="Send Quotation",
        description="Priority quote requested",
        due_date=datetime.now(timezone.utc) + timedelta(days=1),
        priority="high"
    )
    test_db.add(task)

    conv = Conversation(
        customer_id=cust.id,
        phone=cust.phone,
        customer_name=cust.full_name,
        status="open"
    )
    test_db.add(conv)
    test_db.commit()

    msg = Message(
        conversation_id=conv.id,
        customer_id=cust.id,
        direction="inbound",
        body="Can I get pricing for 100 units?"
    )
    test_db.add(msg)

    audit = ConsentAuditLog(
        customer_id=cust.id,
        phone=cust.phone,
        action="opt_in",
        previous_status="unverified",
        new_status="verified",
        source="Test Script"
    )
    test_db.add(audit)
    test_db.commit()

    # Export
    backup_data = export_all_data(test_db)
    assert "conversations" in backup_data
    assert len(backup_data["conversations"]) == 1
    assert "tasks" in backup_data
    assert len(backup_data["tasks"]) == 1
    assert "consent_logs" in backup_data
    assert len(backup_data["consent_logs"]) == 1

    # Restore
    res = restore_all_data(test_db, backup_data)
    assert res["success"] is True

    restored_convs = test_db.query(Conversation).all()
    assert len(restored_convs) == 1
    assert len(restored_convs[0].messages) == 1
    assert restored_convs[0].messages[0].body == "Can I get pricing for 100 units?"

    restored_tasks = test_db.query(FollowUpTask).all()
    assert len(restored_tasks) == 1
    assert restored_tasks[0].title == "Send Quotation"

def test_import_opt_out_safeguard(test_db):
    """Verify AUD-02: CSV update never silently overrides an existing opt-out."""
    cust = Customer(
        full_name="Opted Out Contact",
        phone="15552223333",
        formatted_phone="+1 555-222-3333",
        consent_status="opted_out",
        is_suppressed=True
    )
    test_db.add(cust)
    test_db.commit()

    # Prepare DataFrame simulation
    import pandas as pd
    import os
    from backend.app.services.import_service import UPLOAD_DIR
    
    test_csv_name = "test_optout_guard.csv"
    test_path = os.path.join(UPLOAD_DIR, test_csv_name)
    df = pd.DataFrame([
        {"Name": "Opted Out Contact Updated", "Phone": "15552223333", "Consent": "unverified"}
    ])
    df.to_csv(test_path, index=False)

    mappings = ColumnMapping(phone_col="Phone", name_col="Name", consent_status_col="Consent")
    result = process_import(
        db=test_db,
        unique_filename=test_csv_name,
        mappings=mappings,
        on_duplicate="update",
        default_consent_status="unverified"
    )

    if os.path.exists(test_path):
        os.remove(test_path)

    test_db.refresh(cust)
    # The name may update, but consent_status must remain opted_out and suppressed!
    assert cust.full_name == "Opted Out Contact Updated"
    assert cust.consent_status == "opted_out"
    assert cust.is_suppressed is True

def test_webhook_authentication_enforcement(test_client):
    """Verify AUD-03: Webhook rejects unauthenticated callers with 401."""
    # 1. Without header -> 401
    resp_unauth = test_client.post("/api/webhooks/incoming", json={"phone": "15554445555", "text": "Hello"})
    assert resp_unauth.status_code == 401

    # 2. With wrong header -> 401
    resp_bad = test_client.post(
        "/api/webhooks/incoming",
        headers={"X-Gateway-Secret": "wrong_secret"},
        json={"phone": "15554445555", "text": "Hello"}
    )
    assert resp_bad.status_code == 401

    # 3. With valid header -> 200
    resp_valid = test_client.post(
        "/api/webhooks/incoming",
        headers={"X-Gateway-Secret": "local_gateway_secure_token_123"},
        json={"phone": "15554445555", "text": "Hello", "message_id": "MSG_TEST_001"}
    )
    assert resp_valid.status_code == 200

def test_customer_lead_stage_serialization_and_filtering(test_client, test_db):
    """Verify AUD-05: Customer lead stage is accurately serialized and filterable."""
    c1 = Customer(
        full_name="Lead One",
        phone="15551110001",
        formatted_phone="+1 555-111-0001",
        lead_stage="Interested"
    )
    c2 = Customer(
        full_name="Lead Two",
        phone="15551110002",
        formatted_phone="+1 555-111-0002",
        lead_stage="Converted"
    )
    test_db.add_all([c1, c2])
    test_db.commit()

    # Fetch all
    resp = test_client.get("/api/customers")
    assert resp.status_code == 200
    data = resp.json()
    items = {item["full_name"]: item["lead_stage"] for item in data["items"]}
    assert items["Lead One"] == "Interested"
    assert items["Lead Two"] == "Converted"

    # Filter by lead_stage=Interested
    filter_resp = test_client.get("/api/customers?lead_stage=Interested")
    assert filter_resp.status_code == 200
    filter_data = filter_resp.json()
    assert filter_data["total"] == 1
    assert filter_data["items"][0]["full_name"] == "Lead One"

@pytest.mark.anyio
async def test_deterministic_rule_engine_zero_ai():
    """Verify AUD-07: Rule engine operates deterministically with zero AI dependencies."""
    status = await DeterministicRulesService.get_status()
    assert status["available"] is True
    assert status["mode"] == "deterministic_rules"
    assert status["ai_disabled"] is True

    # Deterministic copywriting
    tpl = await DeterministicRulesService.draft_template("Summer Clearance Sale")
    assert "exclusive update" in tpl["template_text"] or "pricing" in tpl["template_text"]
    assert "Reply STOP to opt out" in tpl["template_text"]
    assert tpl["source"] == "deterministic_rules"

    # Deterministic Intent Classification
    opt_out_res = await DeterministicRulesService.classify_reply("Please STOP messaging me")
    assert opt_out_res["intent"] == "opt_out"
    assert opt_out_res["confidence"] == 1.0

    inquiry_res = await DeterministicRulesService.classify_reply("What is the cost and price for this?")
    assert inquiry_res["intent"] == "enquiry"

    # Deterministic thread summary
    msgs = [
        {"direction": "outbound", "sender_type": "user", "body": "Hi, how are you?"},
        {"direction": "inbound", "sender_type": "customer", "body": "I want to know the price for 10 units."}
    ]
    summary = await DeterministicRulesService.summarize_thread(msgs)
    assert "2 messages total" in summary["summary"]
    assert "Enquiry" in summary["summary"]
    assert summary["source"] == "deterministic_rules"

def test_campaign_recipient_unique_constraint(test_db):
    """Verify AUD-04: Cannot insert duplicate phone recipient in same campaign."""
    cmp = Campaign(
        name="Unique Test Campaign",
        message_body_snapshot="Hello {name}",
        status="in_progress"
    )
    test_db.add(cmp)
    test_db.commit()

    r1 = CampaignRecipient(
        campaign_id=cmp.id,
        recipient_name="Recipient 1",
        recipient_phone="15557778888",
        personalized_message="Hello Recipient 1",
        click_to_chat_url="https://wa.me/15557778888"
    )
    test_db.add(r1)
    test_db.commit()

    # Attempt inserting duplicate recipient for the same campaign
    r2 = CampaignRecipient(
        campaign_id=cmp.id,
        recipient_name="Recipient 2",
        recipient_phone="15557778888",
        personalized_message="Hello Recipient 2",
        click_to_chat_url="https://wa.me/15557778888"
    )
    test_db.add(r2)
    with pytest.raises(Exception):
        test_db.commit()
    test_db.rollback()

def test_option_b_numbered_quick_reply_triggers(test_db, test_client):
    """Verify Option B: Clean numbered quick-reply triggers and automated inbound routing."""
    import json
    from backend.app.services.campaign_service import format_buttons_footer

    # 1. Verify clean Option B message formatting
    buttons = [
        {"type": "quick_reply", "text": "ENQUIRE"},
        {"type": "quick_reply", "text": "STOP"},
        {"type": "url", "text": "Visit Store", "url": "https://example.com"}
    ]
    raw_body = "Hello! Check out our new update."
    formatted = format_buttons_footer(raw_body, json.dumps(buttons))
    assert "Reply with a number:" in formatted
    assert "1️⃣ *ENQUIRE*" in formatted
    assert "2️⃣ *STOP*" in formatted
    assert "🔗 *Visit Store*: https://example.com" in formatted

    # 2. Setup customer and recipient
    cust = Customer(
        full_name="Trigger User",
        phone="15559871111",
        formatted_phone="+15559871111",
        lead_stage="New",
        consent_status="unverified",
        is_suppressed=False
    )
    test_db.add(cust)
    test_db.commit()

    cmp = Campaign(
        name="Option B Campaign",
        message_body_snapshot=formatted,
        buttons_json=json.dumps(buttons),
        status="in_progress"
    )
    test_db.add(cmp)
    test_db.commit()

    rec = CampaignRecipient(
        campaign_id=cmp.id,
        customer_id=cust.id,
        recipient_name=cust.full_name,
        recipient_phone=cust.phone,
        personalized_message=formatted,
        click_to_chat_url=f"https://wa.me/{cust.phone}",
        status="sent"
    )
    test_db.add(rec)
    test_db.commit()

    # 3. Test Inbound reply '1' -> maps to ENQUIRE
    headers = {"X-Gateway-Secret": "local_gateway_secure_token_123"}
    resp1 = test_client.post(
        "/api/webhooks/incoming",
        headers=headers,
        json={"phone": "15559871111", "text": "1", "message_id": "test_msg_1"}
    )
    assert resp1.status_code == 200
    data1 = resp1.json()
    assert "received your enquiry" in data1.get("auto_reply", "").lower()

    # 4. Test Inbound reply '2' -> maps to STOP and suppresses customer
    resp2 = test_client.post(
        "/api/webhooks/incoming",
        headers=headers,
        json={"phone": "15559871111", "text": "2", "message_id": "test_msg_2"}
    )
    assert resp2.status_code == 200
    data2 = resp2.json()
    assert "unsubscribed" in data2.get("auto_reply", "").lower()

    test_db.refresh(cust)
    assert cust.is_suppressed is True
    assert cust.consent_status == "opted_out"

