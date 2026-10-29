from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from backend.app.database import get_db
from backend.app.models.models import CustomerInquiry, Customer
from backend.app.schemas.schemas import CustomerInquiryResponse

router = APIRouter(prefix="/inquiries", tags=["Inquiries"])

@router.get("", response_model=List[CustomerInquiryResponse])
def get_inquiries(
    status: Optional[str] = Query(None, description="new, contacted, resolved"),
    inquiry_type: Optional[str] = Query(None, description="enquire, stop, general_reply"),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(CustomerInquiry)
    if status and status != "all":
        query = query.filter(CustomerInquiry.status == status)
    if inquiry_type and inquiry_type != "all":
        query = query.filter(CustomerInquiry.inquiry_type == inquiry_type)
    
    inquiries = query.order_by(desc(CustomerInquiry.created_at)).limit(limit).all()
    return inquiries

@router.get("/counts")
def get_inquiry_counts(db: Session = Depends(get_db)):
    total = db.query(CustomerInquiry).count()
    new_count = db.query(CustomerInquiry).filter(CustomerInquiry.status == "new").count()
    enquire_count = db.query(CustomerInquiry).filter(CustomerInquiry.inquiry_type == "enquire").count()
    stop_count = db.query(CustomerInquiry).filter(CustomerInquiry.inquiry_type == "stop").count()
    return {
        "total": total,
        "new": new_count,
        "enquiries": enquire_count,
        "opt_outs": stop_count
    }

@router.put("/{id}/status")
def update_inquiry_status(id: int, status: str = Query(..., description="new, contacted, resolved"), db: Session = Depends(get_db)):
    inquiry = db.query(CustomerInquiry).filter(CustomerInquiry.id == id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    inquiry.status = status
    inquiry.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Status updated", "id": id, "status": status}

@router.delete("/{id}")
def delete_inquiry(id: int, db: Session = Depends(get_db)):
    inquiry = db.query(CustomerInquiry).filter(CustomerInquiry.id == id).first()
    if not inquiry:
        raise HTTPException(status_code=404, detail="Inquiry not found")
    
    db.delete(inquiry)
    db.commit()
    return {"message": "Inquiry deleted", "id": id}
