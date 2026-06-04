from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.payment_method import PaymentMethod

router = APIRouter(prefix="/payment-methods", tags=["payment-methods"])


class PaymentMethodCreate(BaseModel):
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: bool = False


class PaymentMethodUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: Optional[bool] = None


class PaymentMethodOut(BaseModel):
    id: int
    user_id: int
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: bool

    class Config:
        from_attributes = True


@router.get("", response_model=list[PaymentMethodOut])
def list_payment_methods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(PaymentMethod).filter(PaymentMethod.user_id == current_user.id).all()


@router.post("", response_model=PaymentMethodOut, status_code=201)
def create_payment_method(
    data: PaymentMethodCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pm = PaymentMethod(user_id=current_user.id, **data.model_dump())
    db.add(pm)
    db.commit()
    db.refresh(pm)
    return pm


@router.put("/{pm_id}", response_model=PaymentMethodOut)
def update_payment_method(
    pm_id: int,
    data: PaymentMethodUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id, PaymentMethod.user_id == current_user.id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(pm, field, value)
    db.commit()
    db.refresh(pm)
    return pm


@router.delete("/{pm_id}", status_code=204)
def delete_payment_method(
    pm_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pm = db.query(PaymentMethod).filter(PaymentMethod.id == pm_id, PaymentMethod.user_id == current_user.id).first()
    if not pm:
        raise HTTPException(status_code=404, detail="Payment method not found")
    db.delete(pm)
    db.commit()
