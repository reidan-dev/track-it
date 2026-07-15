from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import date, timedelta
from decimal import Decimal
from typing import Optional
from pydantic import BaseModel
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.expense import Expense, ExpenseParticipantSettlement
from app.models.installment import Installment, InstallmentPayment, InstallmentParticipantSettlement
from app.models.bill import Bill, BillPayment, BillParticipantSettlement
from app.models.loan import Loan
from app.models.income import Income
from app.finance import (
    compute_people_balances, deductions_map, item_deductions,
    effective_shares, effective_total, my_effective_share,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

ME_ID = 0  # sentinel used in participants lists


def _participant_share(total, participants, participant_amounts, pid):
    """Return a person's share of an amount, respecting custom splits."""
    if not total:
        return 0.0
    custom = (participant_amounts or {}).get(str(pid))
    if custom is not None and custom != "":
        return float(custom)
    count = len(participants) if participants else 1
    return float(total) / count


def _my_share(total, participants, participant_amounts):
    """My (the user's) share of an amount."""
    if not total:
        return 0.0
    parts = participants or []
    if not parts or ME_ID not in parts:
        return float(total)
    return _participant_share(total, parts, participant_amounts, ME_ID)


def _period_of(due_day):
    """Map a due day (1–31) to biweekly period 1 (1st–15th) or 2 (16th–end)."""
    try:
        d = int(str(due_day).split(",")[0].strip())
    except (ValueError, AttributeError, TypeError):
        return 1
    return 1 if d <= 15 else 2


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

    deds = deductions_map(db, current_user, m, y)

    def _remaining(item_type, item_id, amount):
        return effective_total(amount, item_deductions(deds, item_type, item_id))

    total_income = db.query(func.sum(Income.amount)).filter(
        Income.user_id == current_user.id,
        Income.month == m,
        Income.year == y,
    ).scalar() or Decimal(0)

    month_expenses = db.query(Expense).filter(
        Expense.user_id == current_user.id,
        Expense.month == m,
        Expense.year == y,
    ).all()
    total_expenses = sum((e.amount for e in month_expenses), Decimal(0))

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
    total_installments = sum(_remaining("installment", i.id, i.installment_amount) for i in active_installments)

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
    total_bills = sum(_remaining("bill", b.id, b.amount) for b in active_bills)
    unpaid_bills_count = sum(1 for b in active_bills if b.id not in paid_bill_ids)
    bills_paid_amount = float(sum(_remaining("bill", b.id, b.amount) for b in active_bills if b.id in paid_bill_ids))
    bills_unpaid_amount = float(sum(_remaining("bill", b.id, b.amount) for b in active_bills if b.id not in paid_bill_ids))

    seven_days = today + timedelta(days=7)
    upcoming = []
    for bill in active_bills:
        due_date = date(y, m, min(bill.due_day, 28))
        if today <= due_date <= seven_days and bill.id not in paid_bill_ids:
            upcoming.append({
                "type": "bill",
                "id": bill.id,
                "name": bill.name,
                "amount": _remaining("bill", bill.id, bill.amount),
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
                "amount": _remaining("installment", inst.id, inst.installment_amount),
                "due_date": date(y, m, 1).isoformat(),
            })

    loans_nearing = []
    all_active_loans = db.query(Loan).filter(
        Loan.user_id == current_user.id,
        Loan.status == "active",
    ).all()
    for loan in all_active_loans:
        if loan.total_terms:
            remaining_terms = loan.total_terms - loan.terms_paid
            if 0 < remaining_terms <= 3:
                loans_nearing.append({
                    "id": loan.id,
                    "direction": loan.direction,
                    "principal": float(loan.principal),
                    "terms_remaining": remaining_terms,
                })

    net_position = float(total_income) - float(total_expenses) - float(total_installments) - float(total_bills)

    # Net cash considering only MY share of bills/installments/expenses (others'
    # shares are reimbursed to me, so they shouldn't count against my cash).
    my_bills_total = sum(
        my_effective_share(b.amount, b.participants, b.participant_amounts,
                           item_deductions(deds, "bill", b.id))
        for b in active_bills
    )
    my_installments_total = sum(
        my_effective_share(i.installment_amount, i.participants, i.participant_amounts,
                           item_deductions(deds, "installment", i.id))
        for i in active_installments
    )

    def _my_expense_cost(exp):
        e_deds = item_deductions(deds, "expense", exp.id)
        shares = effective_shares(exp.amount, exp.participants, exp.participant_amounts, e_deds)
        others = sum(v for pid, v in shares.items() if pid != ME_ID)
        return max(0.0, effective_total(exp.amount, e_deds) - others)

    my_expenses_total = sum(_my_expense_cost(e) for e in month_expenses)
    net_cash_mine = float(total_income) - my_expenses_total - my_installments_total - my_bills_total

    people_balances = compute_people_balances(db, current_user, m, y)

    return {
        "month": m,
        "year": y,
        "total_income": float(total_income),
        "total_expenses": float(total_expenses),
        "total_installments": float(total_installments),
        "total_bills": float(total_bills),
        "unpaid_bills_count": unpaid_bills_count,
        "net_position": net_position,
        "net_cash_mine": net_cash_mine,
        "bills_paid_amount": bills_paid_amount,
        "bills_unpaid_amount": bills_unpaid_amount,
        "expenses_by_category": [{"category": r.category, "total": float(r.total)} for r in expenses_by_category],
        "upcoming_payments": upcoming,
        "loans_nearing_completion": loans_nearing,
        "people_balances": people_balances,
    }


class SettleItem(BaseModel):
    type: str                     # expense | bill | installment | loan
    id: int
    direction: str                # owed_to_me | i_owe
    person_id: int
    settle_period: Optional[int] = None
    amount: Optional[float] = None  # loans only: partial payment


class SettleRequest(BaseModel):
    month: int
    year: int
    items: list[SettleItem]


@router.post("/settle")
def settle_up(
    req: SettleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a settle-up: clears the selected balance sources for one person.

    owed_to_me shares become settlement rows; a fronted expense I owe flips
    is_paid; a bill I owe its payee gets a BillPayment; loans get a payment
    (partial allowed) and auto-settle when fully repaid.
    """
    settled = 0
    for item in req.items:
        if item.type == "expense":
            exp = db.query(Expense).filter(
                Expense.id == item.id, Expense.user_id == current_user.id).first()
            if not exp:
                continue
            if item.direction == "i_owe":
                exp.is_paid = True
            else:
                exists = db.query(ExpenseParticipantSettlement).filter(
                    ExpenseParticipantSettlement.expense_id == exp.id,
                    ExpenseParticipantSettlement.person_id == item.person_id,
                    ExpenseParticipantSettlement.month == req.month,
                    ExpenseParticipantSettlement.year == req.year,
                    ExpenseParticipantSettlement.period.is_(None),
                ).first()
                if not exists:
                    db.add(ExpenseParticipantSettlement(
                        expense_id=exp.id, person_id=item.person_id,
                        month=req.month, year=req.year, period=None))
            settled += 1

        elif item.type == "bill":
            bill = db.query(Bill).filter(
                Bill.id == item.id, Bill.user_id == current_user.id).first()
            if not bill:
                continue
            if item.direction == "i_owe":
                q = db.query(BillPayment).filter(
                    BillPayment.bill_id == bill.id,
                    BillPayment.month == req.month, BillPayment.year == req.year)
                q = q.filter(BillPayment.period == item.settle_period) if item.settle_period is not None \
                    else q.filter(BillPayment.period.is_(None))
                if not q.first():
                    db.add(BillPayment(bill_id=bill.id, month=req.month, year=req.year,
                                       period=item.settle_period, amount_paid=bill.amount))
            else:
                q = db.query(BillParticipantSettlement).filter(
                    BillParticipantSettlement.bill_id == bill.id,
                    BillParticipantSettlement.person_id == item.person_id,
                    BillParticipantSettlement.month == req.month,
                    BillParticipantSettlement.year == req.year)
                q = q.filter(BillParticipantSettlement.period == item.settle_period) if item.settle_period is not None \
                    else q.filter(BillParticipantSettlement.period.is_(None))
                if not q.first():
                    db.add(BillParticipantSettlement(
                        bill_id=bill.id, person_id=item.person_id,
                        month=req.month, year=req.year, period=item.settle_period))
            settled += 1

        elif item.type == "installment":
            inst = db.query(Installment).filter(
                Installment.id == item.id, Installment.user_id == current_user.id).first()
            if not inst:
                continue
            q = db.query(InstallmentParticipantSettlement).filter(
                InstallmentParticipantSettlement.installment_id == inst.id,
                InstallmentParticipantSettlement.person_id == item.person_id,
                InstallmentParticipantSettlement.month == req.month,
                InstallmentParticipantSettlement.year == req.year)
            q = q.filter(InstallmentParticipantSettlement.period == item.settle_period) if item.settle_period is not None \
                else q.filter(InstallmentParticipantSettlement.period.is_(None))
            if not q.first():
                db.add(InstallmentParticipantSettlement(
                    installment_id=inst.id, person_id=item.person_id,
                    month=req.month, year=req.year, period=item.settle_period))
            settled += 1

        elif item.type == "loan":
            from app.models.loan import LoanPayment
            loan = db.query(Loan).filter(
                Loan.id == item.id, Loan.user_id == current_user.id).first()
            if not loan:
                continue
            paid = sum(float(p.amount) for p in loan.payments)
            remaining = float(loan.principal) - paid
            amt = min(item.amount if item.amount is not None else remaining, remaining)
            if amt > 0:
                db.add(LoanPayment(loan_id=loan.id, amount=amt, note="Settle-up"))
                if paid + amt >= float(loan.principal) - 0.005:
                    loan.status = "settled"
                settled += 1

    db.commit()
    return {"ok": True, "settled": settled}


@router.get("/trends")
def get_trends(
    months: int = 6,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Last `months` months of income, expenses and my net cash, oldest first."""
    today = date.today()
    months = max(1, min(months, 24))

    # Build the (month, year) window ending with the current month.
    window = []
    m, y = today.month, today.year
    for _ in range(months):
        window.append((m, y))
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    window.reverse()

    series = []
    for m, y in window:
        income = float(db.query(func.sum(Income.amount)).filter(
            Income.user_id == current_user.id, Income.month == m, Income.year == y,
        ).scalar() or 0)
        expenses = float(db.query(func.sum(Expense.amount)).filter(
            Expense.user_id == current_user.id, Expense.month == m, Expense.year == y,
        ).scalar() or 0)

        active_bills = db.query(Bill).filter(
            Bill.user_id == current_user.id,
            Bill.start_year * 100 + Bill.start_month <= y * 100 + m,
        ).filter(
            (Bill.end_year == None) | (Bill.end_year * 100 + (Bill.end_month or 12) >= y * 100 + m)
        ).all()
        my_bills = sum(_my_share(b.amount, b.participants, b.participant_amounts) for b in active_bills)

        active_installments = db.query(Installment).filter(
            Installment.user_id == current_user.id,
            Installment.status == "active",
            Installment.start_year * 100 + Installment.start_month <= y * 100 + m,
        ).all()
        my_installments = sum(
            _my_share(i.installment_amount, i.participants, i.participant_amounts)
            for i in active_installments
        )

        series.append({
            "month": m,
            "year": y,
            "label": date(y, m, 1).strftime("%b"),
            "income": round(income, 2),
            "expenses": round(expenses, 2),
            "net_cash_mine": round(income - expenses - my_bills - my_installments, 2),
        })

    return {"months": months, "series": series}
