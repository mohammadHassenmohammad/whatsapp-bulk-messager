import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from backend.app.database import Base
from backend.app.models.models import Customer, Category, Campaign, CampaignRecipient
from backend.app.schemas.schemas import CampaignCreate
from backend.app.services.campaign_service import create_campaign_with_recipients, update_recipient_queue_status

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSessionLocal()
    yield db
    db.close()

def test_campaign_recipient_selection_and_suppression(test_db):
    cat = Category(name="VIPs")
    test_db.add(cat)
    test_db.flush()

    # Active verified contact
    c1 = Customer(
        full_name="Sarah Connor",
        phone="15550001111",
        formatted_phone="+15550001111",
        category_id=cat.id,
        consent_status="verified",
        is_suppressed=False
    )
    # Opted-out contact (suppressed)
    c2 = Customer(
        full_name="John Doe",
        phone="15550002222",
        formatted_phone="+15550002222",
        category_id=cat.id,
        consent_status="opted_out",
        is_suppressed=True
    )
    # Unverified consent contact
    c3 = Customer(
        full_name="Unverified Contact",
        phone="15550003333",
        formatted_phone="+15550003333",
        category_id=cat.id,
        consent_status="unverified",
        is_suppressed=False
    )
    test_db.add_all([c1, c2, c3])
    test_db.commit()

    # Create campaign excluding suppressed and requiring verified consent
    campaign_req = CampaignCreate(
        name="VIP Exclusive Promo",
        message_body="Hello {name}, VIP update!",
        category_ids=[cat.id],
        only_verified_consent=True,
        exclude_suppressed=True
    )

    campaign, excluded = create_campaign_with_recipients(test_db, campaign_req)
    assert campaign.total_recipients == 1
    assert campaign.recipients[0].recipient_name == "Sarah Connor"
    assert len(excluded) == 2
    reasons = [e["reason"] for e in excluded]
    assert any("opt-out" in r for r in reasons)
    assert any("verified consent" in r for r in reasons)

def test_queue_state_transitions(test_db):
    c1 = Customer(
        full_name="Alex Mercer",
        phone="15559998888",
        formatted_phone="+15559998888",
        consent_status="verified",
        is_suppressed=False
    )
    test_db.add(c1)
    test_db.commit()

    campaign_req = CampaignCreate(
        name="Notification",
        message_body="Hi {name}",
        customer_ids=[c1.id],
        only_verified_consent=False,
        exclude_suppressed=True
    )

    campaign, excluded = create_campaign_with_recipients(test_db, campaign_req)
    recipient_id = campaign.recipients[0].id

    # Transition 1: Opened WhatsApp chat
    rec_opened = update_recipient_queue_status(test_db, campaign.id, recipient_id, "opened")
    assert rec_opened.status == "opened"
    assert rec_opened.opened_at is not None

    # Transition 2: Manually confirmed sent
    rec_sent = update_recipient_queue_status(test_db, campaign.id, recipient_id, "sent")
    assert rec_sent.status == "sent"
    assert rec_sent.confirmed_sent_at is not None

    test_db.refresh(campaign)
    assert campaign.sent_count == 1
    assert campaign.status == "completed"
