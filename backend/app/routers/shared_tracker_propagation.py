from datetime import date
from sqlalchemy.orm import Session
from app.models.income import Income
from app.models.expense import Expense
from app.models.shared_tracker import SharedTrackerRow, SharedTrackerEntry


def propagate_paid(db: Session, user_id: int, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None:
    """Create the real record for entry, matching row.row_type. No-op if row.row_type is None."""
    if row.row_type == "income":
        income = Income(
            user_id=user_id, source=row.label, amount=entry.amount,
            date=date(entry.year, entry.month, 1), type="Other", period=1,
            month=entry.month, year=entry.year,
            participants=entry.participants or [], participant_amounts=entry.participant_amounts or {},
        )
        db.add(income)
        db.commit()
        db.refresh(income)
        entry.linked_record_type = "income"
        entry.linked_record_id = income.id
        db.commit()
    elif row.row_type == "expense":
        expense = Expense(
            user_id=user_id, name=row.label, amount=entry.amount, category=row.label,
            date=date(entry.year, entry.month, 1), period=1,
            month=entry.month, year=entry.year,
            participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {},
        )
        db.add(expense)
        db.commit()
        db.refresh(expense)
        entry.linked_record_type = "expense"
        entry.linked_record_id = expense.id
        db.commit()


def reverse_paid(db: Session, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None:
    """Undo whatever propagate_paid did for this entry. No-op if nothing is linked."""
    if entry.linked_record_type == "income":
        db.query(Income).filter(Income.id == entry.linked_record_id).delete()
    elif entry.linked_record_type == "expense":
        db.query(Expense).filter(Expense.id == entry.linked_record_id).delete()
    entry.linked_record_type = None
    entry.linked_record_id = None
    db.commit()


def sync_paid(db: Session, entry: SharedTrackerEntry) -> None:
    """Push entry's amount/participants/participant_amounts onto its linked record. No-op if nothing is linked."""
    if entry.linked_record_type == "income":
        income = db.query(Income).filter(Income.id == entry.linked_record_id).first()
        if income:
            income.amount = entry.amount
            income.participants = entry.participants or []
            income.participant_amounts = entry.participant_amounts or {}
            db.commit()
    elif entry.linked_record_type == "expense":
        expense = db.query(Expense).filter(Expense.id == entry.linked_record_id).first()
        if expense:
            expense.amount = entry.amount
            expense.participants = entry.participants or [0]
            expense.participant_amounts = entry.participant_amounts or {}
            db.commit()
