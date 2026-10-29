import logging
import re
from typing import List, Dict, Any, Optional

logger = logging.getLogger(__name__)

class DeterministicRulesService:
    """
    100% Deterministic Rule-Based Automation Engine.
    Operates locally with zero external AI models, cloud APIs, or Ollama dependencies.
    """

    @staticmethod
    async def get_status() -> Dict[str, Any]:
        """Returns deterministic rule engine status."""
        return {
            "available": True,
            "mode": "deterministic_rules",
            "active_model": "rule_based_engine",
            "engine": "Deterministic Keyword & Pattern Matcher",
            "ai_disabled": True,
            "models": [],
            "supported_rules": [
                "Exact Opt-Out Suppression ('STOP', 'CANCEL', 'UNSUBSCRIBE')",
                "Exact Opt-In Re-consent ('START', 'SUBSCRIBE', 'RESUBSCRIBE')",
                "Customer Enquiry & Lead Detection ('PRICE', 'DETAILS', 'QUOTE')",
                "Issue & Complaint Routing ('PROBLEM', 'REFUND', 'ISSUE')",
                "Inactivity Lead Hygiene"
            ]
        }

    @classmethod
    async def draft_template(
        cls,
        topic: str,
        tone: str = "professional",
        customer_name_var: bool = True
    ) -> Dict[str, Any]:
        """
        Generates high-converting, compliant WhatsApp message copy using
        deterministic copywriting patterns without any LLMs.
        """
        topic_clean = topic.strip()
        topic_lower = topic_clean.lower()
        greeting = "Hi {name},\n\n" if customer_name_var else "Hello,\n\n"
        opt_out = "\n\nReply STOP to opt out."

        if any(w in topic_lower for w in ["offer", "sale", "discount", "promo", "deal", "special"]):
            body = (
                f"{greeting}We are pleased to share an exclusive update regarding {topic_clean}! "
                f"For a limited time, enjoy special pricing available exclusively to our valued clients. "
                f"Reply to this chat if you would like full details."
                f"{opt_out}"
            )
        elif any(w in topic_lower for w in ["reminder", "appointment", "schedule", "renew", "due", "payment"]):
            body = (
                f"{greeting}This is a friendly reminder regarding your upcoming {topic_clean}. "
                f"Please reply to this message if you need to confirm, make changes, or have any questions."
                f"{opt_out}"
            )
        elif any(w in topic_lower for w in ["welcome", "onboard", "hello", "intro"]):
            body = (
                f"{greeting}Welcome! Thank you for connecting with us regarding {topic_clean}. "
                f"Our team is here to assist you every step of the way. Feel free to reply anytime if you need help."
                f"{opt_out}"
            )
        elif any(w in topic_lower for w in ["feedback", "review", "satisfaction", "survey"]):
            body = (
                f"{greeting}Thank you for your recent experience with {topic_clean}. "
                f"Your feedback helps us serve you better. How would you rate our service today? Reply directly with your thoughts."
                f"{opt_out}"
            )
        else:
            body = (
                f"{greeting}Thank you for being a valued contact. We wanted to reach out regarding {topic_clean}. "
                f"Please let us know if we can assist you with any questions or provide further information."
                f"{opt_out}"
            )

        return {
            "source": "deterministic_rules",
            "template_text": body,
            "variables": ["name"] if customer_name_var else []
        }

    @classmethod
    async def classify_reply(cls, message_text: str) -> Dict[str, Any]:
        """
        Deterministically classifies incoming message intent using strict keyword sets.
        """
        text_clean = message_text.strip().lower()

        # 1. Opt-out keyword rule (Legal & Policy compliance)
        if any(w in text_clean for w in ["stop", "unsubscribe", "opt out", "optout", "cancel", "remove", "block"]):
            return {"intent": "opt_out", "confidence": 1.0, "source": "rule_exact"}

        # 2. Re-consent / Opt-in rule
        if any(w in text_clean for w in ["start", "subscribe", "opt in", "optin", "resubscribe"]):
            return {"intent": "opt_in", "confidence": 1.0, "source": "rule_exact"}

        # 3. Complaints & Urgent issues
        if any(w in text_clean for w in ["issue", "problem", "broken", "fraud", "scam", "bad service", "complaint", "refund", "not working", "delayed"]):
            return {"intent": "complaint", "confidence": 1.0, "source": "rule_keyword"}

        # 4. Enquiries & Purchase intent
        if any(w in text_clean for w in ["price", "cost", "how much", "details", "info", "catalog", "brochure", "when", "send details", "interested", "yes", "call me", "order"]):
            return {"intent": "enquiry", "confidence": 1.0, "source": "rule_keyword"}

        # 5. Not interested / Disinterest
        if any(w in text_clean for w in ["no", "not interested", "dont want", "wrong number", "leave me alone"]):
            return {"intent": "not_interested", "confidence": 1.0, "source": "rule_keyword"}

        return {"intent": "general", "confidence": 0.8, "source": "rule_default"}

    @classmethod
    async def suggest_replies(cls, last_message: str, customer_name: str = "") -> Dict[str, Any]:
        """
        Suggests 3 context-aware, deterministic response templates.
        """
        name_prefix = f"{customer_name.split()[0]}, " if customer_name else ""
        classification = await cls.classify_reply(last_message)
        intent = classification["intent"]

        if intent in ["enquiry", "interested"]:
            suggestions = [
                f"Hi {name_prefix}thanks for reaching out! What specific details or pricing can I share with you?",
                f"Hello {name_prefix}our catalog and current pricing details are available. Would you like to schedule a quick call today?",
                f"Thank you for your interest! Let me connect you with our specialist right away."
            ]
        elif intent == "complaint":
            suggestions = [
                f"Hi {name_prefix}I apologize for this inconvenience. Could you please share your order or account number so I can resolve this immediately?",
                f"We are looking into this right away. Let me escalate this to our support team for priority resolution.",
                f"Thank you for bringing this to our attention. Let us get this sorted out for you right now."
            ]
        elif intent == "not_interested":
            suggestions = [
                f"Understood, {name_prefix}! Thank you for letting us know. Have a wonderful day ahead.",
                f"No problem at all! We won't send further updates. Reply anytime if your needs change.",
                f"Thank you for your time! Wishing you all the best."
            ]
        else:
            suggestions = [
                f"Hi {name_prefix}thank you for your message! How can our team assist you today?",
                f"Hello! Thanks for reaching out. Please let us know if you need any assistance.",
                f"Got it! Let me know if you would like me to share more details."
            ]

        return {
            "intent": intent,
            "suggestions": suggestions,
            "source": classification["source"]
        }

    @classmethod
    async def summarize_thread(cls, messages: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Deterministically summarizes chat transcripts into key factual metrics
        without external LLMs.
        """
        if not messages:
            return {"summary": "No messages in conversation yet.", "source": "empty"}

        total_msgs = len(messages)
        inbound = sum(1 for m in messages if m.get("direction") == "inbound")
        outbound = sum(1 for m in messages if m.get("direction") == "outbound")

        last_msg = messages[-1]
        last_body = last_msg.get("body") or last_msg.get("message_text", "")
        last_sender = last_msg.get("sender_type") or last_msg.get("direction", "contact")

        classification = await cls.classify_reply(last_body)
        detected_intent = classification["intent"].replace("_", " ").title()

        summary_text = (
            f"• Thread status: {total_msgs} messages total ({inbound} inbound, {outbound} outbound).\n"
            f"• Latest message from {last_sender}: '{last_body[:80]}...'\n"
            f"• Detected customer intent: {detected_intent}."
        )

        return {
            "summary": summary_text,
            "source": "deterministic_rules"
        }

# Backwards compatibility alias
AIService = DeterministicRulesService
