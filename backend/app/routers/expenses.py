from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense, ExpenseParticipantSettlement
from app.schemas.expense import ExpenseCreate, ExpenseUpdate, ExpenseOut

router = APIRouter(prefix="/expenses", tags=["expenses"])


@router.get("", response_model=list[ExpenseOut])
def list_expenses(
    month: Optional[int] = None,
    year: Optional[int] = None,
    period: Optional[int] = None,
    category: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(Expense).filter(Expense.user_id == current_user.id)
    if month:
        q = q.filter(Expense.month == month)
    if year:
        q = q.filter(Expense.year == year)
    if period:
        q = q.filter(Expense.period == period)
    if category:
        q = q.filter(Expense.category == category)
    return q.order_by(Expense.date.desc()).all()


@router.post("", response_model=ExpenseOut, status_code=201)
def create_expense(
    data: ExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = Expense(user_id=current_user.id, **data.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.put("/{expense_id}", response_model=ExpenseOut)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=204)
def delete_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()


@router.post("/{expense_id}/settle/{person_id}/{month}/{year}", response_model=ExpenseOut)
def settle_expense_participant(
    expense_id: int,
    person_id: int,
    month: int,
    year: int,
    period: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    q = db.query(ExpenseParticipantSettlement).filter(
        ExpenseParticipantSettlement.expense_id == expense_id,
        ExpenseParticipantSettlement.person_id == person_id,
        ExpenseParticipantSettlement.month == month,
        ExpenseParticipantSettlement.year == year,
    )
    q = q.filter(ExpenseParticipantSettlement.period == period) if period is not None else q.filter(ExpenseParticipantSettlement.period.is_(None))
    if not q.first():
        db.add(ExpenseParticipantSettlement(
            expense_id=expense_id, person_id=person_id, month=month, year=year, period=period,
        ))
        db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}/settle/{person_id}/{month}/{year}", response_model=ExpenseOut)
def unsettle_expense_participant(
    expense_id: int,
    person_id: int,
    month: int,
    year: int,
    period: Optional[int] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    q = db.query(ExpenseParticipantSettlement).filter(
        ExpenseParticipantSettlement.expense_id == expense_id,
        ExpenseParticipantSettlement.person_id == person_id,
        ExpenseParticipantSettlement.month == month,
        ExpenseParticipantSettlement.year == year,
    )
    q = q.filter(ExpenseParticipantSettlement.period == period) if period is not None else q.filter(ExpenseParticipantSettlement.period.is_(None))
    row = q.first()
    if row:
        db.delete(row)
        db.commit()
    db.refresh(expense)
    return expense
