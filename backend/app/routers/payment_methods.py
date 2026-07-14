from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from sqlalchemy import func
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense
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
    balance: Optional[float] = None  # setting this re-anchors balance_updated_at


class PaymentMethodOut(BaseModel):
    id: int
    user_id: int
    name: str
    icon: Optional[str] = None
    color: Optional[str] = None
    is_default: bool
    balance: Optional[float] = None            # anchor snapshot as entered
    current_balance: Optional[float] = None    # anchor minus spend since anchor
    spent_since_anchor: Optional[float] = None

    class Config:
        from_attributes = True


def _with_balance(db, pm):
    out = PaymentMethodOut.model_validate(pm)
    if pm.balance is None:
        return out
    anchor = (pm.balance_updated_at or datetime.utcnow()).date()
    spent = db.query(func.sum(Expense.amount)).filter(
        Expense.user_id == pm.user_id,
        Expense.payment_method == pm.name,
        Expense.date >= anchor,
        # Expenses someone else fronted didn't leave this account.
        (Expense.paid_by == None) | (Expense.paid_by == 0),  # noqa: E711
    ).scalar() or 0
    out.spent_since_anchor = round(float(spent), 2)
    out.current_balance = round(float(pm.balance) - float(spent), 2)
    return out


@router.get("", response_model=list[PaymentMethodOut])
def list_payment_methods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    pms = db.query(PaymentMethod).filter(PaymentMethod.user_id == current_user.id).all()
    return [_with_balance(db, pm) for pm in pms]


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
    update = data.model_dump(exclude_unset=True)
    if "balance" in update:
        pm.balance_updated_at = datetime.utcnow()
    for field, value in update.items():
        setattr(pm, field, value)
    db.commit()
    db.refresh(pm)
    return _with_balance(db, pm)


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
