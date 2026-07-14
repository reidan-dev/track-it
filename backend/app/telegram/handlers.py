"""Telegram update dispatch: commands, menu taps, prompt flows, callbacks.

`process_update` is the single entry point. The user is already resolved from
the per-user webhook secret, so every handler trusts `user`/`settings`.
"""
import base64
import logging
import re
from datetime import datetime, timedelta, date

from app.models.expense import Expense
from app.models.income import Income
from app.models.loan import Loan
from app.models.bill import Bill, BillPayment
from app.models.installment import Installment, InstallmentPayment
from app.models.person import Person
from app.models.payment_method import PaymentMethod
from app.finance import period_of
from app.telegram import api
from app.telegram.state import get_state, set_state, update_data, clear_state
from app.telegram.keyboards import (
    main_menu, inline, cancel_row, COMMANDS,
    BTN_EXPENSE, BTN_INCOME, BTN_DUE, BTN_BALANCES, BTN_SPENT, BTN_LEND,
)
from app.telegram import views

logger = logging.getLogger("trackit.telegram")

HELP_TEXT = (
    "🦊 track.it bot\n\n"
    "Tap the menu buttons, or use:\n"
    "• ➕ Expense — log spending (or just type `200 lunch gcash`)\n"
    "   add `split Jay, Ben` to share it, `by Jay` if they fronted it,\n"
    "   and `#food` to set the category — e.g. `900 dinner by Jay split Jay Ben`\n"
    "• ➕ Income — log income (or `+50000 salary`)\n"
    "• 📅 Due — what's due, tap ✓ to mark paid\n"
    "• 💰 Balances — who owes who\n"
    "• 📊 Spent — spending summary\n"
    "• 🤝 Lend/Borrow — record a loan (or `lent 500 to Maria`)\n\n"
    "Send a photo of a receipt to attach it. /cancel stops any step."
)


# ── helpers ──────────────────────────────────────────────────────────────────

def _local_now(settings):
    offset = settings.reminder_utc_offset if settings.reminder_utc_offset is not None else 8
    return datetime.utcnow() + timedelta(hours=offset)


def _period_ctx(settings):
    now = _local_now(settings)
    period = 1 if now.day <= 15 else 2
    return now.date(), now.month, now.year, period


def _parse_amount(text):
    if not text:
        return None
    m = re.search(r"\d[\d,]*\.?\d*", text.replace(" ", ""))
    if not m:
        return None
    try:
        return float(m.group(0).replace(",", ""))
    except ValueError:
        return None


def _payment_methods(db, user):
    return db.query(PaymentMethod).filter(PaymentMethod.user_id == user.id).order_by(
        PaymentMethod.is_default.desc(), PaymentMethod.id,
    ).all()


def _month_expense_total(db, user, month, year):
    return float(sum(
        float(e.amount) for e in db.query(Expense).filter(
            Expense.user_id == user.id, Expense.month == month, Expense.year == year,
        ).all()
    ))


def _send_menu(token, chat_id, text):
    api.send_message(token, chat_id, text, reply_markup=main_menu())


# ── entry point ──────────────────────────────────────────────────────────────

def process_update(db, settings, user, update):
    token = settings.telegram_bot_token
    try:
        if "callback_query" in update:
            handle_callback(db, settings, user, token, update["callback_query"])
        elif "message" in update:
            handle_message(db, settings, user, token, update["message"])
    except Exception:  # noqa: BLE001 — a bad update must never 500 the webhook
        logger.exception("Telegram update handling failed")


# ── messages ─────────────────────────────────────────────────────────────────

def handle_message(db, settings, user, token, message):
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    if chat_id is None:
        return

    if "photo" in message:
        handle_photo(db, settings, user, token, chat_id, message)
        return

    text = (message.get("text") or "").strip()
    if not text:
        return

    if text.startswith("/"):
        handle_command(db, settings, user, token, chat_id, text)
        return

    # Menu buttons take priority — tapping one cleanly switches out of any
    # in-progress prompt flow (the flow starters reset the conversation state).
    routes = {
        BTN_EXPENSE: lambda: start_add_expense(db, user, token, chat_id),
        BTN_INCOME: lambda: start_add_income(db, user, token, chat_id),
        BTN_DUE: lambda: send_due(db, settings, user, token, chat_id),
        BTN_BALANCES: lambda: send_balances(db, settings, user, token, chat_id),
        BTN_SPENT: lambda: send_spent(db, settings, user, token, chat_id),
        BTN_LEND: lambda: start_loan(db, user, token, chat_id),
    }
    if text in routes:
        clear_state(db, user.id, chat_id)
        routes[text]()
        return

    # Mid-flow? feed the answer to the active prompt.
    state = get_state(db, user.id, chat_id)
    if state and state.flow:
        handle_flow_input(db, settings, user, token, chat_id, state, text)
        return

    # Free-text accelerators.
    if try_accelerators(db, settings, user, token, chat_id, text):
        return

    _send_menu(token, chat_id, "Not sure what you mean — pick an option below or /help.")


