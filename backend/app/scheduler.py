"""Background scheduler that sends Telegram reminders for upcoming period bills.

Runs every few minutes; for each user with bill reminders enabled it checks
whether "now" (in the user's timezone) has reached their configured Period 1 or
Period 2 reminder day+time, and if so sends a Telegram message listing that
period's unpaid bills. Sends are de-duplicated per calendar month.

Day-of-month is clamped to the month's actual length, so a P2 reminder set for
the 30th still fires on Feb 28th (or 29th), Apr 30th, etc.
"""
import logging
from calendar import monthrange
from datetime import datetime, timedelta

import httpx
from sqlalchemy import or_

from app.database import SessionLocal
from app.models.user import User, UserSettings
from app.models.bill import Bill, BillPayment
from app.models.installment import InstallmentPayment
from app.finance import (
    period_of, i_am_participant, has_split, active_installments, compute_people_balances,
)

logger = logging.getLogger("trackit.reminders")

CURRENCY_SYMBOLS = {"PHP": "₱", "USD": "$", "EUR": "€", "JPY": "¥", "SGD": "S$"}

_scheduler = None


def _fmt(amount, currency):
    sym = CURRENCY_SYMBOLS.get(currency, currency)
    return f"{sym}{float(amount or 0):,.2f}"


def _unpaid_bills_for_period(db, user, month, year, period):
    """Active, unpaid bills due in `period` that I'm a participant in."""
    bills = db.query(Bill).filter(
        Bill.user_id == user.id,
        Bill.start_year * 100 + Bill.start_month <= year * 100 + month,
    ).filter(
        (Bill.end_year == None) | (Bill.end_year * 100 + (Bill.end_month or 12) >= year * 100 + month)
    ).all()
    if not bills:
        return []
    paid_ids = {
        bp.bill_id for bp in db.query(BillPayment).filter(
            BillPayment.month == month, BillPayment.year == year,
            BillPayment.bill_id.in_([b.id for b in bills]),
        ).all()
    }
    out = [
        b for b in bills
        if period_of(b.due_day) == period and b.id not in paid_ids and i_am_participant(b.participants)
    ]
    out.sort(key=lambda b: b.due_day)
    return out


def _unpaid_installments_for_period(db, user, month, year, period):
    """Active, unpaid installments due in `period` that I'm a participant in."""
    insts = active_installments(db, user, month, year)
    if not insts:
        return []
    pays = db.query(InstallmentPayment).filter(
        InstallmentPayment.month == month, InstallmentPayment.year == year,
        InstallmentPayment.installment_id.in_([i.id for i in insts]),
    ).all()

    def paid(iid, per):
        return any(ip.installment_id == iid and (per is None or ip.period == per) for ip in pays)

    out = []
    for inst in insts:
        if not i_am_participant(inst.participants):
            continue
        if inst.frequency == "biweekly":
            if paid(inst.id, period):
                continue
        else:
            if period_of(inst.due_day) != period:
                continue
            if paid(inst.id, None):
                continue
        out.append(inst)
    return out


def build_period_message(db, user, month, year, period):
    rng = "1st–15th" if period == 1 else "16th–end"
    label = datetime(year, month, 1).strftime("%B %Y")
    bills = _unpaid_bills_for_period(db, user, month, year, period)
    insts = _unpaid_installments_for_period(db, user, month, year, period)

    if not bills and not insts:
        return f"🔔 track.it — Due {rng}, {label}\n\nNo unpaid bills or installments. 🎉"

    lines = [f"🔔 track.it — Due {rng}, {label}:"]
    total = 0.0
    any_split = False

    if bills:
        lines.append("")
        lines.append("Bills:")
        for b in bills:
            star = "*" if has_split(b.participants) else ""
            any_split = any_split or bool(star)
            if b.amount is not None:
                total += float(b.amount)
                amt = _fmt(b.amount, user.currency)
            else:
                amt = "variable"
            lines.append(f"• {b.name}{star} — {amt} (due {b.due_day})")

    if insts:
        lines.append("")
        lines.append("Installments:")
        for i in insts:
            star = "*" if has_split(i.participants) else ""
            any_split = any_split or bool(star)
            total += float(i.installment_amount)
            due = str(i.due_day) if i.due_day else "—"
            lines.append(f"• {i.name}{star} — {_fmt(i.installment_amount, user.currency)} (due {due})")

    lines.append("")
    lines.append(f"Total: {_fmt(total, user.currency)}")
    if any_split:
        lines.append("* shared with others")
    return "\n".join(lines)


