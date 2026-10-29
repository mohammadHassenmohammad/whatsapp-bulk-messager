from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Dict, Any

from backend.app.database import get_db
from backend.app.models.models import AppSetting
from backend.app.providers.manager import ProviderManager

router = APIRouter(prefix="/providers", tags=["Providers"])

@router.get("")
def list_providers(db: Session = Depends(get_db)):
    active_setting = db.query(AppSetting).filter(AppSetting.key == "active_messaging_provider").first()
    active_id = active_setting.value if active_setting else "baileys"

    providers = ProviderManager.get_available_providers()
    return {
        "active_provider": active_id,
        "providers": providers
    }

@router.get("/health")
async def check_provider_health(db: Session = Depends(get_db)):
    provider = ProviderManager.get_provider(db)
    health = await provider.check_health()
    capabilities = provider.get_capabilities().__dict__
    return {
        "health": health,
        "capabilities": capabilities
    }

@router.post("/switch")
def switch_provider(payload: dict = Body(...), db: Session = Depends(get_db)):
    new_provider = (payload.get("provider") or "").strip().lower()
    if new_provider not in ["baileys", "cloud_api"]:
        raise HTTPException(status_code=400, detail="Invalid provider ID. Choose 'baileys' or 'cloud_api'.")

    setting = db.query(AppSetting).filter(AppSetting.key == "active_messaging_provider").first()
    if not setting:
        setting = AppSetting(key="active_messaging_provider", value=new_provider, description="Active messaging transport provider")
        db.add(setting)
    else:
        setting.value = new_provider

    db.commit()
    return {"success": True, "active_provider": new_provider}

@router.post("/cloud-config")
def save_cloud_api_config(payload: dict = Body(...), db: Session = Depends(get_db)):
    fields = {
        "whatsapp_cloud_phone_number_id": payload.get("phone_number_id"),
        "whatsapp_cloud_access_token": payload.get("access_token"),
        "whatsapp_cloud_waba_id": payload.get("waba_id"),
        "whatsapp_cloud_verify_token": payload.get("verify_token"),
    }

    for key, val in fields.items():
        if val is not None:
            setting = db.query(AppSetting).filter(AppSetting.key == key).first()
            if not setting:
                setting = AppSetting(key=key, value=str(val).strip(), description="Meta Cloud API config")
                db.add(setting)
            else:
                setting.value = str(val).strip()

    db.commit()
    return {"success": True, "message": "Meta Cloud API credentials saved successfully"}
