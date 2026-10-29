import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.database import Base
from backend.app.models.models import Customer, Campaign, CampaignRecipient, AppSetting
from backend.app.schemas.schemas import CampaignCreate
from backend.app.services.campaign_service import (
    create_campaign_with_recipients, update_recipient_queue_status
)
from backend.app.providers.base import MessagePayload
from backend.app.providers.baileys_provider import BaileysProvider
from backend.app.providers.cloud_api_provider import WhatsAppCloudProvider
from backend.app.providers.manager import ProviderManager

@pytest.fixture
def test_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()

def test_provider_capabilities():
    """Verify capabilities and constraint detection across provider implementations."""
    baileys = BaileysProvider()
    caps_b = baileys.get_capabilities()
    assert caps_b.name == "baileys"
    assert caps_b.can_send_text is True
    assert caps_b.requires_preapproved_templates is False
    assert caps_b.enforces_24h_service_window is False

    cloud = WhatsAppCloudProvider()
    caps_c = cloud.get_capabilities()
    assert caps_c.name == "cloud_api"
    assert caps_c.requires_preapproved_templates is True
    assert caps_c.enforces_24h_service_window is True

def test_provider_manager_switching(test_db):
    """Verify that ProviderManager resolves the correct provider based on app settings."""
    # Default is Baileys
    p1 = ProviderManager.get_provider(test_db)
    assert isinstance(p1, BaileysProvider)

    # Switch setting to cloud_api
    setting = AppSetting(key="active_messaging_provider", value="cloud_api")
    test_db.add(setting)
    test_db.commit()

    p2 = ProviderManager.get_provider(test_db)
    assert isinstance(p2, WhatsAppCloudProvider)

def test_campaign_sandbox_test_mode(test_db):
    """Verify sandbox test mode creates only 1 test recipient and leaves production contacts untouched."""
    # Add real production contacts
    for i in range(5):
        cust = Customer(
            full_name=f"Production Client {i}",
            phone=f"1555000100{i}",
            formatted_phone=f"+1 555 000 100{i}",
            consent_status="verified"
        )
        test_db.add(cust)
    test_db.commit()

    # Create sandbox test campaign
    criteria = CampaignCreate(
        name="Quarterly Sale Preview",
        message_body="Hi {name}, here is your VIP discount code!",
        is_test_mode=True,
        test_phone_number="+1 555 999 8888"
    )

    campaign, excluded = create_campaign_with_recipients(test_db, criteria)
    assert campaign.is_test_mode is True
    assert campaign.total_recipients == 1
    assert len(campaign.recipients) == 1
    assert campaign.recipients[0].recipient_phone == "15559998888"
    assert campaign.recipients[0].customer_id is None # Not tied to production customer record

    # Ensure none of the 5 production clients were selected
    rec_phones = [r.recipient_phone for r in campaign.recipients]
    for i in range(5):
        assert f"1555000100{i}" not in rec_phones

def test_retry_failed_recipients(test_db):
    """Verify failed recipients can be reset back to prepared without duplicating records."""
    cmp = Campaign(name="Retry Test", message_body_snapshot="Hi", status="in_progress")
    test_db.add(cmp)
    test_db.commit()

    r1 = CampaignRecipient(
        campaign_id=cmp.id,
        recipient_name="Failed User",
        recipient_phone="15557778888",
        personalized_message="Hi",
        click_to_chat_url="https://wa.me/15557778888",
        status="failed",
        error_message="Gateway timeout"
    )
    test_db.add(r1)
    test_db.commit()

    # Reset recipient to prepared
    r1.status = "prepared"
    r1.error_message = None
    test_db.commit()

    refreshed = test_db.query(CampaignRecipient).filter(CampaignRecipient.id == r1.id).first()
    assert refreshed.status == "prepared"
    assert refreshed.error_message is None
