from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.models import (
    Campaign, CampaignRecipient, CampaignActivityLog, Customer
)
from backend.app.schemas.schemas import (
    CampaignCreate, CampaignResponse, CampaignDetailResponse,
    CampaignRecipientResponse, CampaignActivityLogResponse, RecipientStatusUpdate
)
from backend.app.services.campaign_service import (
    create_campaign_with_recipients, update_recipient_queue_status,
    select_campaign_recipients
)
from backend.app.services.export_service import generate_csv

router = APIRouter(prefix="/campaigns", tags=["Campaigns"])

@router.get("", response_model=List[CampaignResponse])
def get_campaigns(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Campaign)
    if status and status.strip() and status != "undefined":
        query = query.filter(Campaign.status == status.strip())
    if search and search.strip() and search != "undefined":
        query = query.filter(Campaign.name.ilike(f"%{search.strip()}%"))
    
    return query.order_by(desc(Campaign.created_at)).all()

@router.post("/preview-selection")
def preview_recipient_selection(payload: CampaignCreate, db: Session = Depends(get_db)):
    """Previews eligible and excluded recipients without creating a campaign yet."""
    eligible, excluded = select_campaign_recipients(db, payload)
    return {
        "eligible_count": len(eligible),
        "excluded_count": len(excluded),
        "excluded_details": excluded[:20], # sample
        "sample_recipients": [
            {
                "id": c.id,
                "name": c.full_name,
                "phone": c.phone,
                "formatted_phone": c.formatted_phone,
                "company": c.company or "",
                "category": c.category.name if c.category else "",
                "consent_status": c.consent_status
            }
            for c in eligible[:10]
        ]
    }

@router.post("", response_model=CampaignDetailResponse)
def create_campaign(payload: CampaignCreate, db: Session = Depends(get_db)):
    try:
        campaign, excluded = create_campaign_with_recipients(db, payload)
        db.refresh(campaign)
        return campaign
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{id}", response_model=CampaignDetailResponse)
def get_campaign(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@router.put("/{id}/recipients/{recipient_id}/status", response_model=CampaignRecipientResponse)
def update_recipient_status(
    id: int,
    recipient_id: int,
    payload: RecipientStatusUpdate,
    db: Session = Depends(get_db)
):
    try:
        updated = update_recipient_queue_status(
            db=db,
            campaign_id=id,
            recipient_id=recipient_id,
            new_status=payload.status,
            notes=payload.notes,
            error_message=payload.error_message,
            message_id=payload.message_id
        )
        return updated
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/{id}/cancel")
def cancel_campaign(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    campaign.status = "cancelled"
    log = CampaignActivityLog(
        campaign_id=campaign.id,
        action="cancelled",
        details="Campaign was manually cancelled by the user."
    )
    db.add(log)
    db.commit()
    return {"message": "Campaign cancelled successfully", "status": "cancelled"}

@router.delete("/{id}")
def delete_campaign(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    db.delete(campaign)
    db.commit()
    return {"message": "Campaign and history deleted successfully"}

@router.get("/{id}/export/csv")
def export_campaign_report(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    fieldnames = [
        "recipient_name", "recipient_phone", "recipient_company", "recipient_category",
        "status", "opened_at", "confirmed_sent_at", "skipped_at", "error_message", "notes"
    ]
    rows = []
    for r in campaign.recipients:
        rows.append({
            "recipient_name": r.recipient_name,
            "recipient_phone": r.recipient_phone,
            "recipient_company": r.recipient_company or "",
            "recipient_category": r.recipient_category or "",
            "status": r.status,
            "opened_at": r.opened_at.isoformat() if r.opened_at else "",
            "confirmed_sent_at": r.confirmed_sent_at.isoformat() if r.confirmed_sent_at else "",
            "skipped_at": r.skipped_at.isoformat() if r.skipped_at else "",
            "error_message": r.error_message or "",
            "notes": r.notes or ""
        })

    csv_data = generate_csv(rows, fieldnames)
    safe_name = campaign.name.replace(" ", "_").lower()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=campaign_{safe_name}_report.csv"}
    )

@router.post("/{id}/retry-failed")
def retry_failed_recipients(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    failed_recipients = db.query(CampaignRecipient).filter(
        CampaignRecipient.campaign_id == id,
        CampaignRecipient.status == "failed"
    ).all()

    if not failed_recipients:
        return {"success": True, "message": "No failed recipients to reset.", "count": 0}

    for r in failed_recipients:
        r.status = "prepared"
        r.error_message = None

    campaign.status = "in_progress"
    campaign.failed_count = 0
    log = CampaignActivityLog(
        campaign_id=campaign.id,
        action="retry_failed",
        details=f"Reset {len(failed_recipients)} failed recipients back to prepared queue."
    )
    db.add(log)
    db.commit()

    return {
        "success": True,
        "message": f"Reset {len(failed_recipients)} failed recipients for retry.",
        "count": len(failed_recipients)
    }

@router.get("/{id}/pending")
def get_pending_recipients(id: int, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    pending = db.query(CampaignRecipient).filter(
        CampaignRecipient.campaign_id == id,
        CampaignRecipient.status.in_(["prepared", "opened"])
    ).all()

    return {
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "campaign_status": campaign.status,
        "pending_count": len(pending),
        "pending_recipients": [
            {
                "id": r.id,
                "name": r.recipient_name,
                "phone": r.recipient_phone,
                "status": r.status,
                "message": r.personalized_message,
                "media_url": r.media_url
            }
            for r in pending
        ]
    }
