import os
import shutil
import uuid
from typing import Dict, Any, List, Optional
import pandas as pd
from sqlalchemy.orm import Session
from datetime import datetime

from backend.app.models.models import Customer, Category
from backend.app.services.phone_service import normalize_phone
from backend.app.schemas.schemas import ColumnMapping, ImportResult

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

def detect_column_mappings(headers: List[str]) -> Dict[str, str]:
    """Smart auto-detection of column headers to customer fields."""
    mappings = {
        "name_col": "",
        "phone_col": "",
        "email_col": "",
        "company_col": "",
        "category_col": "",
        "tags_col": "",
        "consent_status_col": "",
        "notes_col": ""
    }
    
    for h in headers:
        hl = str(h).strip().lower().replace("_", " ").replace("-", " ")
        if not mappings["phone_col"] and any(k in hl for k in ["phone", "mobile", "whatsapp", "cell", "tel", "contact num", "number"]):
            mappings["phone_col"] = h
        elif not mappings["name_col"] and any(k in hl for k in ["name", "full name", "customer", "client", "contact"]):
            mappings["name_col"] = h
        elif not mappings["email_col"] and any(k in hl for k in ["email", "mail", "e-mail"]):
            mappings["email_col"] = h
        elif not mappings["company_col"] and any(k in hl for k in ["company", "business", "org", "workplace"]):
            mappings["company_col"] = h
        elif not mappings["category_col"] and any(k in hl for k in ["category", "group", "segment", "type"]):
            mappings["category_col"] = h
        elif not mappings["tags_col"] and any(k in hl for k in ["tag", "tags", "label"]):
            mappings["tags_col"] = h
        elif not mappings["consent_status_col"] and any(k in hl for k in ["consent", "opt-in", "optin", "permission"]):
            mappings["consent_status_col"] = h
        elif not mappings["notes_col"] and any(k in hl for k in ["note", "notes", "comment", "remarks"]):
            mappings["notes_col"] = h

    return mappings

