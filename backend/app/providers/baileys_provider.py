import os
import httpx
from typing import Dict, Any, Optional

from backend.app.providers.base import (
    BaseMessagingProvider, ProviderCapabilities, MessagePayload, SendResult
)

class BaileysProvider(BaseMessagingProvider):
    def __init__(self, gateway_url: str = "http://127.0.0.1:3050", secret: str = "local_gateway_secure_token_123"):
        self.gateway_url = gateway_url.rstrip("/")
        self.secret = secret

    def get_capabilities(self) -> ProviderCapabilities:
        return ProviderCapabilities(
            name="baileys",
            display_name="WhatsApp Web Gateway (Baileys Linked Session)",
            can_send_text=True,
            can_send_media=True,
            can_send_interactive_buttons=True,
            has_read_receipts=True,
            requires_preapproved_templates=False,
            enforces_24h_service_window=False,
            max_recipients_per_batch=500,
            supports_rate_pacing=True,
            supports_anti_ban_pacing=True
        )

    async def check_health(self) -> Dict[str, Any]:
        url = f"{self.gateway_url}/api/session/status"
        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                resp = await client.get(url)
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "provider": "baileys",
                        "connected": data.get("status") == "connected",
                        "status": data.get("status", "disconnected"),
                        "user": data.get("user"),
                        "activeBulkJob": data.get("activeBulkJob"),
                        "latency_ms": 10
                    }
                return {"provider": "baileys", "connected": False, "status": "error", "error": f"HTTP {resp.status_code}"}
        except Exception as e:
            return {"provider": "baileys", "connected": False, "status": "unreachable", "error": str(e)}

    async def send_message(self, payload: MessagePayload) -> SendResult:
        url = f"{self.gateway_url}/api/messages/send-single"
        body = {
            "phone": payload.phone,
            "message": payload.text,
            "mediaUrl": payload.media_url,
            "buttons": payload.buttons or []
        }
        headers = {
            "Content-Type": "application/json",
            "X-Gateway-Secret": self.secret
        }

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(url, json=body, headers=headers)
                data = resp.json()
                if resp.status_code == 200 and data.get("success"):
                    return SendResult(
                        success=True,
                        status="sent",
                        message_id=data.get("messageId"),
                        raw_response=data
                    )
                else:
                    err_msg = data.get("error", "Unknown dispatch failure")
                    is_transient = "connection" in err_msg.lower() or "timeout" in err_msg.lower()
                    return SendResult(
                        success=False,
                        status="failed",
                        error=err_msg,
                        is_transient=is_transient,
                        raw_response=data
                    )
        except httpx.TransportError as te:
            return SendResult(
                success=False,
                status="unknown",
                error=f"Network error contacting gateway: {str(te)}",
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
        incoming_secret = headers.get("x-gateway-secret") or headers.get("X-Gateway-Secret")
        if incoming_secret and incoming_secret == self.secret:
            return True
        return False
