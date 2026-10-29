from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.database import get_db
from backend.app.models.models import MessageTemplate
from backend.app.schemas.schemas import TemplateCreate, TemplateUpdate, TemplateResponse
from backend.app.services.template_service import extract_variables, render_template

router = APIRouter(prefix="/templates", tags=["Templates"])

@router.get("", response_model=List[TemplateResponse])
def get_templates(search: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(MessageTemplate)
    if search:
        query = query.filter(MessageTemplate.name.ilike(f"%{search.strip()}%"))
    templates = query.order_by(MessageTemplate.name).all()

    output = []
    for t in templates:
        output.append(TemplateResponse(
            id=t.id,
            name=t.name,
            body=t.body,
            description=t.description,
            category=t.category,
            header_type=t.header_type or "none",
            header_media_url=t.header_media_url,
            buttons_json=t.buttons_json,
            variables=extract_variables(t.body),
            created_at=t.created_at,
            updated_at=t.updated_at
        ))
    return output

@router.post("", response_model=TemplateResponse)
def create_template(payload: TemplateCreate, db: Session = Depends(get_db)):
    t = MessageTemplate(
        name=payload.name.strip(),
        body=payload.body.strip(),
        description=payload.description.strip() if payload.description else None,
        category=payload.category.strip() if payload.category else None,
        header_type=payload.header_type or "none",
        header_media_url=payload.header_media_url.strip() if payload.header_media_url else None,
        buttons_json=payload.buttons_json if payload.buttons_json else None
    )
    db.add(t)
    db.commit()
    db.refresh(t)

    return TemplateResponse(
        id=t.id,
        name=t.name,
        body=t.body,
        description=t.description,
        category=t.category,
        header_type=t.header_type or "none",
        header_media_url=t.header_media_url,
        buttons_json=t.buttons_json,
        variables=extract_variables(t.body),
        created_at=t.created_at,
        updated_at=t.updated_at
    )

@router.get("/{id}", response_model=TemplateResponse)
def get_template(id: int, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    return TemplateResponse(
        id=t.id,
        name=t.name,
        body=t.body,
        description=t.description,
        category=t.category,
        header_type=t.header_type or "none",
        header_media_url=t.header_media_url,
        buttons_json=t.buttons_json,
        variables=extract_variables(t.body),
        created_at=t.created_at,
        updated_at=t.updated_at
    )

@router.put("/{id}", response_model=TemplateResponse)
def update_template(id: int, payload: TemplateUpdate, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.name is not None:
        t.name = payload.name.strip()
    if payload.body is not None:
        t.body = payload.body.strip()
    if payload.description is not None:
        t.description = payload.description.strip() if payload.description else None
    if payload.category is not None:
        t.category = payload.category.strip() if payload.category else None
    if payload.header_type is not None:
        t.header_type = payload.header_type
    if payload.header_media_url is not None:
        t.header_media_url = payload.header_media_url.strip() if payload.header_media_url else None
    if payload.buttons_json is not None:
        t.buttons_json = payload.buttons_json

    db.commit()
    db.refresh(t)

    return TemplateResponse(
        id=t.id,
        name=t.name,
        body=t.body,
        description=t.description,
        category=t.category,
        header_type=t.header_type or "none",
        header_media_url=t.header_media_url,
        buttons_json=t.buttons_json,
        variables=extract_variables(t.body),
        created_at=t.created_at,
        updated_at=t.updated_at
    )

@router.post("/{id}/duplicate", response_model=TemplateResponse)
def duplicate_template(id: int, db: Session = Depends(get_db)):
    original = db.query(MessageTemplate).filter(MessageTemplate.id == id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Template not found")

    copy_name = f"{original.name} (Copy)"
    new_t = MessageTemplate(
        name=copy_name,
        body=original.body,
        description=original.description,
        category=original.category
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)

    return TemplateResponse(
        id=new_t.id,
        name=new_t.name,
        body=new_t.body,
        description=new_t.description,
        category=new_t.category,
        variables=extract_variables(new_t.body),
        created_at=new_t.created_at,
        updated_at=new_t.updated_at
    )

@router.delete("/{id}")
def delete_template(id: int, db: Session = Depends(get_db)):
    t = db.query(MessageTemplate).filter(MessageTemplate.id == id).first()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    db.delete(t)
    db.commit()
    return {"message": "Template deleted successfully", "id": id}

@router.post("/preview")
def preview_message(payload: dict):
    template_body = payload.get("body", "")
    sample_context = payload.get("context", {
        "name": "Jane Doe",
        "company": "Acme Inc.",
        "category": "VIP Customers",
        "phone": "+1 555 123 4567"
    })
    rendered, missing = render_template(template_body, sample_context)
    return {
        "rendered": rendered,
        "character_count": len(rendered),
        "variables_found": extract_variables(template_body),
        "missing_variables": missing
    }
