from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from backend.app.models.models import AppSetting
from backend.app.providers.base import BaseMessagingProvider, ProviderCapabilities
from backend.app.providers.baileys_provider import BaileysProvider
from backend.app.providers.cloud_api_provider import WhatsAppCloudProvider

class ProviderManager:
    @staticmethod
    def get_provider(db: Optional[Session] = None) -> BaseMessagingProvider:
        active_provider = "baileys"
        phone_number_id = None
        access_token = None
        waba_id = None

        if db:
            active_setting = db.query(AppSetting).filter(AppSetting.key == "active_messaging_provider").first()
            if active_setting and active_setting.value:
                active_provider = active_setting.value.strip().lower()

            pid_setting = db.query(AppSetting).filter(AppSetting.key == "whatsapp_cloud_phone_number_id").first()
            if pid_setting:
                phone_number_id = pid_setting.value

            token_setting = db.query(AppSetting).filter(AppSetting.key == "whatsapp_cloud_access_token").first()
            if token_setting:
                access_token = token_setting.value

            waba_setting = db.query(AppSetting).filter(AppSetting.key == "whatsapp_cloud_waba_id").first()
            if waba_setting:
                waba_id = waba_setting.value

        if active_provider == "cloud_api":
            return WhatsAppCloudProvider(
                phone_number_id=phone_number_id,
                access_token=access_token,
                waba_id=waba_id
            )
        
        return BaileysProvider()

    @staticmethod
    def get_available_providers() -> list:
        return [
            {
                "id": "baileys",
                "name": "WhatsApp Web Gateway (Baileys)",
                "description": "Zero subscription cost. Uses your linked phone session. Best for small-to-medium manual and paced broadcast campaigns.",
                "capabilities": BaileysProvider().get_capabilities().__dict__
            },
            {
                "id": "cloud_api",
                "name": "Meta WhatsApp Business Cloud API",
                "description": "Official Meta Enterprise API. High throughput, official green tick verified sender, pre-approved Meta templates required for cold outreach.",
                "capabilities": WhatsAppCloudProvider().get_capabilities().__dict__
            }
        ]
