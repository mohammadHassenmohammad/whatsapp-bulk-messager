import pytest
from backend.app.services.phone_service import normalize_phone, build_click_to_chat_url

def test_phone_normalization_standard_us():
    res = normalize_phone("+1 (555) 234-5678")
    assert res["is_valid"] is True
    assert res["normalized"] == "15552345678"
    assert res["formatted"] == "+15552345678"

def test_phone_normalization_intl_prefix():
    res = normalize_phone("0044 7911 123456")
    assert res["is_valid"] is True
    assert res["normalized"] == "447911123456"

def test_phone_normalization_with_default_cc():
    res = normalize_phone("9876543210", default_country_code="91")
    assert res["is_valid"] is True
    assert res["normalized"] == "919876543210"

def test_phone_normalization_invalid_too_short():
    res = normalize_phone("12345")
    assert res["is_valid"] is False
    assert "too short" in res["error"]

def test_phone_normalization_invalid_empty():
    res = normalize_phone("")
    assert res["is_valid"] is False

def test_click_to_chat_url_encoding():
    url = build_click_to_chat_url("15551234567", "Hello John! How are you?\nNew line & special: 100%")
    assert url.startswith("https://wa.me/15551234567?text=")
    assert "%0A" in url or "%0a" in url # New line encoded
    assert "%26" in url # Ampersand encoded
    assert "%25" in url # Percent encoded
    assert " " not in url # No raw spaces in valid URL