def handle_command(db, settings, user, token, chat_id, text):
    cmd = text.split()[0].lstrip("/").split("@")[0].lower()
    arg = text[len(text.split()[0]):].strip()
    if cmd == "start":
        do_start(db, settings, user, token, chat_id)
    elif cmd == "cancel":
        clear_state(db, user.id, chat_id)
        _send_menu(token, chat_id, "Okay, cancelled. ✖️")
    elif cmd == "help":
        _send_menu(token, chat_id, HELP_TEXT)
    elif cmd in ("add", "expense"):
        start_add_expense(db, user, token, chat_id)
    elif cmd == "income":
        start_add_income(db, user, token, chat_id)
    elif cmd == "due":
        send_due(db, settings, user, token, chat_id)
    elif cmd in ("balances", "balance"):
        send_balances(db, settings, user, token, chat_id)
    elif cmd in ("spent", "spend"):
        if arg and try_spent_query(db, settings, user, token, chat_id, arg):
            return
        send_spent(db, settings, user, token, chat_id)
    elif cmd in ("lend", "loan", "borrow"):
        start_loan(db, user, token, chat_id)
    else:
        _send_menu(token, chat_id, HELP_TEXT)


def do_start(db, settings, user, token, chat_id):
    settings.telegram_chat_id = str(chat_id)
    settings.telegram_enabled = True
    db.commit()
    # Keep the slash menu fresh on every (re)link.
    api.set_my_commands(token, COMMANDS)
    api.send_message(
        token, chat_id,
        "✅ This chat is linked to your track.it account.\n\n" + HELP_TEXT,
        reply_markup=main_menu(),
    )


# ── read flows (F2 / F3 / F7) ────────────────────────────────────────────────

def send_due(db, settings, user, token, chat_id):
    _, month, year, period = _period_ctx(settings)
    text, markup = views.due_view(db, user, year, month, period)
    api.send_message(token, chat_id, text, reply_markup=markup)


def send_balances(db, settings, user, token, chat_id):
    _, month, year, _ = _period_ctx(settings)
    text, markup = views.balances_list_view(db, user, year, month)
    api.send_message(token, chat_id, text, reply_markup=markup)


def send_spent(db, settings, user, token, chat_id):
    _, month, year, _ = _period_ctx(settings)
    text, markup = views.spent_summary_view(db, user, year, month)
    api.send_message(token, chat_id, text, reply_markup=markup)


def try_spent_query(db, settings, user, token, chat_id, arg):
    """`/spent food` → jump straight to that category's detail."""
    _, month, year, _ = _period_ctx(settings)
    cats = {c.lower(): c for c, _ in views._category_totals(db, user, year, month)}
    match = cats.get(arg.strip().lower())
    if not match:
        return False
    text, markup = views.spent_category_detail_view(db, user, year, month, match)
    api.send_message(token, chat_id, text, reply_markup=markup)
    return True


# ── F1 — add expense (guided + accelerator) ──────────────────────────────────

def start_add_expense(db, user, token, chat_id, receipt=None):
    data = {"receipt": receipt} if receipt else {}
    msg = api.send_message(token, chat_id, "➕ New expense — how much?",
                           reply_markup=inline([cancel_row()]))
    set_state(db, user.id, chat_id, flow="add_expense", step="amount", data=data,
              prompt_message_id=(msg or {}).get("message_id"))


def _ask_expense_pm(db, user, token, chat_id):
    methods = _payment_methods(db, user)
    if not methods:
        return False
    rows = [[(f"{(m.icon + ' ') if m.icon else ''}{m.name}", f"xpm:{i}")]
            for i, m in enumerate(methods)]
    rows.append([("Skip", "xpm:s")])
    api.send_message(token, chat_id, "Payment method?", reply_markup=inline(rows))
    return True


