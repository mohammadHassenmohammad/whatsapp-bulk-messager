from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from backend.app.database import get_db
from backend.app.models.models import Category, Customer
from backend.app.schemas.schemas import CategoryCreate, CategoryUpdate, CategoryResponse

router = APIRouter(prefix="/categories", tags=["Categories"])

@router.get("", response_model=List[CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    # Query categories with customer count
    results = db.query(
        Category,
        func.count(Customer.id).label("customer_count")
    ).outerjoin(Customer, Customer.category_id == Category.id).group_by(Category.id).order_by(Category.name).all()

    output = []
    for cat, count in results:
        output.append(CategoryResponse(
            id=cat.id,
            name=cat.name,
            description=cat.description,
            color=cat.color or "#10b981",
            customer_count=count,
            created_at=cat.created_at,
            updated_at=cat.updated_at
        ))
    return output

@router.post("", response_model=CategoryResponse)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    cleaned_name = payload.name.strip()
    existing = db.query(Category).filter(func.lower(Category.name) == cleaned_name.lower()).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Category '{cleaned_name}' already exists.")

    cat = Category(
        name=cleaned_name,
        description=payload.description.strip() if payload.description else None,
        color=payload.color or "#10b981"
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)

    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        customer_count=0,
        created_at=cat.created_at,
        updated_at=cat.updated_at
    )

@router.put("/{id}", response_model=CategoryResponse)
def update_category(id: int, payload: CategoryUpdate, db: Session = Depends(get_db)):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    if payload.name:
        cleaned_name = payload.name.strip()
        existing = db.query(Category).filter(
            func.lower(Category.name) == cleaned_name.lower(),
            Category.id != id
        ).first()
        if existing:
            raise HTTPException(status_code=409, detail=f"Category '{cleaned_name}' already exists.")
        cat.name = cleaned_name

    if payload.description is not None:
        cat.description = payload.description.strip() if payload.description else None
    if payload.color is not None:
        cat.color = payload.color

    db.commit()
    db.refresh(cat)

    count = db.query(Customer).filter(Customer.category_id == cat.id).count()
    return CategoryResponse(
        id=cat.id,
        name=cat.name,
        description=cat.description,
        color=cat.color,
        customer_count=count,
        created_at=cat.created_at,
        updated_at=cat.updated_at
    )

@router.delete("/{id}")
def delete_category(
    id: int,
    reassign_to_category_id: Optional[int] = Query(None),
    force_uncategorize: bool = Query(False),
    db: Session = Depends(get_db)
):
    cat = db.query(Category).filter(Category.id == id).first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")

    customer_count = db.query(Customer).filter(Customer.category_id == id).count()
    if customer_count > 0 and not force_uncategorize and not reassign_to_category_id:
        raise HTTPException(
            status_code=400,
            detail=f"Category contains {customer_count} customers. Please reassign them or specify force_uncategorize=true."
        )

    if customer_count > 0:
        if reassign_to_category_id:
            target_cat = db.query(Category).filter(Category.id == reassign_to_category_id).first()
            if not target_cat:
                raise HTTPException(status_code=400, detail="Reassign target category not found")
            db.query(Customer).filter(Customer.category_id == id).update(
                {Customer.category_id: reassign_to_category_id},
                synchronize_session=False
            )
        else:
            db.query(Customer).filter(Customer.category_id == id).update(
                {Customer.category_id: None},
                synchronize_session=False
            )

    db.delete(cat)
    db.commit()
    return {"message": "Category deleted successfully", "id": id, "affected_customers": customer_count}
