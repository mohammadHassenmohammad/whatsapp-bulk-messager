import math
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Form, Response
from sqlalchemy.orm import Session
from sqlalchemy import or_, desc, asc

from backend.app.database import get_db
from backend.app.models.models import Customer, Category, ConsentAuditLog
from backend.app.schemas.schemas import (
    CustomerCreate, CustomerUpdate, CustomerResponse, CustomerListResponse,
    ImportPreviewResponse, ColumnMapping, ImportConfirmRequest, ImportResult
)
from backend.app.services.phone_service import normalize_phone
from backend.app.services.import_service import (
    save_uploaded_file, preview_import_file, process_import
)
from backend.app.services.export_service import generate_csv

router = APIRouter(prefix="/customers", tags=["Customers"])

@router.get("", response_model=CustomerListResponse)
def get_customers(
    search: Optional[str] = None,
    category_id: Optional[int] = None,
    consent_status: Optional[str] = None,
    lead_stage: Optional[str] = None,
    tag: Optional[str] = None,
    is_suppressed: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    db: Session = Depends(get_db)
):
    query = db.query(Customer)

    if search:
        search_fmt = f"%{search.strip()}%"
        query = query.filter(
            or_(
                Customer.full_name.ilike(search_fmt),
                Customer.phone.ilike(search_fmt),
                Customer.company.ilike(search_fmt),
                Customer.email.ilike(search_fmt)
            )
        )

    if category_id is not None:
        if category_id == 0:
            query = query.filter(Customer.category_id.is_(None))
        else:
            query = query.filter(Customer.category_id == category_id)

    if consent_status:
        query = query.filter(Customer.consent_status == consent_status)

    if lead_stage and lead_stage != "all":
        query = query.filter(Customer.lead_stage == lead_stage)

    if tag:
        query = query.filter(Customer.tags.ilike(f"%{tag.strip()}%"))

    if is_suppressed is not None:
        query = query.filter(Customer.is_suppressed == is_suppressed)

    total = query.count()

    # Sort
    col_attr = getattr(Customer, sort_by, Customer.created_at)
    if sort_order.lower() == "asc":
        query = query.order_by(asc(col_attr))
    else:
        query = query.order_by(desc(col_attr))

    items = query.offset((page - 1) * page_size).limit(page_size).all()

    response_items = []
    for c in items:
        resp = CustomerResponse(
            id=c.id,
            full_name=c.full_name,
            phone=c.phone,
            formatted_phone=c.formatted_phone,
            email=c.email,
            category_id=c.category_id,
            category_name=c.category.name if c.category else None,
            company=c.company,
            tags=c.tags,
            lead_stage=c.lead_stage or "New",
            consent_status=c.consent_status,
            consent_source=c.consent_source,
            consent_date=c.consent_date,
            is_suppressed=c.is_suppressed,
            notes=c.notes,
            created_at=c.created_at,
            updated_at=c.updated_at
        )
        response_items.append(resp)

    return CustomerListResponse(
        items=response_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=math.ceil(total / page_size) if total > 0 else 1
    )

