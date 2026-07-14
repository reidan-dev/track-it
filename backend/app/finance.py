"""Shared finance helpers: participant splits and per-person balances.

Kept separate from the dashboard router so the reminder scheduler can compute
the same numbers without depending on the request layer.
"""
from app.models.person import Person
from app.models.loan import Loan
from app.models.bill import Bill, BillPayment, BillParticipantSettlement
from app.models.installment import Installment, InstallmentPayment, InstallmentParticipantSettlement
from app.models.expense import Expense, ExpenseParticipantSettlement

ME_ID = 0  # sentinel for "Me" in participants lists


def participant_share(total, participants, participant_amounts, pid):
    """A person's share of an amount, respecting custom per-person splits."""
    if not total:
        return 0.0
    custom = (participant_amounts or {}).get(str(pid))
    if custom is not None and custom != "":
        return float(custom)
    count = len(participants) if participants else 1
    return float(total) / count


def my_share(total, participants, participant_amounts):
    """My (the user's) share of an amount."""
    if not total:
        return 0.0
    parts = participants or []
    if not parts or ME_ID not in parts:
        return float(total)
    return participant_share(total, parts, participant_amounts, ME_ID)


def period_of(due_day):
    """Map a due day (1–31, or "5, 20") to biweekly period 1 or 2."""
    try:
        d = int(str(due_day).split(",")[0].strip())
    except (ValueError, AttributeError, TypeError):
        return 1
    return 1 if d <= 15 else 2


def i_am_participant(participants):
    """True if I share this entry (or no participants set ⇒ entirely mine)."""
    parts = participants or []
    return (not parts) or (ME_ID in parts)


def has_split(participants):
    """True if anyone other than me is attached."""
    parts = participants or []
    return any(p != ME_ID for p in parts)


def active_bills(db, user, month, year):
    return db.query(Bill).filter(
        Bill.user_id == user.id,
        Bill.start_year * 100 + Bill.start_month <= year * 100 + month,
    ).filter(
        (Bill.end_year == None) | (Bill.end_year * 100 + (Bill.end_month or 12) >= year * 100 + month)
    ).all()


def active_installments(db, user, month, year):
    return db.query(Installment).filter(
        Installment.user_id == user.id,
        Installment.status == "active",
        Installment.start_year * 100 + Installment.start_month <= year * 100 + month,
    ).all()


def _relevant_periods(frequency, due_day, period):
    base = [1, 2] if frequency == "biweekly" else [period_of(due_day)]
    if period is None:
        return base
    return [period] if period in base else []