def finalize_expense(db, settings, user, token, chat_id, data):
    today, month, year, period = _period_ctx(settings)
    fronted = data.get("paid_by")  # person id who fronted it (I owe them the full amount)
    expense = Expense(
        user_id=user.id,
        name=data.get("name"),
        amount=data["amount"],
        category=data.get("category") or "Other",
        date=today,
        payment_method=data.get("payment_method"),
        period=period,
        month=month,
        year=year,
        participants=data.get("participants") or [0],
        paid_by=fronted,
        payable_to=fronted,
        receipt_image=data.get("receipt"),
    )
    db.add(expense)
    db.commit()
    clear_state(db, user.id, chat_id)
    total = _month_expense_total(db, user, month, year)
    bits = [f"✅ Added {views.fmt(user, expense.amount)}"]
    if expense.name:
        bits.append(f"· {expense.name}")
    if expense.payment_method:
        bits.append(f"via {expense.payment_method}")
    if data.get("receipt"):
        bits.append("📎")
    lines = [" ".join(bits)]
    if data.get("split_names"):
        lines.append(f"👥 Split with {', '.join(data['split_names'])}")
    if data.get("fronted_name"):
        lines.append(f"💸 {data['fronted_name']} fronted it — you owe {views.fmt(user, expense.amount)}")
    lines.append(f"This month: {views.fmt(user, total)}")
    _send_menu(token, chat_id, "\n".join(lines))


# ── F5 — add income ──────────────────────────────────────────────────────────

INCOME_TYPES = ["Salary", "Freelance", "Other"]


def start_add_income(db, user, token, chat_id):
    msg = api.send_message(token, chat_id, "➕ New income — how much?",
                           reply_markup=inline([cancel_row()]))
    set_state(db, user.id, chat_id, flow="add_income", step="amount", data={},
              prompt_message_id=(msg or {}).get("message_id"))


def finalize_income(db, settings, user, token, chat_id, data):
    today, month, year, period = _period_ctx(settings)
    income = Income(
        user_id=user.id,
        source=data.get("source") or "Income",
        amount=data["amount"],
        date=today,
        type=data.get("type") or "Other",
        period=period,
        month=month,
        year=year,
    )
    db.add(income)
    db.commit()
    clear_state(db, user.id, chat_id)
    _send_menu(token, chat_id,
               f"✅ Income {views.fmt(user, income.amount)} · {income.source} ({income.type})")


# ── F8 — loan / IOU ──────────────────────────────────────────────────────────

def start_loan(db, user, token, chat_id):
    rows = [[("I lent", "loan:lent"), ("I borrowed", "loan:borrowed")], cancel_row()]
    msg = api.send_message(token, chat_id, "🤝 Loan — which way?", reply_markup=inline(rows))
    set_state(db, user.id, chat_id, flow="loan", step="direction", data={},
              prompt_message_id=(msg or {}).get("message_id"))


def _ask_loan_person(db, user, token, chat_id):
    people = db.query(Person).filter(Person.user_id == user.id).order_by(Person.name).all()
    rows = [[((p.nickname or p.name), f"loan:p:{p.id}")] for p in people]
    rows.append([("➕ Someone new", "loan:new")])
    rows.append(cancel_row())
    api.send_message(token, chat_id, "Who?", reply_markup=inline(rows))


def finalize_loan(db, settings, user, token, chat_id, data):
    today, _, _, _ = _period_ctx(settings)
    loan = Loan(
        user_id=user.id,
        person_id=data["person_id"],
        direction=data["direction"],
        principal=data["amount"],
        start_date=today,
        status="active",
        notes=data.get("note"),
    )
    db.add(loan)
    db.commit()
    clear_state(db, user.id, chat_id)
    person = db.query(Person).filter(Person.id == data["person_id"]).first()
    name = (person.nickname or person.name) if person else "them"
    verb = "lent to" if data["direction"] == "lent" else "borrowed from"
    _send_menu(token, chat_id, f"✅ Recorded: {views.fmt(user, loan.principal)} {verb} {name}.")


# ── prompt-flow text input ───────────────────────────────────────────────────