@router.post("", response_model=CustomerResponse)
def create_customer(payload: CustomerCreate, db: Session = Depends(get_db)):
    # Validate phone
    norm = normalize_phone(payload.phone, payload.default_country_code or "1")
    if not norm["is_valid"]:
        raise HTTPException(status_code=400, detail=norm["error"])

    # Check duplicate phone
    existing = db.query(Customer).filter(Customer.phone == norm["normalized"]).first()
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Customer with phone number {norm['formatted']} already exists ({existing.full_name})."
        )

    # Validate category if provided
    if payload.category_id:
        cat = db.query(Category).filter(Category.id == payload.category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category ID")

    cust = Customer(
        full_name=payload.full_name.strip(),
        phone=norm["normalized"],
        formatted_phone=norm["formatted"],
        email=payload.email.strip() if payload.email else None,
        category_id=payload.category_id,
        company=payload.company.strip() if payload.company else None,
        tags=payload.tags.strip() if payload.tags else None,
        consent_status=payload.consent_status or "unverified",
        consent_source=payload.consent_source or "Manual Entry",
        consent_date=payload.consent_date,
        is_suppressed=payload.is_suppressed or (payload.consent_status == "opted_out"),
        notes=payload.notes.strip() if payload.notes else None
    )
    db.add(cust)
    db.commit()
    db.refresh(cust)

    return CustomerResponse(
        id=cust.id,
        full_name=cust.full_name,
        phone=cust.phone,
        formatted_phone=cust.formatted_phone,
        email=cust.email,
        category_id=cust.category_id,
        category_name=cust.category.name if cust.category else None,
        company=cust.company,
        tags=cust.tags,
        consent_status=cust.consent_status,
        consent_source=cust.consent_source,
        consent_date=cust.consent_date,
        is_suppressed=cust.is_suppressed,
        notes=cust.notes,
        created_at=cust.created_at,
        updated_at=cust.updated_at
    )

@router.get("/{id}", response_model=CustomerResponse)
def get_customer(id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    return CustomerResponse(
        id=cust.id,
        full_name=cust.full_name,
        phone=cust.phone,
        formatted_phone=cust.formatted_phone,
        email=cust.email,
        category_id=cust.category_id,
        category_name=cust.category.name if cust.category else None,
        company=cust.company,
        tags=cust.tags,
        consent_status=cust.consent_status,
        consent_source=cust.consent_source,
        consent_date=cust.consent_date,
        is_suppressed=cust.is_suppressed,
        notes=cust.notes,
        created_at=cust.created_at,
        updated_at=cust.updated_at
    )

@router.put("/{id}", response_model=CustomerResponse)
def update_customer(id: int, payload: CustomerUpdate, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.phone:
        norm = normalize_phone(payload.phone, payload.default_country_code or "1")
        if not norm["is_valid"]:
            raise HTTPException(status_code=400, detail=norm["error"])
        # Check duplicate if phone is changing
        if norm["normalized"] != cust.phone:
            dup = db.query(Customer).filter(Customer.phone == norm["normalized"]).first()
            if dup:
                raise HTTPException(status_code=409, detail=f"Phone number already used by {dup.full_name}")
            cust.phone = norm["normalized"]
            cust.formatted_phone = norm["formatted"]

    if payload.full_name is not None:
        cust.full_name = payload.full_name.strip()
    if payload.email is not None:
        cust.email = payload.email.strip() if payload.email else None
    if payload.company is not None:
        cust.company = payload.company.strip() if payload.company else None
    if payload.category_id is not None:
        if payload.category_id == 0:
            cust.category_id = None
        else:
            cat = db.query(Category).filter(Category.id == payload.category_id).first()
            if not cat:
                raise HTTPException(status_code=400, detail="Invalid category ID")
            cust.category_id = payload.category_id
    if payload.tags is not None:
        cust.tags = payload.tags.strip() if payload.tags else None
    if payload.consent_status is not None and payload.consent_status != cust.consent_status:
        old_status = cust.consent_status
        new_status = payload.consent_status
        cust.consent_status = new_status
        if new_status == "opted_out":
            cust.is_suppressed = True
        elif new_status == "verified":
            cust.is_suppressed = False
            cust.consent_date = datetime.now(timezone.utc)

        audit_entry = ConsentAuditLog(
            customer_id=cust.id,
            phone=cust.phone,
            action="consent_updated",
            previous_status=old_status,
            new_status=new_status,
            source=payload.consent_source or "Manual UI Update",
            reason=f"Consent manually updated to {new_status}"
        )
        db.add(audit_entry)

    if payload.consent_source is not None:
        cust.consent_source = payload.consent_source
    if payload.consent_date is not None:
        cust.consent_date = payload.consent_date
    if payload.is_suppressed is not None and payload.is_suppressed != cust.is_suppressed:
        cust.is_suppressed = payload.is_suppressed
        if cust.is_suppressed and cust.consent_status != "opted_out":
            cust.consent_status = "opted_out"
            audit_entry = ConsentAuditLog(
                customer_id=cust.id,
                phone=cust.phone,
                action="suppressed",
                previous_status=cust.consent_status,
                new_status="opted_out",
                source="Manual UI Suppression",
                reason="Customer suppressed manually"
            )
            db.add(audit_entry)
    if payload.notes is not None:
        cust.notes = payload.notes.strip() if payload.notes else None

    db.commit()
    db.refresh(cust)

    return CustomerResponse(
        id=cust.id,
        full_name=cust.full_name,
        phone=cust.phone,
        formatted_phone=cust.formatted_phone,
        email=cust.email,
        category_id=cust.category_id,
        category_name=cust.category.name if cust.category else None,
        company=cust.company,
        tags=cust.tags,
        consent_status=cust.consent_status,
        consent_source=cust.consent_source,
        consent_date=cust.consent_date,
        is_suppressed=cust.is_suppressed,
        notes=cust.notes,
        created_at=cust.created_at,
        updated_at=cust.updated_at
    )

@router.delete("/{id}")
def delete_customer(id: int, db: Session = Depends(get_db)):
    cust = db.query(Customer).filter(Customer.id == id).first()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(cust)
    db.commit()
    return {"message": "Customer deleted successfully", "id": id}

@router.post("/import/upload", response_model=ImportPreviewResponse)
async def upload_import_file(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    content = await file.read()
    if len(content) > 10 * 1024 * 1024: # 10MB limit
        raise HTTPException(status_code=400, detail="File size exceeds 10MB limit")
    try:
        saved_name = save_uploaded_file(content, file.filename)
        preview_data = preview_import_file(saved_name)
        return preview_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/import/confirm", response_model=ImportResult)
def confirm_import(payload: ImportConfirmRequest, db: Session = Depends(get_db)):
    try:
        result = process_import(
            db=db,
            unique_filename=payload.filename,
            mappings=payload.mappings,
            default_country_code=payload.default_country_code,
            default_category_id=payload.default_category_id,
            default_consent_status=payload.default_consent_status,
            on_duplicate=payload.on_duplicate
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/export/csv")
def export_customers_csv(
    category_id: Optional[int] = None,
    consent_status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Customer)
    if category_id:
        query = query.filter(Customer.category_id == category_id)
    if consent_status:
        query = query.filter(Customer.consent_status == consent_status)
    customers = query.order_by(Customer.full_name).all()

    fieldnames = [
        "id", "full_name", "phone", "formatted_phone", "email",
        "company", "category", "tags", "consent_status", "consent_source", "is_suppressed", "notes"
    ]
    rows = []
    for c in customers:
        rows.append({
            "id": c.id,
            "full_name": c.full_name,
            "phone": c.phone,
            "formatted_phone": c.formatted_phone,
            "email": c.email or "",
            "company": c.company or "",
            "category": c.category.name if c.category else "",
            "tags": c.tags or "",
            "consent_status": c.consent_status,
            "consent_source": c.consent_source or "",
            "is_suppressed": "Yes" if c.is_suppressed else "No",
            "notes": c.notes or ""
        })

    csv_data = generate_csv(rows, fieldnames)
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=customers_export.csv"}
    )

@router.post("/bulk/categorize")
def bulk_categorize(payload: dict, db: Session = Depends(get_db)):
    customer_ids = payload.get("customer_ids", [])
    category_id = payload.get("category_id")
    if not customer_ids:
        raise HTTPException(status_code=400, detail="No customer IDs provided")
    
    if category_id:
        cat = db.query(Category).filter(Category.id == category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Category not found")

    updated = db.query(Customer).filter(Customer.id.in_(customer_ids)).update(
        {Customer.category_id: category_id if category_id else None},
        synchronize_session=False
    )
    db.commit()
    return {"updated_count": updated}

@router.post("/bulk/consent")
def bulk_update_consent(payload: dict, db: Session = Depends(get_db)):
    customer_ids = payload.get("customer_ids", [])
    consent_status = payload.get("consent_status", "unverified")
    allow_unsuppress_opted_out = bool(payload.get("confirm_opt_in", False))
    if not customer_ids:
        raise HTTPException(status_code=400, detail="No customer IDs provided")

    is_suppressed = (consent_status == "opted_out")
    now = datetime.now(timezone.utc)
    
    customers_to_update = db.query(Customer).filter(Customer.id.in_(customer_ids)).all()
    updated_count = 0

    for cust in customers_to_update:
        # Non-negotiable safeguard: do not silently unsuppress an opted-out contact unless explicit confirm_opt_in is passed
        if cust.consent_status == "opted_out" and consent_status != "opted_out" and not allow_unsuppress_opted_out:
            continue

        old_status = cust.consent_status
        cust.consent_status = consent_status
        cust.is_suppressed = is_suppressed
        if consent_status == "verified":
            cust.consent_date = now

        audit = ConsentAuditLog(
            customer_id=cust.id,
            phone=cust.phone,
            action="bulk_consent_updated",
            previous_status=old_status,
            new_status=consent_status,
            source="Bulk Consent Update",
            reason=f"Bulk action set status to {consent_status}"
        )
        db.add(audit)
        updated_count += 1

    db.commit()
    return {"updated_count": updated_count}

@router.post("/bulk/delete")
def bulk_delete(payload: dict, db: Session = Depends(get_db)):
    customer_ids = payload.get("customer_ids", [])
    if not customer_ids:
        raise HTTPException(status_code=400, detail="No customer IDs provided")

    deleted = db.query(Customer).filter(Customer.id.in_(customer_ids)).delete(synchronize_session=False)
    db.commit()
    return {"deleted_count": deleted}
