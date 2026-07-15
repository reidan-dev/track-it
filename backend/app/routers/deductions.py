from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.deduction import Deduction
from app.models.bill import Bill
from app.models.installment import Installment
from app.models.expense import Expense
from app.schemas.deduction import DeductionCreate, DeductionOut

router = APIRouter(prefix="/deductions", tags=["deductions"])

ITEM_MODELS = {"bill": Bill, "installment": Installment, "expense": Expense}


def _owned_item(db, user, item_type, item_id):
    model = ITEM_MODELS.get(item_type)
    if not model:
        raise HTTPException(status_code=400, detail="item_type must be bill, installment or expense")
    item = db.query(model).filter(model.id == item_id, model.user_id == user.id).first()
    if not item:
        raise HTTPException(status_code=404, detail=f"{item_type.capitalize()} not found")
    return item


@router.get("", response_model=list[DeductionOut])
def list_deductions(
    month: int,
    year: int,
    item_type: Optional[str] = None,
    item_id: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Deduction).filter(
        Deduction.user_id == current_user.id,
        Deduction.month == month,
        Deduction.year == year,
    )
    if item_type:
        q = q.filter(Deduction.item_type == item_type)
    if item_id is not None:
        q = q.filter(Deduction.item_id == item_id)
    return q.order_by(Deduction.created_at).all()


@router.post("", response_model=DeductionOut, status_code=201)
def create_deduction(
    data: DeductionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Amount must be positive")
    item = _owned_item(db, current_user, data.item_type, data.item_id)
    payload = data.model_dump()
    # Expense deductions are pinned to the expense's own month; no periods.
    if data.item_type == "expense":
        payload.update(month=item.month, year=item.year, period=None)
    ded = Deduction(user_id=current_user.id, **payload)
    db.add(ded)
    db.commit()
    db.refresh(ded)
    return ded


@router.delete("/{ded_id}", status_code=204)
def delete_deduction(
    ded_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ded = db.query(Deduction).filter(
        Deduction.id == ded_id, Deduction.user_id == current_user.id).first()
    if not ded:
        raise HTTPException(status_code=404, detail="Deduction not found")
    db.delete(ded)
    db.commit()