def save_uploaded_file(file_bytes: bytes, filename: str) -> str:
    """Saves file to secure temp uploads folder and returns unique file token."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in [".csv", ".xlsx", ".xls"]:
        raise ValueError("Invalid file extension. Only CSV and Excel (.xlsx, .xls) files are supported.")
    
    unique_name = f"{uuid.uuid4().hex}{ext}"
    target_path = os.path.join(UPLOAD_DIR, unique_name)
    with open(target_path, "wb") as f:
        f.write(file_bytes)
    return unique_name

def read_file_dataframe(unique_filename: str) -> pd.DataFrame:
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    if not os.path.exists(file_path):
        raise FileNotFoundError("Import file not found or expired")
    
    ext = os.path.splitext(unique_filename)[1].lower()
    if ext == ".csv":
        try:
            df = pd.read_csv(file_path, dtype=str, keep_default_na=False)
        except Exception:
            df = pd.read_csv(file_path, encoding="latin1", dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(file_path, dtype=str, keep_default_na=False)
    
    return df

def preview_import_file(unique_filename: str) -> Dict[str, Any]:
    df = read_file_dataframe(unique_filename)
    headers = [str(col).strip() for col in df.columns]
    sample_rows = df.head(5).to_dict(orient="records")
    detected = detect_column_mappings(headers)
    
    return {
        "filename": unique_filename,
        "total_rows": len(df),
        "headers": headers,
        "sample_rows": sample_rows,
        "detected_mappings": detected
    }

def process_import(
    db: Session,
    unique_filename: str,
    mappings: ColumnMapping,
    default_country_code: str = "1",
    default_category_id: Optional[int] = None,
    default_consent_status: str = "unverified",
    on_duplicate: str = "skip"
) -> ImportResult:
    df = read_file_dataframe(unique_filename)
    
    phone_col = mappings.phone_col
    name_col = mappings.name_col
    email_col = mappings.email_col
    company_col = mappings.company_col
    category_col = mappings.category_col
    tags_col = mappings.tags_col
    consent_col = mappings.consent_status_col
    notes_col = mappings.notes_col

    imported = 0
    updated = 0
    skipped = 0
    failed = 0
    errors = []

    # Map category cache
    categories_by_name = {c.name.lower(): c.id for c in db.query(Category).all()}
    seen_in_batch = set()

    for idx, row in df.iterrows():
        row_num = idx + 2 # Accounting for header and 0-indexing
        
        raw_phone = str(row.get(phone_col, "")).strip() if phone_col and phone_col in row else ""
        if not raw_phone:
            failed += 1
            errors.append({"row": row_num, "reason": "Missing phone number"})
            continue

        norm = normalize_phone(raw_phone, default_country_code)
        if not norm["is_valid"]:
            failed += 1
            errors.append({"row": row_num, "phone": raw_phone, "reason": norm["error"]})
            continue

        normalized_phone = norm["normalized"]
        formatted_phone = norm["formatted"]

        # Duplicate within this same file batch
        if normalized_phone in seen_in_batch:
            skipped += 1
            errors.append({"row": row_num, "phone": raw_phone, "reason": "Duplicate phone number in import file"})
            continue
        seen_in_batch.add(normalized_phone)

        # Name
        raw_name = str(row.get(name_col, "")).strip() if name_col and name_col in row else ""
        if not raw_name:
            raw_name = f"Contact {formatted_phone}"

        # Category resolution
        cat_id = default_category_id
        if category_col and category_col in row:
            cat_val = str(row.get(category_col, "")).strip()
            if cat_val:
                cat_lower = cat_val.lower()
                if cat_lower in categories_by_name:
                    cat_id = categories_by_name[cat_lower]
                else:
                    new_cat = Category(name=cat_val)
                    db.add(new_cat)
                    db.flush()
                    categories_by_name[cat_lower] = new_cat.id
                    cat_id = new_cat.id

        # Consent status
        consent_status = default_consent_status or "unverified"
        if consent_col and consent_col in row:
            c_val = str(row.get(consent_col, "")).strip().lower()
            if c_val in ["verified", "yes", "true", "opted-in", "opted_in", "1"]:
                consent_status = "verified"
            elif c_val in ["opted_out", "opted-out", "no", "false", "unsubscribed"]:
                consent_status = "opted_out"
            elif c_val:
                consent_status = "unverified"

        is_suppressed = (consent_status == "opted_out")

        # Optional fields
        email_val = str(row.get(email_col, "")).strip() if email_col and email_col in row else None
        company_val = str(row.get(company_col, "")).strip() if company_col and company_col in row else None
        tags_val = str(row.get(tags_col, "")).strip() if tags_col and tags_col in row else None
        notes_val = str(row.get(notes_col, "")).strip() if notes_col and notes_col in row else None

        # Check existing customer in DB
        existing = db.query(Customer).filter(Customer.phone == normalized_phone).first()
        if existing:
            if on_duplicate == "update":
                existing.full_name = raw_name
                existing.formatted_phone = formatted_phone
                if email_val: existing.email = email_val
                if company_val: existing.company = company_val
                if cat_id: existing.category_id = cat_id
                if tags_val: existing.tags = tags_val
                if notes_val: existing.notes = notes_val
                existing.consent_status = consent_status
                existing.is_suppressed = is_suppressed
                existing.updated_at = datetime.utcnow()
                updated += 1
            else:
                skipped += 1
                errors.append({"row": row_num, "phone": raw_phone, "reason": "Already exists in database (skipped)"})
        else:
            new_cust = Customer(
                full_name=raw_name,
                phone=normalized_phone,
                formatted_phone=formatted_phone,
                email=email_val or None,
                category_id=cat_id,
                company=company_val or None,
                tags=tags_val or None,
                consent_status=consent_status,
                consent_source="Import",
                consent_date=datetime.utcnow() if consent_status == "verified" else None,
                is_suppressed=is_suppressed,
                notes=notes_val or None
            )
            db.add(new_cust)
            imported += 1

    db.commit()

    # Clean up temp file
    try:
        file_path = os.path.join(UPLOAD_DIR, unique_filename)
        if os.path.exists(file_path):
            os.remove(file_path)
    except Exception:
        pass

    return ImportResult(
        total_processed=len(df),
        imported_count=imported,
        updated_count=updated,
        skipped_count=skipped,
        failed_count=failed,
        errors=errors
    )
