import os
import httpx
from typing import Dict, Any, Optional

from backend.app.providers.base import (
    BaseMessagingProvider, ProviderCapabilities, MessagePayload, SendResult
)

class WhatsAppCloudProvider(BaseMessagingProvider):
    def __init__(
        self,
        phone_number_id: Optional[str] = None,
        access_token: Optional[str] = None,
        waba_id: Optional[str] = None,
        verify_token: Optional[str] = None
    ):
        self.phone_number_id = phone_number_id or os.getenv("WHATSAPP_PHONE_NUMBER_ID", "")
        self.access_token = access_token or os.getenv("WHATSAPP_CLOUD_ACCESS_TOKEN", "")
        self.waba_id = waba_id or os.getenv("WHATSAPP_WABA_ID", "")
        self.verify_token = verify_token or os.getenv("WHATSAPP_VERIFY_TOKEN", "")
        self.api_version = "v19.0"

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            name="cloud_api",
            display_name="Official Meta WhatsApp Business Cloud API",
            can_send_text=True,
            can_send_media=True,
            can_send_interactive_buttons=True,
            has_read_receipts=True,
            requires_preapproved_templates=True,
            enforces_24h_service_window=True,
            max_recipients_per_batch=10000,
            supports_anti_ban_pacing=False
        )

    def is_configured(self) -> bool:
        return bool(self.phone_number_id and self.access_token)

    async def check_health(self) -> Dict[str, Any]:
        if not self.is_configured():
            return {
                "provider": "cloud_api",
                "connected": False,
                "status": "unconfigured",
                "message": "Cloud API credentials (Phone Number ID and Access Token) not configured."
            }

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}"
        headers = {"Authorization": f"Bearer {self.access_token}"}

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "cloud_api",
                        "connected": True,
                        "status": "connected",
                        "display_phone_number": data.get("display_phone_number"),
                        "verified_name": data.get("verified_name"),
                        "quality_rating": data.get("quality_rating"),
                        "code_verification_status": data.get("code_verification_status")
                    }
                else:
                    err_data = resp.json()
                    return {
                        "provider": "cloud_api",
                        "connected": False,
                        "status": "auth_failed",
                        "error": err_data.get("error", {}).get("message", f"HTTP {resp.status_code}")
                    }
        except Exception as e:
            return {
                "provider": "cloud_api",
                "connected": False,
                "status": "unreachable",
                "error": str(e)
            }

    async def send_message(self, payload: MessagePayload) -> SendResult:
        if not self.is_configured():
            return SendResult(
                success=False,
                status="failed",
                error="Meta WhatsApp Cloud API credentials are not configured in Settings."
            )

        url = f"https://graph.facebook.com/{self.api_version}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }

        clean_recipient = payload.phone.replace("+", "").replace("-", "").replace(" ", "")

        if payload.template_name:
            data = {
                "messaging_product": "whatsapp",
                "to": clean_recipient,
                "type": "template",
                "template": {
                    "name": payload.template_name,
                    "language": {"code": payload.language_code or "en_US"},
                    "components": []
                }
            }
        elif payload.media_url:
            data = {
                "messaging_product": "whatsapp",
                "to": clean_recipient,
                "type": "image",
                "image": {"link": payload.media_url, "caption": payload.text}
            }
        else:
            data = {
                "messaging_product": "whatsapp",
                "to": clean_recipient,
                "type": "text",
                "text": {"preview_url": False, "body": payload.text}
            }

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(url, json=data, headers=headers)
                resp_json = resp.json()
                if resp.status_code in [200, 201]:
                    msg_id = resp_json.get("messages", [{}])[0].get("id")
                    return SendResult(
                        success=True,
                        status="sent",
                        message_id=msg_id,
                        raw_response=resp_json
                    )
                else:
                    error_obj = resp_json.get("error", {})
                    error_code = error_obj.get("code")
                    error_msg = error_obj.get("message", "Meta API Error")
                    is_transient = error_code in [1, 2, 130429, 80007]
                    return SendResult(
                        success=False,
                        status="failed",
                        error=f"[{error_code}] {error_msg}",
                        is_transient=is_transient,
                        raw_response=resp_json
                    )
        except httpx.TransportError as te:
            return SendResult(
                success=False,
                status="unknown",
                error=f"Network error contacting Meta Graph API: {str(te)}",
                is_transient=True
            )
        except Exception as e:
            return SendResult(
                success=False,
                status="failed",
                error=str(e),
                is_transient=False
            )

    def validate_webhook(self, headers: Dict[str, str], body: bytes) -> bool:
        return True
