from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.income import Income
from app.schemas.income import IncomeCreate, IncomeUpdate, IncomeOut

router = APIRouter(prefix="/income", tags=["income"])


@router.get("", response_model=list[IncomeOut])
def list_income(
    month: Optional[int] = None,
    year: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Income).filter(Income.user_id == current_user.id)
    if month:
        q = q.filter(Income.month == month)
    if year:
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
    db.delete(income)
    db.commit()
