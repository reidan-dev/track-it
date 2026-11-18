from datetime import date
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.models.income import Income
from app.models.expense import Expense
from app.models.bill import Bill, BillPayment
from app.models.installment import Installment, InstallmentPayment
from app.models.deduction import Deduction
from app.models.shared_tracker import SharedTrackerRow, SharedTrackerEntry


def propagate_paid(db: Session, user_id: int, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None:
    """Create the real record for entry, matching row.row_type. No-op if row.row_type is None.
    Caller is responsible for the single db.commit()/rollback() around this call; every write
    here only flushes, so a precondition failure (HTTPException) never leaves a partial write
    committed."""
    if row.row_type in ("income", "expense") and entry.amount is None:
        raise HTTPException(status_code=400, detail="Set an amount before marking this row paid")
    if row.row_type == "income":
        income = Income(
            user_id=user_id, source=row.label, amount=entry.amount,
            date=date(entry.year, entry.month, 1), type="Other", period=1,
            month=entry.month, year=entry.year,
            participants=entry.participants or [], participant_amounts=entry.participant_amounts or {},
        )
        db.add(income)
        db.flush()
        entry.linked_record_type = "income"
        entry.linked_record_id = income.id
    elif row.row_type == "expense":
        expense = Expense(
            user_id=user_id, name=row.label, amount=entry.amount, category=row.label,
            date=date(entry.year, entry.month, 1), period=1,
            month=entry.month, year=entry.year,
            participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {},
        )
        db.add(expense)
        db.flush()
        entry.linked_record_type = "expense"
        entry.linked_record_id = expense.id
    elif row.row_type == "bill":
        if row.due_day is None:
            raise HTTPException(status_code=400, detail="Set a due day before marking a bill row paid")
        bill = db.query(Bill).filter(Bill.id == row.linked_master_id).first() if row.linked_master_id else None
        if bill is None:
            bill = Bill(
                user_id=user_id, name=row.label, due_day=row.due_day, category=row.label,
                start_month=entry.month, start_year=entry.year,
                participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {},
            )
            db.add(bill)
            db.flush()
            row.linked_master_id = bill.id
        payment = db.query(BillPayment).filter(
            BillPayment.bill_id == row.linked_master_id,
            BillPayment.month == entry.month,
            BillPayment.year == entry.year,
        ).first()
        if payment:
            payment.amount_paid = entry.amount
        else:
            payment = BillPayment(
                bill_id=row.linked_master_id, month=entry.month, year=entry.year, amount_paid=entry.amount,
            )
            db.add(payment)
        db.flush()
        entry.linked_record_type = "bill_payment"
        entry.linked_record_id = payment.id
    elif row.row_type == "installment":
        if row.total_terms is None:
            raise HTTPException(status_code=400, detail="Set the number of terms before marking an installment row paid")
        inst = db.query(Installment).filter(Installment.id == row.linked_master_id).first() if row.linked_master_id else None
        if inst is None:
            inst = Installment(
                user_id=user_id, name=row.label, installment_amount=entry.amount or 0,
                total_terms=row.total_terms, start_month=entry.month, start_year=entry.year,
                participants=entry.participants or [0], participant_amounts=entry.participant_amounts or {},
            )
            db.add(inst)
            db.flush()
            row.linked_master_id = inst.id
        payment = InstallmentPayment(installment_id=row.linked_master_id, month=entry.month, year=entry.year)
        db.add(payment)
        inst.terms_paid += 1
        if inst.terms_paid >= inst.total_terms:
            inst.status = "completed"
        db.flush()
        entry.linked_record_type = "installment_payment"
        entry.linked_record_id = payment.id


def reverse_paid(db: Session, row: SharedTrackerRow, entry: SharedTrackerEntry) -> None:
    """Undo whatever propagate_paid did for this entry. No-op if nothing is linked.
    Deletes go through the ORM (not a bulk query.delete()) so FK-dependent rows
    (settlements, receipts, deductions) are cleaned up the same way the item's own
    delete endpoint does it, instead of raising an IntegrityError."""
    if entry.linked_record_type == "income":
        income = db.query(Income).filter(Income.id == entry.linked_record_id).first()
        if income:
            db.query(Deduction).filter(Deduction.item_type == "income", Deduction.item_id == income.id).delete()
            db.delete(income)
    elif entry.linked_record_type == "expense":
        expense = db.query(Expense).filter(Expense.id == entry.linked_record_id).first()
        if expense:
            db.query(Deduction).filter(Deduction.item_type == "expense", Deduction.item_id == expense.id).delete()
            db.delete(expense)
    elif entry.linked_record_type == "bill_payment":
        payment = db.query(BillPayment).filter(BillPayment.id == entry.linked_record_id).first()
        if payment:
            db.delete(payment)
    elif entry.linked_record_type == "installment_payment":
        payment = db.query(InstallmentPayment).filter(InstallmentPayment.id == entry.linked_record_id).first()
        if payment:
            inst = db.query(Installment).filter(Installment.id == payment.installment_id).first()
            db.delete(payment)
            if inst:
                inst.terms_paid = max(0, inst.terms_paid - 1)
                if inst.status == "completed" and inst.terms_paid < inst.total_terms:
                    inst.status = "active"
    entry.linked_record_type = None
    entry.linked_record_id = None
    db.flush()


def sync_paid(db: Session, entry: SharedTrackerEntry) -> None:
    """Push entry's amount/participants/participant_amounts onto its linked record. No-op if nothing is linked."""
    if entry.linked_record_type == "income":
        income = db.query(Income).filter(Income.id == entry.linked_record_id).first()
        if income:
            income.amount = entry.amount
            income.participants = entry.participants or []
            income.participant_amounts = entry.participant_amounts or {}
    elif entry.linked_record_type == "expense":
        expense = db.query(Expense).filter(Expense.id == entry.linked_record_id).first()
        if expense:
            expense.amount = entry.amount
            expense.participants = entry.participants or [0]
            expense.participant_amounts = entry.participant_amounts or {}
    elif entry.linked_record_type == "bill_payment":
        payment = db.query(BillPayment).filter(BillPayment.id == entry.linked_record_id).first()
        if payment:
            payment.amount_paid = entry.amount
    db.flush()
