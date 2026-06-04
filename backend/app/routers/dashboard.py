from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.installment import Installment, InstallmentPayment
from app.models.bill import Bill, BillPayment
from app.models.loan import Loan
from app.models.income import Income

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
def get_summary(
    month: int = None,
    year: int = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    m = month or today.month
    y = year or today.year

    total_income = db.query(func.sum(Income.amount)).filter(
        Income.user_id == current_user.id,
        Income.month == m,
        Income.year == y,
    ).scalar() or Decimal(0)

    total_expenses = db.query(func.sum(Expense.amount)).filter(
        Expense.user_id == current_user.id,
        Expense.month == m,
        Expense.year == y,
    ).scalar() or Decimal(0)

    expenses_by_category = db.query(
        Expense.category,
        func.sum(Expense.amount).label("total"),
    ).filter(
        Expense.user_id == current_user.id,
        Expense.month == m,
        Expense.year == y,
    ).group_by(Expense.category).all()

    active_installments = db.query(Installment).filter(
        Installment.user_id == current_user.id,
        Installment.status == "active",
    ).all()
    total_installments = sum(i.installment_amount for i in active_installments)

    active_bills = db.query(Bill).filter(
        Bill.user_id == current_user.id,
        Bill.start_year * 100 + Bill.start_month <= y * 100 + m,
    ).filter(
        (Bill.end_year == None) | (Bill.end_year * 100 + (Bill.end_month or 12) >= y * 100 + m)
    ).all()
    paid_bill_ids = {
        bp.bill_id for bp in db.query(BillPayment).filter(
            BillPayment.month == m, BillPayment.year == y,
            BillPayment.bill_id.in_([b.id for b in active_bills]),
        ).all()
    }
    total_bills = sum(b.amount for b in active_bills)
    unpaid_bills_count = sum(1 for b in active_bills if b.id not in paid_bill_ids)

    seven_days = today + timedelta(days=7)
    upcoming = []
    for bill in active_bills:
        due_date = date(y, m, min(bill.due_day, 28))
        if today <= due_date <= seven_days and bill.id not in paid_bill_ids:
            upcoming.append({
                "type": "bill",
                "id": bill.id,
                "name": bill.name,
                "amount": float(bill.amount),
                "due_date": due_date.isoformat(),
            })

    for inst in active_installments:
        paid_this_month = db.query(InstallmentPayment).filter(
            InstallmentPayment.installment_id == inst.id,
            InstallmentPayment.month == m,
            InstallmentPayment.year == y,
        ).first()
        if not paid_this_month:
            upcoming.append({
                "type": "installment",
                "id": inst.id,
                "name": inst.name,
                "amount": float(inst.installment_amount),
                "due_date": date(y, m, 1).isoformat(),
            })

    loans_nearing = []
    active_loans = db.query(Loan).filter(
        Loan.user_id == current_user.id,
        Loan.status == "active",
        Loan.total_terms != None,
    ).all()
    for loan in active_loans:
        remaining = loan.total_terms - loan.terms_paid
        if 0 < remaining <= 3:
            loans_nearing.append({
                "id": loan.id,
                "direction": loan.direction,
                "principal": float(loan.principal),
                "terms_remaining": remaining,
            })

    net_position = float(total_income - total_expenses - total_installments - total_bills)

    return {
        "month": m,
        "year": y,
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "total_installments": float(total_installments),
        "total_bills": float(total_bills),
        "unpaid_bills_count": unpaid_bills_count,
        "net_position": net_position,
        "expenses_by_category": [{"category": r.category, "total": float(r.total)} for r in expenses_by_category],
        "upcoming_payments": upcoming,
        "loans_nearing_completion": loans_nearing,
    }
