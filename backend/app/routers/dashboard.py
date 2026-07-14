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
from app.models.person import Person

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
    total_bills = sum(b.amount or 0 for b in active_bills)
    unpaid_bills_count = sum(1 for b in active_bills if b.id not in paid_bill_ids)
    bills_paid_amount = float(sum(b.amount or 0 for b in active_bills if b.id in paid_bill_ids))
    bills_unpaid_amount = float(sum(b.amount or 0 for b in active_bills if b.id not in paid_bill_ids))

    seven_days = today + timedelta(days=7)
    upcoming = []
    for bill in active_bills:
        due_date = date(y, m, min(bill.due_day, 28))
        if today <= due_date <= seven_days and bill.id not in paid_bill_ids:
            upcoming.append({
                "type": "bill",
                "id": bill.id,
                "name": bill.name,
                "amount": float(bill.amount or 0),
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

    net_position = float(total_income - total_expenses - total_installments - total_bills)

    # Net cash considering only MY share of bills/installments/expenses (others'
    # shares are reimbursed to me, so they shouldn't count against my cash).
    my_bills_total = sum(
        _my_share(b.amount, b.participants, b.participant_amounts) for b in active_bills
    )
    my_installments_total = sum(
        _my_share(i.installment_amount, i.participants, i.participant_amounts)
        for i in active_installments
    )

    def _my_expense_cost(exp):
        parts = exp.participants or []
        non_me = [p for p in parts if p != ME_ID]
        others = sum(_participant_share(exp.amount, parts, exp.participant_amounts, pid) for pid in non_me)
        return max(0.0, float(exp.amount) - others)

    my_expenses_total = sum(_my_expense_cost(e) for e in month_expenses)
    net_cash_mine = float(total_income) - my_expenses_total - my_installments_total - my_bills_total

    # ── Per-person balances ──────────────────────────────────────────────────
    people = db.query(Person).filter(Person.user_id == current_user.id).all()
    people_map = {p.id: p for p in people}

    # pid → {"sources": [{type, label, amount, period, direction}]}
    bal: dict[int, dict] = {}

    def _add(pid, direction, type_, label, amount, period, **extra):
        # direction: "owed_to_me" | "i_owe"; period: 1, 2, or None
        if pid not in people_map or amount is None or amount <= 0:
            return
        src = {
            "type": type_,
            "label": label,
            "amount": round(float(amount), 2),
            "period": period,
            "direction": direction,
        }
        src.update(extra)
        bal.setdefault(pid, {"sources": []})["sources"].append(src)

    # 1. Loans — total remaining balance (no period)
    for loan in all_active_loans:
        paid = sum(float(p.amount) for p in loan.payments)
        remaining = float(loan.principal) - paid
        if remaining <= 0:
            continue
        direction = "owed_to_me" if loan.direction == "lent" else "i_owe"
        _add(loan.person_id, direction, "loan", "Loan", remaining, None, id=loan.id)

    # 2. Bills this month
    bill_payments_this_month = db.query(BillPayment).filter(
        BillPayment.month == m, BillPayment.year == y,
        BillPayment.bill_id.in_([b.id for b in active_bills]),
    ).all()

    def _bill_paid(bill_id, period):
        return any(
            bp.bill_id == bill_id and (period is None or bp.period == period)
            for bp in bill_payments_this_month
        )

    bill_settled = {
        (s.bill_id, s.person_id, s.period)
        for s in db.query(BillParticipantSettlement).filter(
            BillParticipantSettlement.month == m, BillParticipantSettlement.year == y,
            BillParticipantSettlement.bill_id.in_([b.id for b in active_bills]),
        ).all()
    } if active_bills else set()

    for bill in active_bills:
        parts = bill.participants or []
        non_me = [p for p in parts if p != ME_ID]
        split = len(non_me) > 0
        periods = [1, 2] if bill.frequency == "biweekly" else [_period_of(bill.due_day)]
        for period in periods:
            paid_check = period if bill.frequency == "biweekly" else None
            if _bill_paid(bill.id, paid_check):
                continue
            settle_period = period if bill.frequency == "biweekly" else None
            # other participants owe me their unsettled share
            for pid in non_me:
                if (bill.id, pid, settle_period) in bill_settled:
                    continue
                share = _participant_share(bill.amount, parts, bill.participant_amounts, pid)
                _add(pid, "owed_to_me", "bill", bill.name, share, period, split=split,
                     id=bill.id, settle_period=settle_period)
            # I owe the payee the full amount (they front/receive it);
            # participants' shares above are what I collect back.
            if bill.payable_to:
                _add(bill.payable_to, "i_owe", "bill", bill.name, bill.amount, period, split=split,
                     id=bill.id, settle_period=paid_check)

    # 3. Installments this month — other participants' unpaid shares
    inst_payments_this_month = db.query(InstallmentPayment).filter(
        InstallmentPayment.month == m, InstallmentPayment.year == y,
        InstallmentPayment.installment_id.in_([i.id for i in active_installments]),
    ).all()

    def _inst_paid(inst_id, period):
        return any(
            ip.installment_id == inst_id and (period is None or ip.period == period)
            for ip in inst_payments_this_month
        )

    inst_settled = {
        (s.installment_id, s.person_id, s.period)
        for s in db.query(InstallmentParticipantSettlement).filter(
            InstallmentParticipantSettlement.month == m,
            InstallmentParticipantSettlement.year == y,
            InstallmentParticipantSettlement.installment_id.in_([i.id for i in active_installments]),
        ).all()
    } if active_installments else set()

    for inst in active_installments:
        parts = inst.participants or []
        non_me = [p for p in parts if p != ME_ID]
        if not non_me:
            continue
        term = min((inst.terms_paid or 0) + 1, inst.total_terms)
        periods = [1, 2] if inst.frequency == "biweekly" else [_period_of(inst.due_day)]
        for period in periods:
            paid_check = period if inst.frequency == "biweekly" else None
            if _inst_paid(inst.id, paid_check):
                continue
            settle_period = period if inst.frequency == "biweekly" else None
            for pid in non_me:
                if (inst.id, pid, settle_period) in inst_settled:
                    continue
                share = _participant_share(inst.installment_amount, parts, inst.participant_amounts, pid)
                _add(pid, "owed_to_me", "installment", inst.name, share, period,
                     term=term, total_terms=inst.total_terms, split=True,
                     id=inst.id, settle_period=settle_period)

    # 4. Expenses this month — others' unsettled shares
    exp_settled = {
        (s.expense_id, s.person_id) for s in db.query(ExpenseParticipantSettlement).filter(
            ExpenseParticipantSettlement.expense_id.in_([e.id for e in month_expenses]),
            ExpenseParticipantSettlement.month == m, ExpenseParticipantSettlement.year == y,
        ).all()
    } if month_expenses else set()

    for exp in month_expenses:
        parts = exp.participants or []
        non_me = [p for p in parts if p != ME_ID]
        label = exp.name or exp.note or exp.category
        split = len(parts) > 1

        # If someone else fronted it (paid_by) or I owe someone for it
        # (payable_to), I owe that person the FULL amount until it's repaid
        # (is_paid). Participants' shares are collected by me separately.
        creditor = exp.payable_to or (exp.paid_by if exp.paid_by not in (None, ME_ID) else None)
        if creditor and not exp.is_paid:
            _add(creditor, "i_owe", "expense", label, exp.amount, exp.period, split=split, id=exp.id)

        # Other participants owe me their share until they settle it —
        # even when someone else fronted, since I repay the full amount.
        # A non-split expense marked paid has no settlement rows, so is_paid
        # (with no outstanding creditor) also clears participants' debts.
        participants_cleared = exp.is_paid and not creditor
        for pid in non_me:
            if participants_cleared or (exp.id, pid) in exp_settled:
                continue
            share = _participant_share(exp.amount, parts, exp.participant_amounts, pid)
            _add(pid, "owed_to_me", "expense", label, share, exp.period, split=split, id=exp.id)

    people_balances = []
    for pid, b in bal.items():
        p = people_map[pid]
        owed = sum(s["amount"] for s in b["sources"] if s["direction"] == "owed_to_me")
        owe = sum(s["amount"] for s in b["sources"] if s["direction"] == "i_owe")
        if owed > 0 or owe > 0:
            people_balances.append({
                "person_id": pid,
                "name": p.name,
                "nickname": p.nickname,
                "emoji": p.emoji,
                "color": p.color,
                "they_owe_me": round(owed, 2),
                "i_owe_them": round(owe, 2),
                "sources": b["sources"],
            })

    people_balances.sort(key=lambda x: -(x["they_owe_me"] + x["i_owe_them"]))

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