def compute_people_balances(db, user, month, year, period=None):
    """Per-person balances for the given month — the single source of truth
    shared by the web dashboard and the Telegram bot.

    Semantics:
    - Loans: remaining balance, not period-bound.
    - Fronted expenses (paid_by / payable_to someone else): I owe them the FULL
      amount until is_paid; other participants owe me their shares regardless.
    - Bills: participants' unsettled shares always owe me (flagged awaiting once
      the bill is paid); I owe the payee the full amount only while unpaid.
    - Installments: participants' unsettled shares, awaiting once the term's paid.
    - `period` (1 or 2) filters period-bound items; loans always count.

    Returns rows sorted by largest absolute net:
    {person_id, name (display), full_name, nickname, emoji, color,
     they_owe_me, i_owe_them, net, sources:[{type, label, amount, period,
     direction, id, awaiting?, settle_period?, ...}]}
    """
    people = db.query(Person).filter(Person.user_id == user.id).all()
    people_map = {p.id: p for p in people}
    loans = db.query(Loan).filter(Loan.user_id == user.id, Loan.status == "active").all()
    bills = active_bills(db, user, month, year)
    installments = active_installments(db, user, month, year)

    bal: dict[int, list] = {}

    def _add(pid, direction, type_, label, amount, prd, **extra):
        if pid not in people_map or amount is None or amount <= 0:
            return
        src = {
            "type": type_,
            "label": label,
            "amount": round(float(amount), 2),
            "period": prd,
            "direction": direction,
        }
        src.update(extra)
        bal.setdefault(pid, []).append(src)

    # 1. Loans — remaining balance (no period)
    for loan in loans:
        paid = sum(float(p.amount) for p in loan.payments)
        remaining = float(loan.principal) - paid
        if remaining <= 0:
            continue
        direction = "owed_to_me" if loan.direction == "lent" else "i_owe"
        _add(loan.person_id, direction, "loan", "Loan", remaining, None, id=loan.id)

    # 2. Bills this month
    bill_payments = db.query(BillPayment).filter(
        BillPayment.month == month, BillPayment.year == year,
        BillPayment.bill_id.in_([b.id for b in bills]),
    ).all() if bills else []
    bill_settled = {
        (s.bill_id, s.person_id, s.period)
        for s in db.query(BillParticipantSettlement).filter(
            BillParticipantSettlement.month == month, BillParticipantSettlement.year == year,
            BillParticipantSettlement.bill_id.in_([b.id for b in bills]),
        ).all()
    } if bills else set()

    def _bill_paid(bid, prd):
        return any(bp.bill_id == bid and (prd is None or bp.period == prd) for bp in bill_payments)

    for bill in bills:
        parts = bill.participants or []
        non_me = [p for p in parts if p != ME_ID]
        split = len(non_me) > 0
        for prd in _relevant_periods(bill.frequency, bill.due_day, period):
            paid_check = prd if bill.frequency == "biweekly" else None
            item_paid = _bill_paid(bill.id, paid_check)
            settle_period = prd if bill.frequency == "biweekly" else None
            for pid in non_me:
                if (bill.id, pid, settle_period) in bill_settled:
                    continue
                share = participant_share(bill.amount, parts, bill.participant_amounts, pid)
                _add(pid, "owed_to_me", "bill", bill.name, share, prd, split=split,
                     id=bill.id, settle_period=settle_period, awaiting=item_paid)
            if bill.payable_to and not item_paid:
                _add(bill.payable_to, "i_owe", "bill", bill.name, bill.amount, prd, split=split,
                     id=bill.id, settle_period=paid_check)

    # 3. Installments this month
    inst_payments = db.query(InstallmentPayment).filter(
        InstallmentPayment.month == month, InstallmentPayment.year == year,
        InstallmentPayment.installment_id.in_([i.id for i in installments]),
    ).all() if installments else []
    inst_settled = {
        (s.installment_id, s.person_id, s.period)
        for s in db.query(InstallmentParticipantSettlement).filter(
            InstallmentParticipantSettlement.month == month,
            InstallmentParticipantSettlement.year == year,
            InstallmentParticipantSettlement.installment_id.in_([i.id for i in installments]),
        ).all()
    } if installments else set()

    def _inst_paid(iid, prd):
        return any(ip.installment_id == iid and (prd is None or ip.period == prd) for ip in inst_payments)

    for inst in installments:
        parts = inst.participants or []
        non_me = [p for p in parts if p != ME_ID]
        if not non_me:
            continue
        term = min((inst.terms_paid or 0) + 1, inst.total_terms)
        for prd in _relevant_periods(inst.frequency, inst.due_day, period):
            paid_check = prd if inst.frequency == "biweekly" else None
            item_paid = _inst_paid(inst.id, paid_check)
            settle_period = prd if inst.frequency == "biweekly" else None
            for pid in non_me:
                if (inst.id, pid, settle_period) in inst_settled:
                    continue
                share = participant_share(inst.installment_amount, parts, inst.participant_amounts, pid)
                _add(pid, "owed_to_me", "installment", inst.name, share, prd,
                     term=term, total_terms=inst.total_terms, split=True,
                     id=inst.id, settle_period=settle_period, awaiting=item_paid)

    # 4. Expenses this month
    expenses = db.query(Expense).filter(
        Expense.user_id == user.id, Expense.month == month, Expense.year == year,
    ).all()
    exp_settled = {
        (s.expense_id, s.person_id) for s in db.query(ExpenseParticipantSettlement).filter(
            ExpenseParticipantSettlement.expense_id.in_([e.id for e in expenses]),
            ExpenseParticipantSettlement.month == month, ExpenseParticipantSettlement.year == year,
        ).all()
    } if expenses else set()

    for exp in expenses:
        if period is not None and exp.period != period:
            continue
        parts = exp.participants or []
        non_me = [p for p in parts if p != ME_ID]
        label = exp.name or exp.note or exp.category
        split = len(parts) > 1

        creditor = exp.payable_to or (exp.paid_by if exp.paid_by not in (None, ME_ID) else None)
        if creditor and not exp.is_paid:
            _add(creditor, "i_owe", "expense", label, exp.amount, exp.period, split=split, id=exp.id)

        participants_cleared = exp.is_paid and not creditor
        for pid in non_me:
            if participants_cleared or (exp.id, pid) in exp_settled:
                continue
            share = participant_share(exp.amount, parts, exp.participant_amounts, pid)
            _add(pid, "owed_to_me", "expense", label, share, exp.period, split=split, id=exp.id,
                 awaiting=creditor is None or exp.is_paid)

    result = []
    for pid, sources in bal.items():
        owed = round(sum(s["amount"] for s in sources if s["direction"] == "owed_to_me"), 2)
        owe = round(sum(s["amount"] for s in sources if s["direction"] == "i_owe"), 2)
        if owed <= 0 and owe <= 0:
            continue
        p = people_map[pid]
        result.append({
            "person_id": pid,
            "name": p.nickname or p.name,
            "full_name": p.name,
            "nickname": p.nickname,
            "emoji": p.emoji,
            "color": p.color,
            "they_owe_me": owed,
            "i_owe_them": owe,
            "net": round(owed - owe, 2),
            "sources": sources,
        })
    result.sort(key=lambda x: -abs(x["net"]))
    return result
