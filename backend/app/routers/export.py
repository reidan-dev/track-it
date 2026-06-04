from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from datetime import date
from typing import Optional
import csv
import io
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense
from app.models.bill import Bill
from app.models.installment import Installment
from app.models.loan import Loan
from app.models.income import Income

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{module}")
def export_module(
    module: str,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    output = io.StringIO()
    writer = csv.writer(output)

    if module == "expenses":
        writer.writerow(["id", "date", "category", "amount", "note", "period", "month", "year"])
        q = db.query(Expense).filter(Expense.user_id == current_user.id)
        if from_date:
            q = q.filter(Expense.date >= from_date)
        if to_date:
            q = q.filter(Expense.date <= to_date)
        for e in q.all():
            writer.writerow([e.id, e.date, e.category, e.amount, e.note, e.period, e.month, e.year])

    elif module == "bills":
        writer.writerow(["id", "name", "amount", "due_day", "category", "is_recurring", "start_month", "start_year"])
        for b in db.query(Bill).filter(Bill.user_id == current_user.id).all():
            writer.writerow([b.id, b.name, b.amount, b.due_day, b.category, b.is_recurring, b.start_month, b.start_year])

    elif module == "installments":
        writer.writerow(["id", "name", "total_amount", "installment_amount", "total_terms", "terms_paid", "status"])
        for i in db.query(Installment).filter(Installment.user_id == current_user.id).all():
            writer.writerow([i.id, i.name, i.total_amount, i.installment_amount, i.total_terms, i.terms_paid, i.status])

    elif module == "loans":
        writer.writerow(["id", "direction", "principal", "interest_rate", "total_terms", "terms_paid", "status"])
        for l in db.query(Loan).filter(Loan.user_id == current_user.id).all():
            writer.writerow([l.id, l.direction, l.principal, l.interest_rate, l.total_terms, l.terms_paid, l.status])

    elif module == "income":
        writer.writerow(["id", "date", "source", "amount", "type", "period", "month", "year"])
        q = db.query(Income).filter(Income.user_id == current_user.id)
        if from_date:
            q = q.filter(Income.date >= from_date)
        if to_date:
            q = q.filter(Income.date <= to_date)
        for i in q.all():
            writer.writerow([i.id, i.date, i.source, i.amount, i.type, i.period, i.month, i.year])

    output.seek(0)
    today = date.today().strftime("%Y-%m")
    return StreamingResponse(
        output,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="trackit_{module}_{today}.csv"'},
    )
