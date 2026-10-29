import logging
import os
import re
from typing import List, Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_URL", "http://127.0.0.1:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

class AIService:
    @staticmethod
    async def get_status() -> Dict[str, Any]:
        """Check if local Ollama runtime is reachable."""
        try:
            async with httpx.AsyncClient(timeout=1.5) as client:
                res = await client.get(f"{OLLAMA_BASE_URL}/api/tags")
                if res.status_code == 200:
                    data = res.json()
                    models = [m.get("name") for m in data.get("models", [])]
                    selected_model = DEFAULT_MODEL if DEFAULT_MODEL in models else (models[0] if models else DEFAULT_MODEL)
                    return {
                        "available": True,
                        "url": OLLAMA_BASE_URL,
                        "models": models,
                        "active_model": selected_model,
                        "mode": "local_ollama"
                    }
        except Exception as e:
            logger.debug(f"Local Ollama is not accessible: {e}")

        return {
            "available": False,
            "url": OLLAMA_BASE_URL,
            "models": [],
            "active_model": "heuristic_rules",
            "mode": "rule_based_fallback"
        }

    @staticmethod
    async def _query_ollama(prompt: str, system_prompt: str = "") -> Optional[str]:
        """Execute a generation prompt against local Ollama."""
        status = await AIService.get_status()
        if not status["available"]:
            return None

        model = status["active_model"]
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                payload = {
                    "model": model,
                    "prompt": prompt,
                    "system": system_prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.4,
                        "num_predict": 256
                    }
                }
                res = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
                if res.status_code == 200:
                    return res.json().get("response", "").strip()
        except Exception as e:
            logger.warning(f"Ollama generation failed, falling back to rules: {e}")
        return None

    @classmethod
    async def draft_template(
        cls,
        topic: str,
        tone: str = "professional",
        customer_name_var: bool = True
    ) -> Dict[str, Any]:
        """Draft a WhatsApp message template using Ollama or intelligent heuristics."""
        prompt = (
            f"Write a short, engaging WhatsApp message template for a business regarding: '{topic}'. "
            f"Tone: {tone}. Keep it under 50 words. "
            f"{'Include {{customer_name}} variable for personalization.' if customer_name_var else ''} "
            f"Always include an unsubscribe option like: 'Reply STOP to opt out.' at the very end."
        )
        system = "You are an expert WhatsApp marketing copywriter creating compliant, high-converting direct messages."

        ollama_res = await cls._query_ollama(prompt, system)
        if ollama_res:
            return {
                "source": "ollama",
                "template_text": ollama_res,
                "variables": ["customer_name"] if "{{customer_name}}" in ollama_res else []
            }

        # Rule-based fallback templates
        greeting = "Hi {{customer_name}}, " if customer_name_var else "Hello! "
        if "offer" in topic.lower() or "sale" in topic.lower() or "discount" in topic.lower():
            body = f"{greeting}we're excited to offer you a special update on {topic}! Don't miss out on exclusive pricing valid this week. Let us know if you'd like more details.\n\nReply STOP to opt out."
        elif "reminder" in topic.lower() or "payment" in topic.lower() or "appointment" in topic.lower():
            body = f"{greeting}this is a quick friendly reminder regarding {topic}. Please let us know if you have any questions or need to reschedule.\n\nReply STOP to opt out."
        else:
            body = f"{greeting}thank you for being a valued customer. We wanted to share an important update regarding {topic}. Reply to this message anytime to chat with our team.\n\nReply STOP to opt out."

        return {
            "source": "rules",
            "template_text": body,
            "variables": ["customer_name"] if customer_name_var else []
        }

    @classmethod
    async def classify_reply(cls, message_text: str) -> Dict[str, Any]:
        """Classify incoming WhatsApp replies into lead intent categories."""
        text_clean = message_text.strip().lower()

        # Deterministic rule checks first for security and privacy compliance
        if any(w in text_clean for w in ["stop", "unsubscribe", "opt out", "cancel", "remove", "block"]):
            return {"intent": "opt_out", "confidence": 1.0, "source": "rule_exact"}

        if any(w in text_clean for w in ["start", "subscribe", "opt in", "resubscribe"]):
            return {"intent": "opt_in", "confidence": 1.0, "source": "rule_exact"}

        if any(w in text_clean for w in ["issue", "problem", "broken", "fraud", "scam", "bad service", "complaint", "refund", "not working", "delayed"]):
            return {"intent": "complaint", "confidence": 0.9, "source": "rule_keyword"}

        if any(w in text_clean for w in ["price", "cost", "how much", "details", "info", "catalog", "brochure", "when", "send details", "interested", "yes", "call me"]):
            return {"intent": "enquiry", "confidence": 0.95, "source": "rule_keyword"}

        if any(w in text_clean for w in ["no", "not interested", "dont want", "wrong number", "leave me alone"]):
            return {"intent": "not_interested", "confidence": 0.9, "source": "rule_keyword"}

        # Try Ollama classification for ambiguous text
        prompt = (
            f"Classify the intent of this incoming WhatsApp message into exactly one of these categories: "
            f"[enquiry, interested, complaint, not_interested, opt_out, general].\n"
            f"Message: \"{message_text}\"\n"
            f"Respond with only the category word."
        )
        ollama_res = await cls._query_ollama(prompt)
        if ollama_res:
            word = re.sub(r"[^a-zA-Z_]", "", ollama_res.lower().split()[0] if ollama_res.split() else "")
            valid = ["enquiry", "interested", "complaint", "not_interested", "opt_out", "general"]
            if word in valid:
                return {"intent": word, "confidence": 0.85, "source": "ollama"}

        return {"intent": "general", "confidence": 0.6, "source": "rule_default"}

    @classmethod
    async def suggest_replies(cls, last_message: str, customer_name: str = "") -> Dict[str, Any]:
        """Suggest 3 quick response snippets."""
        name_prefix = f"{customer_name.split()[0]}, " if customer_name else ""
        classification = await cls.classify_reply(last_message)
        intent = classification["intent"]

        if intent in ["enquiry", "interested"]:
            suggestions = [
                f"Hi {name_prefix}thanks for reaching out! We would be delighted to help. What specific details can I provide for you?",
                f"Hello {name_prefix}our pricing and catalog are attached. Would you like to schedule a quick 5-minute call today?",
                f"Thank you for your interest! Let me connect you with our specialist right away."
            ]
        elif intent == "complaint":
            suggestions = [
                f"Hi {name_prefix}I am truly sorry to hear about this issue. Could you please share your order/account number so I can resolve it immediately?",
                f"We apologize for the inconvenience. Let me escalate this to our support supervisor right away.",
                f"Thank you for bringing this to our attention. Let's get this sorted out for you right now."
            ]
        elif intent == "not_interested":
            suggestions = [
                f"No problem at all, {name_prefix}! Thank you for letting us know. Have a wonderful day ahead.",
                f"Understood! We won't disturb you. Reply anytime if your needs change.",
                f"Thank you for your time! Wishing you the best."
            ]
        else:
            suggestions = [
                f"Hi {name_prefix}thank you for your message! How can we assist you today?",
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
        """Summarize conversation history into key takeaway points."""
        if not messages:
            return {"summary": "No messages in conversation yet.", "source": "empty"}

        # Format message transcript
        transcript_lines = []
        for m in messages[-10:]:
            sender = m.get("sender_type") or m.get("direction", "unknown")
            body = m.get("body") or m.get("message_text", "")
            transcript_lines.append(f"{sender}: {body}")
        transcript = "\n".join(transcript_lines)

        prompt = (
            f"Summarize this customer WhatsApp interaction in 2 concise bullet points focusing on customer intent and next action:\n\n"
            f"{transcript}"
        )
        ollama_res = await cls._query_ollama(prompt)
        if ollama_res:
            return {"summary": ollama_res, "source": "ollama"}

        # Fallback summary
        last_m = messages[-1].get("body") or messages[-1].get("message_text", "")
        return {
            "summary": f"Active conversation with {len(messages)} total messages. Latest interaction: '{last_m[:60]}...'",
            "source": "heuristic"
        }
