from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from datetime import date
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.installment import Installment, InstallmentPayment
from app.models.bill import Bill, BillPayment
from app.models.loan import Loan
from app.models.income import Income

router = APIRouter(prefix="/calendar", tags=["calendar"])


@router.get("/events")
def get_calendar_events(
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    events = []

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
        due_day = min(bill.due_day, 28)
        events.append({
            "type": "bill",
            "id": bill.id,
            "name": bill.name,
            "amount": float(bill.amount),
            "date": date(year, month, due_day).isoformat(),
            "paid": bill.id in paid_bill_ids,
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
        events.append({
            "type": "installment",
            "id": inst.id,
            "name": inst.name,
            "amount": float(inst.installment_amount),
            "date": date(year, month, 1).isoformat(),
            "paid": inst.id in paid_inst_ids,
        })

    active_loans = db.query(Loan).filter(
        Loan.user_id == current_user.id,
        Loan.status == "active",
        Loan.total_terms != None,
    ).all()
    for loan in active_loans:
        events.append({
            "type": "loan",
            "id": loan.id,
            "direction": loan.direction,
            "amount": float(loan.principal / loan.total_terms) if loan.total_terms else 0,
            "date": date(year, month, 1).isoformat(),
            "paid": False,
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
        })

    return {"month": month, "year": year, "events": events}
