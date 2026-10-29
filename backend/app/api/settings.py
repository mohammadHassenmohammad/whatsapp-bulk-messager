import os
from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.database import get_db, DATABASE_URL
from backend.app.models.models import (
    AppSetting, Customer, Category, MessageTemplate, Campaign, CampaignRecipient, CampaignActivityLog,
    CustomerInquiry, ConsentAuditLog, Conversation, Message, FollowUpTask, Tag, customer_tags
)
from backend.app.services.backup_service import export_all_data, restore_all_data
import json

router = APIRouter(prefix="/settings", tags=["Settings"])

DEFAULT_SETTINGS = {
    "app_name": "WhatsApp Campaign Manager",
    "default_country_code": "1",
    "default_signature": "\n\nBest regards,\nCustomer Support Team",
    "default_consent_status": "unverified",
    "theme": "light",
    "auto_open_tab": "true",
    "auto_mark_reviewed": "false"
}

@router.get("")
def get_settings(db: Session = Depends(get_db)):
    settings_records = db.query(AppSetting).all()
    results = dict(DEFAULT_SETTINGS)
    for s in settings_records:
        results[s.key] = s.value

    # Append database information
    db_size = 0
    if "sqlite" in DATABASE_URL:
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            db_size = os.path.getsize(db_path)

    return {
        "settings": results,
        "db_info": {
            "type": "SQLite (Local)",
            "url": DATABASE_URL,
            "size_bytes": db_size,
            "size_kb": round(db_size / 1024, 2)
        }
    }

@router.post("")
def update_settings(payload: Dict[str, str], db: Session = Depends(get_db)):
    for k, v in payload.items():
        s = db.query(AppSetting).filter(AppSetting.key == k).first()
        if s:
            s.value = str(v)
        else:
            s = AppSetting(key=k, value=str(v))
            db.add(s)
    db.commit()
    return {"message": "Settings updated successfully", "settings": payload}

@router.get("/backup/export")
def export_backup(db: Session = Depends(get_db)):
    data = export_all_data(db)
    return data

@router.post("/backup/restore")
async def restore_backup(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    try:
        backup_json = json.loads(content.decode("utf-8"))
        res = restore_all_data(db, backup_json)
        return res
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file uploaded")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to restore backup: {str(e)}")

@router.post("/reset")
def clear_all_data(payload: dict = Body(...), db: Session = Depends(get_db)):
    confirmation = payload.get("confirmation", "")
    if confirmation != "CLEAR ALL DATA":
        raise HTTPException(
            status_code=400,
            detail="Confirmation text must match 'CLEAR ALL DATA' to perform database wipe."
        )

    try:
        db.query(Message).delete()
        db.query(Conversation).delete()
        db.query(FollowUpTask).delete()
        db.query(ConsentAuditLog).delete()
        db.query(CustomerInquiry).delete()
        db.query(CampaignActivityLog).delete()
        db.query(CampaignRecipient).delete()
        db.query(Campaign).delete()
        db.execute(customer_tags.delete())
        db.query(Customer).delete()
        db.query(Category).delete()
        db.query(Tag).delete()
        db.query(MessageTemplate).delete()
        db.commit()
        return {"success": True, "message": "All customer, CRM, category, template, and campaign data safely cleared."}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
