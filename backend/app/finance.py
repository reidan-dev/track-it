"""Shared finance helpers: participant splits and per-person balances.

Kept separate from the dashboard router so the reminder scheduler can compute
the same numbers without depending on the request layer.
"""
from app.models.person import Person
from app.models.loan import Loan
from app.models.bill import Bill, BillPayment
from app.models.installment import Installment, InstallmentPayment
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
    """Net balance per person for the given month.

    If `period` (1 or 2) is given, only bills/installments due in that period
    count toward the shares; loans (which aren't period-bound) are always
    included. Returns {person_id, name, they_owe_me, i_owe_them, net}, sorted
    by largest absolute net first.
    """
    people = db.query(Person).filter(Person.user_id == user.id).all()
    people_map = {p.id: p for p in people}
    loans = db.query(Loan).filter(Loan.user_id == user.id, Loan.status == "active").all()
    bills = active_bills(db, user, month, year)
    installments = active_installments(db, user, month, year)

    bal: dict[int, dict] = {}

    def _add(pid, direction, amount):
        if pid not in people_map or amount is None or amount <= 0:
            return
        entry = bal.setdefault(pid, {"owed": 0.0, "owe": 0.0})
        entry["owed" if direction == "owed_to_me" else "owe"] += float(amount)

    # Loans — remaining balance
    for loan in loans:
        paid = sum(float(p.amount) for p in loan.payments)
        remaining = float(loan.principal) - paid
        if remaining <= 0:
            continue
        _add(loan.person_id, "owed_to_me" if loan.direction == "lent" else "i_owe", remaining)

    # Bills this month
    bill_payments = db.query(BillPayment).filter(
        BillPayment.month == month, BillPayment.year == year,
        BillPayment.bill_id.in_([b.id for b in bills]),
    ).all() if bills else []

    def _bill_paid(bid, period):
        return any(bp.bill_id == bid and (period is None or bp.period == period) for bp in bill_payments)

    for bill in bills:
        parts = bill.participants or []
        non_me = [p for p in parts if p != ME_ID]
        for prd in _relevant_periods(bill.frequency, bill.due_day, period):
            paid_check = prd if bill.frequency == "biweekly" else None
            if _bill_paid(bill.id, paid_check):
                continue
            for pid in non_me:
                _add(pid, "owed_to_me", participant_share(bill.amount, parts, bill.participant_amounts, pid))
            if bill.payable_to:
                _add(bill.payable_to, "i_owe", my_share(bill.amount, parts, bill.participant_amounts))

    # Installments this month — others' unpaid shares
    inst_payments = db.query(InstallmentPayment).filter(
        InstallmentPayment.month == month, InstallmentPayment.year == year,
        InstallmentPayment.installment_id.in_([i.id for i in installments]),
    ).all() if installments else []

    def _inst_paid(iid, period):
        return any(ip.installment_id == iid and (period is None or ip.period == period) for ip in inst_payments)

    for inst in installments:
        parts = inst.participants or []
        non_me = [p for p in parts if p != ME_ID]
        if not non_me:
            continue
        for prd in _relevant_periods(inst.frequency, inst.due_day, period):
            paid_check = prd if inst.frequency == "biweekly" else None
            if _inst_paid(inst.id, paid_check):
                continue
            for pid in non_me:
                _add(pid, "owed_to_me", participant_share(inst.installment_amount, parts, inst.participant_amounts, pid))

    # Expenses this month — others' unsettled shares (I paid; they owe me back)
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
        if not non_me:
            continue
        for pid in non_me:
            if (exp.id, pid) in exp_settled:
                continue
            _add(pid, "owed_to_me", participant_share(exp.amount, parts, exp.participant_amounts, pid))

    result = []
    for pid, entry in bal.items():
        owed = round(entry["owed"], 2)
        owe = round(entry["owe"], 2)
        if owed <= 0 and owe <= 0:
            continue
        p = people_map[pid]
        result.append({
            "person_id": pid,
            "name": p.nickname or p.name,
            "they_owe_me": owed,
            "i_owe_them": owe,
            "net": round(owed - owe, 2),
        })
    result.sort(key=lambda x: -abs(x["net"]))
    return result
