# track.it — Telegram Bot Feature Menu (UI-driven)

**Status today:** Telegram is *outbound only*. `backend/app/scheduler.py` pushes bill/balance
reminders on a P1/P2 schedule via `sendMessage`. There is no inbound handling — the bot can't
receive or respond to anything.

**Goal:** Pick features below to make the bot *interactive*, using Telegram's native UI
(buttons, prompts, menus) rather than memorized text commands. Mark each with `[x]` to select.
Selected items become a sequenced prompt plan.

**Design stance:** *button-first, free-text as an optional accelerator.* Tapping is unambiguous
and discoverable; free-text parsing is faster for power users but a fallback, not the default.

---

## Telegram UI primitives in play

- **Inline keyboard** — buttons attached under a message; a tap fires a `callback_query` with
  `callback_data`. Best for picking / confirming / marking. The message can be *edited in place*
  after a tap (e.g. strike through a paid bill).
- **Reply keyboard** — persistent buttons docked at the bottom of the chat. The always-visible
  main menu.
- **Force-reply / prompt** — bot asks a question; the user's next message is captured as the
  answer. Drives step-by-step entry without commands.
- **`setMyCommands`** — the `/` slash menu with descriptions.
- **Web App button** — opens a mini-app webview *inside* Telegram (could open track.it itself).

---

## F0 — Foundation (implied by selecting anything)

Required plumbing before any feature works:

- **Inbound pipeline** — Telegram webhook (or long polling) + a `/telegram/webhook` route that
  receives both `message` and `callback_query` updates.
- **Chat → user lookup** — resolve `chat_id` to a track.it user (see F10 `/start` linking).
- **Callback router** — dispatch `callback_data` (namespaced, e.g. `pay:bill:42:2026-06`) to
  handlers; edit the originating message after handling.
- **Conversation-state store** — a small per-chat record ("this chat is mid *add-expense*, step
  2, amount=200") so multi-step prompt flows survive between messages. Button-only flows can stay
  stateless by packing data into `callback_data`; prompt flows need this.

---

## Selection

- [x] **F1 — Add expense (guided)**
  Tap **➕ Expense** → prompt *"How much?"* → prompt *"What for?"* → inline buttons for payment
  method (from the user's `payment_methods`). Confirms with running month total.
  *Accelerator:* free-text `200 lunch gcash` skips straight to the confirm step.
  *Uses:* conversation-state, inline keyboard, expenses model.

- [x] **F2 — What's due (buttons)**
  Tap **📅 Due** → summary with `[This period] [Next period]` inline toggle that edits the same
  message. Reuses `build_period_message`. Each listed bill can carry a pay button (see F4).

- [x] **F3 — Balances (drill-in)**
  Tap **💰 Balances** → who owes me / whom I owe, each person rendered as a button → tap a name
  to drill into that person's detail. Reuses `build_balance_message`.
  *Uses:* inline keyboard, message edit-in-place.

- [x] **F4 — Mark paid (tap to settle)** ⭐ best UI fit
  Reminder / `/due` lists each unpaid bill as a `[✓ Rent] [✓ Internet]` inline button. Tap →
  records `BillPayment` / `InstallmentPayment` for the period, message edits in place (item
  struck through / removed, total updated). No numbers to type.
  *Uses:* inline keyboard, callback router, edit-in-place.

- [x] **F5 — Add income (guided)**
  Tap **➕ Income** → prompt amount → prompt source → optional payment-method buttons. Mirror of
  F1 for income entries. *Accelerator:* `+50000 salary`.

- [x] **F6 — Daily / weekly digest**
  Opt-in scheduled summary (extends the scheduler): spending total, top categories, budget
  remaining, and what's due in the next 3 days. Digest message carries action buttons
  (e.g. **Add expense**, **Mark paid**) to jump straight into the flows above.

- [x] **F7 — Spending queries (buttons)**
  Tap **📊 Spent** → inline buttons `[This month] [Last month] [By category]`; tapping a category
  drills in. Read-only analytics over expenses, all via taps. *Accelerator:* `/spent food`.

- [x] **F8 — Loan / IOU (guided)**
  Tap **🤝 Lend/Borrow** → choose direction `[I lent] [I borrowed]` → pick person (buttons, +
  *"someone new"* prompt) → prompt amount → optional note. Creates a loan, updates balances.
  *Accelerator:* `lent 500 to Maria`. *Uses:* conversation-state, inline keyboard, loans model.

- [x] **F9 — Receipt photo capture**
  Send a photo → bot stores it like the web receipt-attach flow. If the caption has an amount
  (`1200 dinner`) it creates the expense immediately; otherwise it prompts for amount/name with
  the guided flow, then attaches the image. *Uses:* file download, conversation-state, expenses.

- [x] **F10 — Onboarding, menu & command list**
  `/start` shows a one-tap **link this chat** button that binds `chat_id` to the user account
  (replaces manual chat-id entry in settings). Sets up the **reply keyboard** main menu
  (➕ Expense · 📅 Due · 💰 Balances · 📊 Spent · ➕ Income) and registers `setMyCommands` so the
  `/` menu is populated. The discoverability layer the rest hangs off.

---

## Notes / extras (jot anything here)

-

---

## After you select

I'll turn the checked items into an ordered implementation plan:

1. **F0** foundation (webhook + callback router + conversation-state) — always first.
2. **F10** menu/onboarding — gives every other feature an entry point.
3. **Read flows** (F2 / F3 / F7) — low risk, reuse existing builders.
4. **Write flows** (F1 / F4 / F5 / F8) — need conversation-state + careful confirms.
5. **Media & scheduled** (F9 / F6) — last.

Each step will name the data models, routes, callback namespaces, and prompt steps it touches.
