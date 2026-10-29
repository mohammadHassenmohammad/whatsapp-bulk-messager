from abc import ABC, abstractmethod
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field

@dataclass
class ProviderCapabilities:
    name: str # "baileys" or "cloud_api"
    display_name: str
    can_send_text: bool = True
    can_send_media: bool = True
    can_send_interactive_buttons: bool = True
    has_read_receipts: bool = True
    requires_preapproved_templates: bool = False
    enforces_24h_service_window: bool = False
    max_recipients_per_batch: int = 1000
    supports_rate_pacing: bool = True
    supports_anti_ban_pacing: bool = True

@dataclass
class MessagePayload:
    phone: str
    text: str
    media_url: Optional[str] = None
    buttons: Optional[List[Dict[str, str]]] = None # e.g. [{"id":"1","text":"ENQUIRE","type":"quick_reply"}]
    template_name: Optional[str] = None
    language_code: Optional[str] = "en_US"
    template_variables: Optional[List[str]] = None

@dataclass
class SendResult:
    success: bool
    status: str # "sent", "failed", "unknown"
    message_id: Optional[str] = None
    error: Optional[str] = None
    is_transient: bool = False
    raw_response: Optional[Dict[str, Any]] = None

class BaseMessagingProvider(ABC):
    @abstractmethod
    def get_capabilities(self) -> ProviderCapabilities:
        """Returns the capabilities and constraints of this provider."""
        pass

    @abstractmethod
    async def check_health(self) -> Dict[str, Any]:
        """Checks connection status, authentication health, and latency."""
        pass

    @abstractmethod
    async def send_message(self, payload: MessagePayload) -> SendResult:
        """Sends a message through the provider."""
        pass

    @abstractmethod
    def validate_webhook(self, headers: Dict[str, str], body: bytes) -> bool:
        """Validates authenticity of incoming webhook payloads."""
        pass