def handle_flow_input(db, settings, user, token, chat_id, state, text):
    flow, step = state.flow, state.step

    if flow == "add_expense":
        if step == "amount":
            amt = _parse_amount(text)
            if amt is None or amt <= 0:
                api.send_message(token, chat_id, "Please send a number, e.g. 200.")
                return
            update_data(db, state, step="name", amount=amt)
            api.send_message(token, chat_id, "What's it for?", reply_markup=inline([cancel_row()]))
        elif step == "name":
            update_data(db, state, step="pm", name=text)
            if not _ask_expense_pm(db, user, token, chat_id):
                finalize_expense(db, settings, user, token, chat_id, dict(state.data))
        return

    if flow == "add_income":
        if step == "amount":
            amt = _parse_amount(text)
            if amt is None or amt <= 0:
                api.send_message(token, chat_id, "Please send a number, e.g. 50000.")
                return
            update_data(db, state, step="source", amount=amt)
            api.send_message(token, chat_id, "Source? (e.g. Salary, Client X)",
                             reply_markup=inline([cancel_row()]))
        elif step == "source":
            update_data(db, state, step="type", source=text)
            rows = [[(t, f"itype:{t}") for t in INCOME_TYPES], cancel_row()]
            api.send_message(token, chat_id, "Type?", reply_markup=inline(rows))
        return

    if flow == "loan":
        if step == "newperson":
            person = Person(user_id=user.id, name=text)
            db.add(person)
            db.commit()
            db.refresh(person)
            update_data(db, state, step="amount", person_id=person.id)
            api.send_message(token, chat_id, f"How much? (with {text})",
                             reply_markup=inline([cancel_row()]))
        elif step == "amount":
            amt = _parse_amount(text)
            if amt is None or amt <= 0:
                api.send_message(token, chat_id, "Please send a number, e.g. 500.")
                return
            update_data(db, state, step="note", amount=amt)
            api.send_message(token, chat_id, "Add a note? Send '-' to skip.",
                             reply_markup=inline([cancel_row()]))
        elif step == "note":
            note = None if text.strip() in ("-", "") else text.strip()
            data = dict(state.data)
            data["note"] = note
            finalize_loan(db, settings, user, token, chat_id, data)
        return


# ── callbacks (inline button taps) ───────────────────────────────────────────

def handle_callback(db, settings, user, token, cq):
    data = cq.get("data") or ""
    cq_id = cq.get("id")
    message = cq.get("message") or {}
    chat = message.get("chat", {})
    chat_id = chat.get("id")
    message_id = message.get("message_id")

    def edit(text, markup):
        api.edit_message_text(token, chat_id, message_id, text, reply_markup=markup)

    parts = data.split(":")
    head = parts[0]

    if data == "cancel":
        clear_state(db, user.id, chat_id)
        api.answer_callback_query(token, cq_id, "Cancelled")
        edit("Cancelled. ✖️", None)
        return

    if head == "due":
        _, y, m, p = parts
        text, markup = views.due_view(db, user, int(y), int(m), int(p))
        edit(text, markup)
        api.answer_callback_query(token, cq_id)
        return

    if head == "pay":
        _, kind, oid, y, m, viewp = parts
        toast = _record_payment(db, user, kind, int(oid), int(y), int(m), int(viewp))
        text, markup = views.due_view(db, user, int(y), int(m), int(viewp))
        edit(text, markup)
        api.answer_callback_query(token, cq_id, toast)
        return

    if head == "bal":
        if parts[1] == "l":
            _, _, y, m = parts
            text, markup = views.balances_list_view(db, user, int(y), int(m))
        else:  # bal:p:{id}:{y}:{m}
            _, _, pid, y, m = parts
            text, markup = views.balance_detail_view(db, user, int(pid), int(y), int(m))
        edit(text, markup)
        api.answer_callback_query(token, cq_id)
        return

    if head == "spent":
        sub = parts[1]
        if sub == "m":
            text, markup = views.spent_summary_view(db, user, int(parts[2]), int(parts[3]))
        elif sub == "cats":
            text, markup = views.spent_categories_view(db, user, int(parts[2]), int(parts[3]))
        elif sub == "c":
            category = ":".join(parts[4:])  # tolerate ':' in category names
            text, markup = views.spent_category_detail_view(db, user, int(parts[2]), int(parts[3]), category)
        else:
            api.answer_callback_query(token, cq_id)
            return
        edit(text, markup)
        api.answer_callback_query(token, cq_id)
        return

    if head == "xpm":  # add-expense payment method picked
        state = get_state(db, user.id, chat_id)
        if not state or state.flow != "add_expense":
            api.answer_callback_query(token, cq_id, "Expired")
            return
        pm = None
        if parts[1] != "s":
            methods = _payment_methods(db, user)
            idx = int(parts[1])
            if 0 <= idx < len(methods):
                pm = methods[idx].name
        d = dict(state.data)
        d["payment_method"] = pm
        api.answer_callback_query(token, cq_id)
        finalize_expense(db, settings, user, token, chat_id, d)
        return

    if head == "itype":  # add-income type picked
        state = get_state(db, user.id, chat_id)
        if not state or state.flow != "add_income":
            api.answer_callback_query(token, cq_id, "Expired")
            return
        d = dict(state.data)
        d["type"] = parts[1]
        api.answer_callback_query(token, cq_id)
        finalize_income(db, settings, user, token, chat_id, d)
        return

    if head == "loan":
        sub = parts[1]
        state = get_state(db, user.id, chat_id)
        if not state or state.flow != "loan":
            api.answer_callback_query(token, cq_id, "Expired")
            return
        if sub in ("lent", "borrowed"):
            update_data(db, state, step="person", direction=sub)
            api.answer_callback_query(token, cq_id)
            _ask_loan_person(db, user, token, chat_id)
        elif sub == "new":
            update_data(db, state, step="newperson")
            api.answer_callback_query(token, cq_id)
            api.send_message(token, chat_id, "What's their name?", reply_markup=inline([cancel_row()]))
        elif sub == "p":
            update_data(db, state, step="amount", person_id=int(parts[2]))
            api.answer_callback_query(token, cq_id)
            api.send_message(token, chat_id, "How much?", reply_markup=inline([cancel_row()]))
        return

    if data == "act:addexp":  # from digest
        api.answer_callback_query(token, cq_id)
        start_add_expense(db, user, token, chat_id)
        return

    api.answer_callback_query(token, cq_id)