def build_balance_message(db, user, month, year, period=None):
    """Summary of who owes me and whom I owe, net per person.

    If `period` is given, only that period's split bills/installments count
    (loans always do). Header notes the period.
    """
    rows = compute_people_balances(db, user, month, year, period)
    label = datetime(year, month, 1).strftime("%B %Y")
    if period:
        rng = "1st–15th" if period == 1 else "16th–end"
        title = f"💰 track.it — Balances · {rng}, {label}"
    else:
        title = f"💰 track.it — Balances, {label}"
    owed = [r for r in rows if r["net"] > 0.005]
    owe = [r for r in rows if r["net"] < -0.005]

    if not owed and not owe:
        return f"{title}\n\nAll settled up. 🎉"

    lines = [f"{title}:"]
    if owed:
        lines.append("")
        lines.append("They owe me:")
        for r in owed:
            lines.append(f"• {r['name']} — {_fmt(r['net'], user.currency)}")
    if owe:
        lines.append("")
        lines.append("I owe:")
        for r in owe:
            lines.append(f"• {r['name']} — {_fmt(-r['net'], user.currency)}")

    net_total = sum(r["net"] for r in rows)
    lines.append("")
    lines.append(f"Net: {'+' if net_total >= 0 else '−'}{_fmt(abs(net_total), user.currency)}")
    return "\n".join(lines)


def send_telegram(token, chat_id, text):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        with httpx.Client(timeout=10) as client:
            resp = client.post(url, json={"chat_id": chat_id, "text": text})
        return resp.status_code == 200
    except httpx.HTTPError as exc:
        logger.warning("Telegram send failed: %s", exc)
        return False


def _next_month(year, month):
    return (year + 1, 1) if month == 12 else (year, month + 1)


def _is_due(day_cfg, time_cfg, local_now):
    """True if local_now is on the (clamped) configured day and at/after the time."""
    last_day = monthrange(local_now.year, local_now.month)[1]
    eff_day = min(max(int(day_cfg or 1), 1), last_day)
    if local_now.day != eff_day:
        return False
    try:
        hh, mm = (int(x) for x in str(time_cfg or "09:00").split(":"))
    except (ValueError, AttributeError):
        hh, mm = 9, 0
    target = local_now.replace(hour=hh, minute=mm, second=0, microsecond=0)
    return local_now >= target


def check_and_send_reminders():
    db = SessionLocal()
    try:
        rows = db.query(UserSettings).filter(
            or_(
                UserSettings.bill_reminder_enabled.is_(True),
                UserSettings.balance_reminder_enabled.is_(True),
            )
        ).all()
        for s in rows:
            if not (s.telegram_enabled and s.telegram_bot_token and s.telegram_chat_id):
                continue
            user = db.query(User).filter(User.id == s.user_id).first()
            if not user:
                continue
            offset = s.reminder_utc_offset if s.reminder_utc_offset is not None else 8
            local_now = datetime.utcnow() + timedelta(hours=offset)

            # ── Shared P1/P2 schedule; bill and balance messages are sent
            #    independently (each with its own enable flag + dedup stamp). ──
            configs = (
                (1, s.p1_reminder_day, s.p1_reminder_time, bool(s.p1_lead_prev_month), s.p1_last_sent, s.balance_p1_last_sent),
                (2, s.p2_reminder_day, s.p2_reminder_time, bool(s.p2_lead_prev_month), s.p2_last_sent, s.balance_p2_last_sent),
            )
            for period, day, time_, lead, bill_last, bal_last in configs:
                if not _is_due(day, time_, local_now):
                    continue
                # Fires on `day` of the current month. With "lead" it's advance
                # notice for next month; otherwise it's this month.
                ty, tm = _next_month(local_now.year, local_now.month) if lead else (local_now.year, local_now.month)
                stamp = f"{ty}-{tm:02d}"

                if s.bill_reminder_enabled and bill_last != stamp:
                    msg = build_period_message(db, user, tm, ty, period)
                    if send_telegram(s.telegram_bot_token, s.telegram_chat_id, msg):
                        if period == 1:
                            s.p1_last_sent = stamp
                        else:
                            s.p2_last_sent = stamp
                        db.commit()
                        logger.info("Sent P%s bill reminder to user %s for %s", period, user.id, stamp)

                if s.balance_reminder_enabled and bal_last != stamp:
                    msg = build_balance_message(db, user, tm, ty, period)
                    if send_telegram(s.telegram_bot_token, s.telegram_chat_id, msg):
                        if period == 1:
                            s.balance_p1_last_sent = stamp
                        else:
                            s.balance_p2_last_sent = stamp
                        db.commit()
                        logger.info("Sent P%s balance reminder to user %s for %s", period, user.id, stamp)
    except Exception:  # noqa: BLE001 — never let the scheduler thread die
        logger.exception("Reminder check failed")
    finally:
        db.close()


def start_scheduler():
    global _scheduler
    if _scheduler is not None:
        return
    from apscheduler.schedulers.background import BackgroundScheduler
    _scheduler = BackgroundScheduler(daemon=True)
    _scheduler.add_job(
        check_and_send_reminders, "interval", minutes=5,
        id="bill_reminders", coalesce=True, max_instances=1,
    )
    _scheduler.start()
    logger.info("Reminder scheduler started")
