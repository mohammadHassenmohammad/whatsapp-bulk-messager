import pytest
from datetime import datetime
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models.models import (
    Customer, Category, Campaign, CampaignRecipient, CustomerInquiry,
    ConsentAuditLog, Tag, Conversation, Message, AppSetting
)
from backend.app.schemas.schemas import CampaignCreate
from backend.app.services.campaign_service import (
    select_campaign_recipients, update_recipient_queue_status
)
from backend.app.services.backup_service import export_all_data, restore_all_data
from backend.app.api.media import validate_image_magic_bytes

@pytest.fixture
def test_db():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False}
    )

    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

def test_sqlite_foreign_key_enforcement(test_db):
    """Verify that foreign key constraints are enforced in SQLite."""
    # Attempting to add a customer with a non-existent category_id should raise or fail when foreign keys are active
    cust = Customer(
        full_name="Foreign Key Tester",
        phone="15550001111",
        formatted_phone="+1 555 000 1111",
        category_id=99999 # Non-existent category
    )
    test_db.add(cust)
    with pytest.raises(Exception):
        test_db.commit()
    test_db.rollback()

def test_mandatory_opt_out_suppression(test_db):
    """Verify that opted-out contacts are NEVER included, even if client requests not to exclude."""
    cust_opted_out = Customer(
        full_name="Opted Out Contact",
        phone="15551112222",
        formatted_phone="+1 555 111 2222",
        consent_status="opted_out",
        is_suppressed=True
    )
    cust_valid = Customer(
        full_name="Valid Contact",
        phone="15553334444",
        formatted_phone="+1 555 333 4444",
        consent_status="verified",
        is_suppressed=False
    )
    test_db.add_all([cust_opted_out, cust_valid])
    test_db.commit()

    # Even if exclude_suppressed is passed as False, backend safeguard MUST exclude opted-out contacts
    criteria = CampaignCreate(
        name="Test Broadcast",
        message_body="Hello {name}",
        exclude_suppressed=False,
        only_verified_consent=False
    )
    eligible, excluded = select_campaign_recipients(test_db, criteria)
    eligible_phones = [c.phone for c in eligible]

    assert "15551112222" not in eligible_phones
    assert "15553334444" in eligible_phones
    assert len(excluded) == 1
    assert "opt-out" in excluded[0]["reason"].lower()

def test_state_machine_transitions_and_idempotency(test_db):
    """Verify valid transitions succeed, invalid transitions raise ValueError, and duplicate calls are idempotent."""
    cmp = Campaign(
        name="State Machine Campaign",
        message_body_snapshot="Hello",
        status="in_progress",
        total_recipients=1
    )
    test_db.add(cmp)
    test_db.commit()

    rec = CampaignRecipient(
        campaign_id=cmp.id,
        recipient_name="Tester",
        recipient_phone="15556667777",
        personalized_message="Hello",
        click_to_chat_url="https://wa.me/15556667777",
        status="prepared"
    )
    test_db.add(rec)
    test_db.commit()

    # 1. prepared -> opened: Valid
    updated = update_recipient_queue_status(test_db, cmp.id, rec.id, "opened")
    assert updated.status == "opened"

    # 2. opened -> opened (idempotent duplicate): Valid
    updated = update_recipient_queue_status(test_db, cmp.id, rec.id, "opened")
    assert updated.status == "opened"

    # 3. opened -> sent: Valid, records message_id
    updated = update_recipient_queue_status(test_db, cmp.id, rec.id, "sent", message_id="MSG_XYZ_123")
    assert updated.status == "sent"
    assert updated.message_id == "MSG_XYZ_123"

    # 4. sent -> delivered: Valid
    updated = update_recipient_queue_status(test_db, cmp.id, rec.id, "delivered")
    assert updated.status == "delivered"

    # 5. delivered -> read: Valid
    updated = update_recipient_queue_status(test_db, cmp.id, rec.id, "read")
    assert updated.status == "read"

    # 6. read -> opened (Invalid backwards transition from terminal read): Must raise ValueError
    with pytest.raises(ValueError):
        update_recipient_queue_status(test_db, cmp.id, rec.id, "opened")

def test_image_magic_bytes_security():
    """Verify magic bytes validation detects valid images and rejects spoofed files."""
    valid_png = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR"
    invalid_png = b"<?php echo 'malicious'; ?>"
    valid_jpeg = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01"
    invalid_jpeg = b"random plain text content"

    assert validate_image_magic_bytes(valid_png, ".png") is True
    assert validate_image_magic_bytes(invalid_png, ".png") is False
    assert validate_image_magic_bytes(valid_jpeg, ".jpg") is True
    assert validate_image_magic_bytes(invalid_jpeg, ".jpg") is False

def test_full_backup_and_restore_with_crm(test_db):
    """Verify complete database backup and restore including inquiries and schema version."""
    cat = Category(name="VIP VIP", color="#123456")
    test_db.add(cat)
    test_db.commit()

    cust = Customer(
        full_name="John Doe",
        phone="15559998888",
        formatted_phone="+1 555 999 8888",
        category_id=cat.id,
        lead_stage="Interested"
    )
    test_db.add(cust)
    test_db.commit()

    inq = CustomerInquiry(
        customer_id=cust.id,
        phone=cust.phone,
        customer_name=cust.full_name,
        inquiry_type="enquire",
        message_text="Interested in pricing",
        message_id="INQ_MSG_999"
    )
    test_db.add(inq)
    test_db.commit()

    backup = export_all_data(test_db)
    assert backup["version"] == "2.0"
    assert len(backup["categories"]) == 1
    assert len(backup["customers"]) == 1
    assert len(backup["inquiries"]) == 1
    assert backup["customers"][0]["lead_stage"] == "Interested"

    # Test restore
    result = restore_all_data(test_db, backup)
    assert result["success"] is True
    assert test_db.query(Customer).count() == 1
    assert test_db.query(CustomerInquiry).count() == 1
