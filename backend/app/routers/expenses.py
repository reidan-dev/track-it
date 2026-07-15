from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense, ExpenseParticipantSettlement
from app.models.deduction import Deduction
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


@router.get("/search", response_model=list[ExpenseOut])
def search_expenses(
    q: Optional[str] = None,
    category: Optional[str] = None,
    person_id: Optional[int] = None,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Cross-month search: text over name/note, plus category/person filters."""
    query = db.query(Expense).filter(Expense.user_id == current_user.id)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Expense.name.ilike(like) | Expense.note.ilike(like))
    if category:
        query = query.filter(Expense.category == category)
    rows = query.order_by(Expense.date.desc()).limit(min(max(limit, 1), 500)).all()
    if person_id is not None:
        # participants is a JSON list; containment is dialect-specific, so
        # filter in Python — personal-scale data keeps this cheap.
        rows = [
            e for e in rows
            if person_id in (e.participants or []) or e.paid_by == person_id or e.payable_to == person_id
        ]
    return rows


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


@router.get("/{expense_id}/receipt")
def get_expense_receipt(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(Expense).filter(Expense.id == expense_id, Expense.user_id == current_user.id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    if not expense.receipt_image:
        raise HTTPException(status_code=404, detail="No receipt attached")
    return {"receipt_image": expense.receipt_image}


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
    db.query(Deduction).filter(Deduction.item_type == "expense", Deduction.item_id == expense_id).delete()
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