def _record_payment(db, user, kind, oid, year, month, viewp):
    """Idempotently mark a bill/installment paid for the period; returns a toast."""
    if kind == "b":
        bill = db.query(Bill).filter(Bill.id == oid, Bill.user_id == user.id).first()
        if not bill:
            return "Not found"
        period = viewp if bill.frequency == "biweekly" else None
        q = db.query(BillPayment).filter(
            BillPayment.bill_id == oid, BillPayment.month == month, BillPayment.year == year,
        )
        q = q.filter(BillPayment.period == period) if period is not None else q.filter(BillPayment.period.is_(None))
        if not q.first():
            db.add(BillPayment(bill_id=oid, month=month, year=year, period=period,
                               amount_paid=bill.amount))
            db.commit()
        return f"✓ {bill.name} marked paid"
    if kind == "i":
        inst = db.query(Installment).filter(Installment.id == oid, Installment.user_id == user.id).first()
        if not inst:
            return "Not found"
        period = viewp if inst.frequency == "biweekly" else None
        q = db.query(InstallmentPayment).filter(
            InstallmentPayment.installment_id == oid,
            InstallmentPayment.month == month, InstallmentPayment.year == year,
        )
        q = q.filter(InstallmentPayment.period == period) if period is not None else q.filter(InstallmentPayment.period.is_(None))
        if not q.first():
            db.add(InstallmentPayment(installment_id=oid, month=month, year=year, period=period))
            db.commit()
        return f"✓ {inst.name} marked paid"
    return "Done"


# ── F9 — receipt photo ───────────────────────────────────────────────────────

def handle_photo(db, settings, user, token, chat_id, message):
    photos = message.get("photo") or []
    if not photos:
        return
    file_id = photos[-1]["file_id"]  # largest size
    api.send_chat_action(token, chat_id, "typing")
    meta = api.get_file(token, file_id)
    receipt = None
    if meta and meta.get("file_path"):
        raw = api.download_file(token, meta["file_path"])
        if raw:
            receipt = "data:image/jpeg;base64," + base64.b64encode(raw).decode()
    if not receipt:
        api.send_message(token, chat_id, "Couldn't download that image, sorry. Try again?")
        return

    caption = (message.get("caption") or "").strip()
    amt = _parse_amount(caption)
    if amt and amt > 0:
        name = re.sub(r"^\D*\d[\d,]*\.?\d*\s*", "", caption).strip() or None
        finalize_expense(db, settings, user, token, chat_id,
                         {"amount": amt, "name": name, "receipt": receipt})
    else:
        start_add_expense(db, user, token, chat_id, receipt=receipt)


