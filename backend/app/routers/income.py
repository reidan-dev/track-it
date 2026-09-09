from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.income import Income, IncomeReceipt
from app.models.deduction import Deduction
from app.schemas.income import IncomeCreate, IncomeUpdate, IncomeOut, IncomeReceiptOut

router = APIRouter(prefix="/income", tags=["income"])


@router.get("", response_model=list[IncomeOut])
def list_income(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Income).filter(Income.user_id == current_user.id)
    if month and year:
        # One-off entries logged for this month, plus every recurring
        # template (regardless of month/year) so the page can show its
        # "mark received" state for the viewed month — same pattern Bills
        # uses (list_bills returns everything, the page filters client-side).
        q = q.filter(or_(
            Income.is_recurring == True,
            (Income.month == month) & (Income.year == year),
        ))
    elif month:
        q = q.filter(Income.month == month)
    elif year:
        q = q.filter(Income.year == year)
    return q.order_by(Income.date.desc()).all()


@router.post("", response_model=IncomeOut, status_code=201)
def create_income(
    data: IncomeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = Income(user_id=current_user.id, **data.model_dump())
    db.add(income)
    db.commit()
    db.refresh(income)
    return income


@router.put("/{income_id}", response_model=IncomeOut)
def update_income(
    income_id: int,
    data: IncomeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = db.query(Income).filter(Income.id == income_id, Income.user_id == current_user.id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income entry not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(income, field, value)
    db.commit()
    db.refresh(income)
    return income


@router.delete("/{income_id}", status_code=204)
def delete_income(
    income_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = db.query(Income).filter(Income.id == income_id, Income.user_id == current_user.id).first()
    if not income:
        raise HTTPException(status_code=404, detail="Income entry not found")
    db.query(Deduction).filter(Deduction.item_type == "income", Deduction.item_id == income_id).delete()
    db.delete(income)
    db.commit()


@router.post("/{income_id}/receive/{month}/{year}", response_model=IncomeReceiptOut)
def receive_income(
    income_id: int,
    month: int,
    year: int,
    period: int = 1,
    amount: Optional[float] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = db.query(Income).filter(
        Income.id == income_id, Income.user_id == current_user.id, Income.is_recurring == True).first()
    if not income:
        raise HTTPException(status_code=404, detail="Recurring income not found")
    receipt = db.query(IncomeReceipt).filter(
        IncomeReceipt.income_id == income_id, IncomeReceipt.month == month, IncomeReceipt.year == year,
    ).first()
    if receipt:
        receipt.period = period
        receipt.amount_received = amount
    else:
        receipt = IncomeReceipt(income_id=income_id, month=month, year=year, period=period, amount_received=amount)
        db.add(receipt)
    db.commit()
    db.refresh(receipt)
    return receipt


@router.delete("/{income_id}/receive/{month}/{year}", status_code=204)
def unreceive_income(
    income_id: int,
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    income = db.query(Income).filter(
        Income.id == income_id, Income.user_id == current_user.id, Income.is_recurring == True).first()
    if not income:
        raise HTTPException(status_code=404, detail="Recurring income not found")
    receipt = db.query(IncomeReceipt).filter(
        IncomeReceipt.income_id == income_id, IncomeReceipt.month == month, IncomeReceipt.year == year,
    ).first()
    if receipt:
        db.delete(receipt)
        db.commit()
