import re
import urllib.parse
from typing import Dict, Any, Tuple

def clean_phone_input(raw: str) -> str:
    """Removes common formatting characters while preserving leading + or 00."""
    if not raw:
        return ""
    s = str(raw).strip()
    # Normalize 00 to + at start
    if s.startswith("00"):
        s = "+" + s[2:]
    # Keep leading + if present, strip everything else non-numeric
    has_plus = s.startswith("+")
    digits = re.sub(r"\D", "", s)
    return ("+" + digits) if has_plus else digits

def normalize_phone(raw_phone: str, default_country_code: str = "1") -> Dict[str, Any]:
    """
    Normalizes a phone number to standard international format.
    Returns a dict with:
      - is_valid: bool
      - normalized: string of digits without '+' (for wa.me URL)
      - formatted: string with '+' (for display e.g. +1234567890)
      - error: optional error string
    """
    if not raw_phone:
        return {
            "is_valid": False,
            "normalized": "",
            "formatted": "",
            "error": "Phone number is required"
        }

    cleaned = clean_phone_input(raw_phone)
    if not cleaned:
        return {
            "is_valid": False,
            "normalized": "",
            "formatted": "",
            "error": "No numeric digits found in phone number"
        }

    # Ensure clean default country code (digits only)
    clean_cc = re.sub(r"\D", "", str(default_country_code)) or "1"

    if cleaned.startswith("+"):
        digits = cleaned[1:]
    else:
        # If no international prefix, apply default country code if not already present
        digits = cleaned
        # If length is local (e.g. 10 digits for US/India), prepend default country code
        if len(digits) == 10:
            digits = clean_cc + digits
        elif not digits.startswith(clean_cc) and len(digits) < 12:
            digits = clean_cc + digits

    # E.164 standard: between 7 and 15 digits
    if len(digits) < 7:
        return {
            "is_valid": False,
            "normalized": digits,
            "formatted": f"+{digits}",
            "error": "Phone number is too short (minimum 7 digits required)"
        }
    if len(digits) > 15:
        return {
            "is_valid": False,
            "normalized": digits,
            "formatted": f"+{digits}",
            "error": "Phone number exceeds maximum international length (15 digits)"
        }

    # WhatsApp wa.me requires digits only, no + sign, no spaces, no dashes
    return {
        "is_valid": True,
        "normalized": digits,
        "formatted": f"+{digits}",
        "error": None
    }

def build_click_to_chat_url(phone_digits: str, message: str) -> str:
    """
    Builds the official WhatsApp click-to-chat URL:
    https://wa.me/<number>?text=<encoded_text>
    Uses urllib.parse.quote to safely encode all special characters, emojis, newlines, etc.
    """
    encoded_message = urllib.parse.quote(message, safe="")
    return f"https://wa.me/{phone_digits}?text={encoded_message}"