# ── free-text accelerators ───────────────────────────────────────────────────

_LOAN_RE = re.compile(r"^(lent|lend|borrowed|borrow)\s+(.+?)\s+(?:to|from)\s+(.+)$", re.I)
# Expense accelerator extras. `by` must come before `split` in the stop-lookahead
# of each so they can appear in either order.
_BY_RE = re.compile(r"\bby\s+([^\s,][^,]*?)(?=\s+split\b|\s+#|\s*$)", re.I)
_SPLIT_RE = re.compile(r"\bsplit(?:\s+with)?\s+(.+?)(?=\s+by\b|\s+#|\s*$)", re.I)
_CAT_RE = re.compile(r"#(\w+)")


def try_accelerators(db, settings, user, token, chat_id, text):
    # Loan: "lent 500 to Maria" / "borrowed 1000 from Dad"
    m = _LOAN_RE.match(text)
    if m:
        amt = _parse_amount(m.group(2))
        if amt:
            direction = "lent" if m.group(1).lower().startswith("len") else "borrowed"
            name = m.group(3).strip()
            person = _find_or_create_person(db, user, name)
            finalize_loan(db, settings, user, token, chat_id,
                          {"person_id": person.id, "direction": direction, "amount": amt, "note": None})
            return True

    # Income: "+50000 salary"
    if text.startswith("+"):
        amt = _parse_amount(text)
        if amt and amt > 0:
            rest = re.sub(r"^\+\s*[\d,]*\.?\d*\s*", "", text).strip()
            finalize_income(db, settings, user, token, chat_id,
                            {"amount": amt, "source": rest or "Income", "type": "Other"})
            return True

    # Expense: "200 lunch gcash" (leading number). Optional extras anywhere
    # after the name: "#food" category, "by Jay" (they fronted it),
    # "split Jay, Ben" (share the cost).
    if re.match(r"^\d", text):
        amt = _parse_amount(text)
        if amt and amt > 0:
            rest = re.sub(r"^[\d,]*\.?\d*\s*", "", text).strip()

            category = None
            m_cat = _CAT_RE.search(rest)
            if m_cat:
                category = m_cat.group(1).capitalize()
                rest = _CAT_RE.sub("", rest).strip()

            split_names, participants = [], None
            m_split = _SPLIT_RE.search(rest)
            if m_split:
                raw = re.split(r"\s*(?:,|&|\band\b)\s*|\s+", m_split.group(1).strip())
                rest = (rest[: m_split.start()] + " " + rest[m_split.end():]).strip()
                participants = [0]
                for nm in raw:
                    if not nm:
                        continue
                    p = _find_or_create_person(db, user, nm)
                    if p.id not in participants:
                        participants.append(p.id)
                        split_names.append(p.nickname or p.name)

            paid_by, fronted_name = None, None
            m_by = _BY_RE.search(rest)
            if m_by:
                p = _find_or_create_person(db, user, m_by.group(1).strip())
                paid_by, fronted_name = p.id, (p.nickname or p.name)
                rest = (rest[: m_by.start()] + " " + rest[m_by.end():]).strip()
                # The fronter shares the cost too when a split is given.
                if participants is not None and p.id not in participants:
                    participants.append(p.id)
                    split_names.append(fronted_name)

            pm = None
            methods = _payment_methods(db, user)
            if rest and methods:
                last = rest.split()[-1].lower()
                for mth in methods:
                    if mth.name.lower() == last:
                        pm = mth.name
                        rest = rest[: -len(rest.split()[-1])].strip()
                        break
            finalize_expense(db, settings, user, token, chat_id, {
                "amount": amt, "name": rest or None, "payment_method": pm,
                "category": category, "participants": participants,
                "paid_by": paid_by, "fronted_name": fronted_name,
                "split_names": split_names,
            })
            return True

    return False


def _find_or_create_person(db, user, name):
    people = db.query(Person).filter(Person.user_id == user.id).all()
    low = name.lower()
    for p in people:
        if (p.nickname or "").lower() == low or p.name.lower() == low:
            return p
    person = Person(user_id=user.id, name=name)
    db.add(person)
    db.commit()
    db.refresh(person)
    return person
