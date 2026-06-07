"""Builders that turn track.it data into Telegram messages + inline keyboards.

Kept separate from `handlers` (which owns dispatch/IO) and imported lazily by the
scheduler so reminders can carry the same pay buttons the /due view uses.
"""
from calendar import monthrange
from datetime import datetime

from sqlalchemy import func

from app.models.expense import Expense
from app.models.income import Income
from app.models.loan import Loan
from app.finance import compute_people_balances
from app.telegram.keyboards import inline
from app.scheduler import (
    _fmt, build_period_message,
    _unpaid_bills_for_period, _unpaid_installments_for_period,
)

MONTH_NAMES = [
    "", "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]


def fmt(user, amount):
    return _fmt(amount, user.currency)


def _prev_month(year, month):
    return (year - 1, 12) if month == 1 else (year, month - 1)


def _next_month(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


# ── F2 / F4 — Due, with period toggle and tap-to-pay buttons ─────────────────

def due_view(db, user, year, month, period):
    """(text, reply_markup) for the period's unpaid bills/installments."""
    text = build_period_message(db, user, month, year, period)
    bills = _unpaid_bills_for_period(db, user, month, year, period)
    insts = _unpaid_installments_for_period(db, user, month, year, period)

    rows = []
    for b in bills:
        p = period if b.frequency == "biweekly" else 0
        rows.append([(f"✓ {b.name}", f"pay:b:{b.id}:{year}:{month}:{p}")])
    for i in insts:
        p = period if i.frequency == "biweekly" else 0
        rows.append([(f"✓ {i.name}", f"pay:i:{i.id}:{year}:{month}:{p}")])

    other = 2 if period == 1 else 1
    other_label = "16th–end ▸" if period == 1 else "◂ 1st–15th"
    rows.append([(other_label, f"due:{year}:{month}:{other}")])
    return text, inline(rows)


# ── F3 — Balances list + per-person drill-in ─────────────────────────────────

def balances_list_view(db, user, year, month):
    rows_data = compute_people_balances(db, user, month, year)
    label = MONTH_NAMES[month] + f" {year}"
    if not rows_data:
        return f"💰 Balances, {label}\n\nAll settled up. 🎉", inline([])

    lines = [f"💰 Balances, {label}\n", "Tap a name for details:"]
    buttons = []
    for r in rows_data:
        net = r["net"]
        arrow = "→ owes you" if net > 0 else ("← you owe" if net < 0 else "settled")
        label_btn = f"{r['name']} · {fmt(user, abs(net))} {arrow}"
        buttons.append([(label_btn, f"bal:p:{r['person_id']}:{year}:{month}")])
    net_total = sum(r["net"] for r in rows_data)
    sign = "+" if net_total >= 0 else "−"
    lines.append(f"\nNet: {sign}{fmt(user, abs(net_total))}")
    return "\n".join(lines), inline(buttons)


def balance_detail_view(db, user, person_id, year, month):
    rows_data = compute_people_balances(db, user, month, year)
    row = next((r for r in rows_data if r["person_id"] == person_id), None)
    label = MONTH_NAMES[month] + f" {year}"
    back = [("◂ Back", f"bal:l:{year}:{month}")]
    if not row:
        return f"💰 Nothing outstanding with this person for {label}.", inline([back])

    lines = [f"💰 {row['name']} · {label}\n"]
    if row["they_owe_me"] > 0.005:
        lines.append(f"They owe you: {fmt(user, row['they_owe_me'])}")
    if row["i_owe_them"] > 0.005:
        lines.append(f"You owe them: {fmt(user, row['i_owe_them'])}")
    net = row["net"]
    verb = "they owe you" if net > 0 else ("you owe them" if net < 0 else "settled")
    lines.append(f"\nNet: {fmt(user, abs(net))} ({verb})")

    loans = db.query(Loan).filter(
        Loan.user_id == user.id, Loan.person_id == person_id, Loan.status == "active",
    ).all()
    if loans:
        lines.append("\nActive loans:")
        for ln in loans:
            paid = sum(float(p.amount) for p in ln.payments)
            remaining = float(ln.principal) - paid
            direction = "you lent" if ln.direction == "lent" else "you borrowed"
            lines.append(f"• {direction} — {fmt(user, remaining)} remaining")
    return "\n".join(lines), inline([back])


# ── F7 — Spending queries ────────────────────────────────────────────────────

def _category_totals(db, user, year, month):
    rows = db.query(
        Expense.category, func.sum(Expense.amount).label("total"),
    ).filter(
        Expense.user_id == user.id, Expense.month == month, Expense.year == year,
    ).group_by(Expense.category).all()
    return sorted([(r.category, float(r.total)) for r in rows], key=lambda x: -x[1])


def spent_summary_view(db, user, year, month):
    label = MONTH_NAMES[month] + f" {year}"
    cats = _category_totals(db, user, year, month)
    total = sum(t for _, t in cats)
    if not cats:
        text = f"📊 Spent · {label}\n\nNo expenses logged yet."
    else:
        lines = [f"📊 Spent · {label}\n", f"Total: {fmt(user, total)}\n", "Top categories:"]
        for cat, amt in cats[:5]:
            pct = round(amt / total * 100) if total else 0
            lines.append(f"• {cat} — {fmt(user, amt)} ({pct}%)")
        text = "\n".join(lines)

    py, pm = _prev_month(year, month)
    rows = [
        [("This month", f"spent:m:{datetime.utcnow().year}:{datetime.utcnow().month}"),
         ("Last month", f"spent:m:{py}:{pm}")],
        [("By category ▸", f"spent:cats:{year}:{month}")],
    ]
    return text, inline(rows)


def spent_categories_view(db, user, year, month):
    label = MONTH_NAMES[month] + f" {year}"
    cats = _category_totals(db, user, year, month)
    if not cats:
        return f"📊 By category · {label}\n\nNo expenses logged yet.", inline(
            [[("◂ Back", f"spent:m:{year}:{month}")]])
    buttons = [[(f"{cat} · {fmt(user, amt)}", f"spent:c:{year}:{month}:{cat}")] for cat, amt in cats]
    buttons.append([("◂ Back", f"spent:m:{year}:{month}")])
    return f"📊 By category · {label}\n\nTap to see entries:", inline(buttons)


def spent_category_detail_view(db, user, year, month, category):
    label = MONTH_NAMES[month] + f" {year}"
    exps = db.query(Expense).filter(
        Expense.user_id == user.id, Expense.month == month,
        Expense.year == year, Expense.category == category,
    ).order_by(Expense.date.desc()).all()
    total = sum(float(e.amount) for e in exps)
    lines = [f"📊 {category} · {label}\n", f"Total: {fmt(user, total)}\n"]
    for e in exps[:15]:
        name = e.name or e.note or category
        lines.append(f"• {e.date.strftime('%b %d')} — {name} · {fmt(user, e.amount)}")
    if len(exps) > 15:
        lines.append(f"…and {len(exps) - 15} more")
    back = [[("◂ Categories", f"spent:cats:{year}:{month}")]]
    return "\n".join(lines), inline(back)


# ── F6 — Digest ──────────────────────────────────────────────────────────────

def digest_view(db, user, year, month):
    """Spending so far + what's due in the next 3 days, with action buttons."""
    from datetime import date, timedelta
    from app.telegram.keyboards import BTN_EXPENSE

    label = MONTH_NAMES[month] + f" {year}"
    cats = _category_totals(db, user, year, month)
    total = sum(t for _, t in cats)

    income = float(db.query(func.sum(Income.amount)).filter_by(
        user_id=user.id, month=month, year=year,
    ).scalar() or 0)

    lines = [f"🗒️ track.it digest · {label}\n"]
    lines.append(f"Spent so far: {fmt(user, total)}")
    if income:
        lines.append(f"Income: {fmt(user, income)}  ·  Net: {fmt(user, income - total)}")
    if cats:
        lines.append("\nTop categories:")
        for cat, amt in cats[:3]:
            lines.append(f"• {cat} — {fmt(user, amt)}")

    # What's due in the next 3 days (both periods, clamped due day).
    today = date(year, month, 1) if (year, month) != (datetime.utcnow().year, datetime.utcnow().month) else date.today()
    horizon = today + timedelta(days=3)
    last_day = monthrange(year, month)[1]
    due_soon = []
    for period in (1, 2):
        for b in _unpaid_bills_for_period(db, user, month, year, period):
            dd = min(int(b.due_day), last_day)
            ddate = date(year, month, dd)
            if today <= ddate <= horizon:
                amt = fmt(user, b.amount) if b.amount is not None else "variable"
                due_soon.append((ddate, f"{b.name} — {amt} (due {dd})"))
    if due_soon:
        due_soon.sort(key=lambda x: x[0])
        lines.append("\nDue in the next 3 days:")
        for _, txt in due_soon:
            lines.append(f"• {txt}")

    cur_period = 1 if today.day <= 15 else 2
    rows = [[
        ("➕ Add expense", "act:addexp"),
        ("📅 Due", f"due:{year}:{month}:{cur_period}"),
    ]]
    return "\n".join(lines), inline(rows)
