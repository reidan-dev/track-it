from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from calendar import monthrange
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.installment import Installment, InstallmentPayment
from app.models.bill import Bill, BillPayment
from app.models.loan import Loan
from app.models.income import Income
from app.models.expense import Expense
from app.finance import ME_ID, participant_share

router = APIRouter(prefix="/calendar", tags=["calendar"])


def _owed_to_me(amount, participants, participant_amounts):
    """(amount others owe me, is_split) for a shared entry."""
    parts = participants or []
    non_me = [p for p in parts if p != ME_ID]
    owed = sum(participant_share(amount, parts, participant_amounts, pid) for pid in non_me)
    return round(owed, 2), len(non_me) > 0


@router.get("/events")
def get_calendar_events(
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = []
    dim = monthrange(year, month)[1]  # days in this month

    bills = db.query(Bill).filter(
        Bill.user_id == current_user.id,
        Bill.start_year * 100 + Bill.start_month <= year * 100 + month,
    ).filter(
        (Bill.end_year == None) | (Bill.end_year * 100 + (Bill.end_month or 12) >= year * 100 + month)
    ).all()
    paid_bill_ids = {
        bp.bill_id for bp in db.query(BillPayment).filter(
            BillPayment.month == month, BillPayment.year == year,
            BillPayment.bill_id.in_([b.id for b in bills]),
        ).all()
    }
    for bill in bills:
        owed, split = _owed_to_me(bill.amount, bill.participants, bill.participant_amounts)
        day = min(max(int(bill.due_day or 1), 1), dim)
        events.append({
            "type": "bill",
            "id": bill.id,
            "name": bill.name,
            "amount": float(bill.amount) if bill.amount is not None else 0,
            "date": date(year, month, day).isoformat(),
            "paid": bill.id in paid_bill_ids,
            "owed_to_me": owed,
            "split": split,
        })

    installments = db.query(Installment).filter(
        Installment.user_id == current_user.id,
        Installment.status == "active",
        Installment.start_year * 100 + Installment.start_month <= year * 100 + month,
    ).all()
    paid_inst_ids = {
        ip.installment_id for ip in db.query(InstallmentPayment).filter(
            InstallmentPayment.month == month, InstallmentPayment.year == year,
            InstallmentPayment.installment_id.in_([i.id for i in installments]),
        ).all()
    }
    for inst in installments:
        owed, split = _owed_to_me(inst.installment_amount, inst.participants, inst.participant_amounts)
        days = [min(int(p.strip()), dim) for p in str(inst.due_day or "").split(",") if p.strip().isdigit()]
        if not days:
            days = [1]
        for d in days:
            events.append({
                "type": "installment",
                "id": inst.id,
                "name": inst.name,
                "amount": float(inst.installment_amount),
                "date": date(year, month, max(d, 1)).isoformat(),
                "paid": inst.id in paid_inst_ids,
                "owed_to_me": owed,
                "split": split,
            })

    active_loans = db.query(Loan).filter(
        Loan.user_id == current_user.id,
        Loan.status == "active",
        Loan.total_terms != None,
    ).all()
    for loan in active_loans:
        amt = float(loan.principal / loan.total_terms) if loan.total_terms else 0
        events.append({
            "type": "loan",
            "id": loan.id,
            "direction": loan.direction,
            "amount": amt,
            "date": date(year, month, 1).isoformat(),
            "paid": False,
            "owed_to_me": amt if loan.direction == "lent" else 0,
            "split": False,
        })

    expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.month == month,
        Expense.year == year,
    ).all()
    for exp in expenses:
        owed, split = _owed_to_me(exp.amount, exp.participants, exp.participant_amounts)
        events.append({
            "type": "expense",
            "id": exp.id,
            "name": exp.name or exp.note or exp.category,
            "amount": float(exp.amount),
            "date": exp.date.isoformat(),
            "paid": True,
            "owed_to_me": owed,
            "split": split,
        })

    incomes = db.query(Income).filter(
        Income.user_id == current_user.id,
        Income.month == month,
        Income.year == year,
    ).all()
    for inc in incomes:
        events.append({
            "type": "income",
            "id": inc.id,
            "name": inc.source,
            "amount": float(inc.amount),
            "date": inc.date.isoformat(),
            "paid": True,
            "owed_to_me": 0,
            "split": False,
        })

    return {"month": month, "year": year, "events": events}
