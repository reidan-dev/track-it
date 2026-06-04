# Track-It — Personal Finance Tracker

## Overview

A personal finance web app for tracking monthly expenses, installment payments, loans, and income. Built for single-user use with a clean, modern UI.

**Currency:** PHP (Philippine Peso) by default, with optional currency selector  
**Billing cycle:** Biweekly (1st–15th and 16th–end of month)

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite, TailwindCSS, shadcn/ui |
| Backend | FastAPI + SQLAlchemy |
| Database | PostgreSQL |
| Auth | Email/password (JWT) |
| Hosting | Vercel (frontend) + Railway (backend + DB) |

---

## Features

### 1. Expense Tracker
- Log individual expenses with: amount, category, date, optional note
- Categories: Food, Transport, Utilities, Entertainment, Health, Shopping, Other
- Biweekly view: Period 1 (1st–15th) and Period 2 (16th–end of month)
- Monthly summary with per-category totals and a bar/pie chart
- Budget limits per category — visual warning when ≥80% used, alert at 100%

### 2. Installment / Payment Tracker
- Add a payment obligation: name, total amount, installment amount, total terms, start month
- Auto-calculates: terms paid, terms remaining, next due date
- Progress bar per item (e.g. `8 / 24 paid — PHP 32,000 remaining`)
- Mark current period's payment as paid
- Auto-persists each month until fully paid — no manual re-entry needed
- Once all terms are paid, item moves to "Completed" archive
- Monthly summary card: "Total installment obligations this month: PHP X"
- Edit installment details at any time (amount, terms, notes)

### 3. Monthly Bills Manager
- Add recurring monthly bills: name, amount, due date (day of month), category
- Bills automatically carry over to the next month until manually removed or marked as a one-time entry
- Mark each bill as paid per month — history is kept
- Edit bill details (amount changes, e.g. utility bill fluctuations) per month without affecting past records
- Separate view: "Unpaid this month" vs "All bills"
- Supports both fixed bills (rent, subscriptions) and variable bills (electricity, water)

### 4. Loan Tracker
- Two directions: **I Borrowed** (I owe someone) and **I Lent** (someone owes me)
- Per loan fields: person name, principal amount, interest rate (optional), total terms, start date, notes
- Auto-calculates: remaining balance, remaining terms, next payment date
- Status: Active / Settled
- Summary view: total I owe vs total owed to me
- Mark individual payments as made per period
- "Settle" button to close a loan early with optional final amount

### 5. Dashboard
- Net cash position: income − expenses − bills − installments (current month)
- Upcoming payments in the next 7 days (bills, installments, loan payments)
- Loans nearing completion (≤3 terms remaining)
- Monthly spend by category (mini chart)
- Quick-add button for expenses

### 6. Income Tracker
- Log income entries: source, amount, date, type (Salary, Freelance, Other)
- Biweekly breakdown
- Monthly income total shown on dashboard

### 7. Currency Selector
- Default: PHP (₱)
- Optional: USD ($), EUR (€), JPY (¥), SGD (S$)
- Currency stored per user account — affects all display labels

### 8. Data Export
- Export any module (expenses, bills, installments, loans) to CSV
- Date range filter before export
- Filename format: `trackit_expenses_2026-06.csv`

### 9. Calendar View
- Full monthly calendar showing all financial events on their due dates
- Color-coded by type: bills (blue), installments (orange), loan payments (red), income (green)
- Click a day to see all events due that day with quick-pay action
- Toggle which event types are visible
- Navigate between months — past months show paid/unpaid status per event

### 10. Dark Mode
- Toggle between light and dark theme, saved per account
- Respects system preference on first load (prefers-color-scheme)
- Smooth transition between themes, no flash on page load
- All charts and UI components fully themed

### 11. Telegram Bot Integration *(planned — post-launch)*
- Connect the app to a personal Telegram bot via Bot Token + Chat ID
- Configured entirely from the Settings page — no code changes needed
- Configurable reminder schedule per event type:
  - **Bills:** remind X days before due date (e.g. 3 days before)
  - **Installments:** remind on a specific day of the month
  - **Loans:** remind X days before next payment
  - **Custom dates:** add arbitrary reminder dates (e.g. "every 1st and 15th: log your expenses")
- Reminder message format includes item name, amount due, and days remaining
- Test button in settings to send a test message and verify the bot is connected
- Enable/disable reminders per event type without removing the bot config
- Backend uses APScheduler (Railway-hosted) to send messages via Telegram Bot API

---

## Data Models (summary)

### User
- id, email, password_hash, currency, theme (light/dark/system), created_at

### UserSettings
- id, user_id
- telegram_bot_token, telegram_chat_id, telegram_enabled
- reminder_bill_days_before (int, default 3)
- reminder_installment_day (int, day of month)
- reminder_loan_days_before (int, default 3)
- reminder_custom_dates (JSON array of {day, month_type: "every"|"specific", message})
- reminder_bills_enabled, reminder_installments_enabled, reminder_loans_enabled, reminder_custom_enabled

### Expense
- id, user_id, amount, category, date, note, period (1 or 2), month, year

### Installment
- id, user_id, name, total_amount, installment_amount, total_terms, terms_paid, start_month, start_year, status (active/completed), notes
- InstallmentPayment: id, installment_id, month, year, paid_at

### Bill
- id, user_id, name, amount, due_day, category, is_recurring, start_month, start_year, end_month (nullable), notes
- BillPayment: id, bill_id, month, year, amount_paid, paid_at

### Person
- id, user_id, name, nickname (optional), relationship (Family / Friend / Colleague / Acquaintance / Other), contact_info (phone/email, optional), notes
- Linked to: Loan (via loan.person_id), ExpenseSplit (via split.person_id)
- Computed fields (not stored): net_balance (total lent to them − total borrowed from them), active_loan_count

### Loan
- id, user_id, person_id (FK → Person), direction (borrowed/lent), principal, interest_rate, total_terms, terms_paid, start_date, status (active/settled), notes
- LoanPayment: id, loan_id, amount, paid_at, note

### ExpenseSplit (optional, for shared expenses)
- id, expense_id, person_id (FK → Person), share_amount, is_settled, settled_at

### Income
- id, user_id, source, amount, date, type, period, month, year

---

## UI Structure

```
/dashboard          → Overview, upcoming, net position
/calendar           → Monthly calendar of all due dates and events
/expenses           → Expense log + biweekly view
/bills              → Monthly bills manager
/installments       → Installment tracker
/loans              → Loan tracker (borrowed + lent tabs)
/income             → Income log
/people             → People directory + per-person financial summary
/settings           → Currency, theme, export, Telegram bot config
```

---

## Auth
- Single user (personal app) — simple email/password login
- JWT access tokens, refresh token in httpOnly cookie
- No registration UI (seed the user via a script or first-run setup route)

---

## API Structure (FastAPI)

```
POST   /auth/login
POST   /auth/refresh

GET/POST        /expenses
PUT/DELETE      /expenses/{id}

GET/POST        /bills
PUT/DELETE      /bills/{id}
POST            /bills/{id}/pay/{month}/{year}

GET/POST        /installments
PUT/DELETE      /installments/{id}
POST            /installments/{id}/pay/{month}/{year}

GET/POST        /loans
PUT/DELETE      /loans/{id}
POST            /loans/{id}/payments
PATCH           /loans/{id}/settle

GET/POST        /income
PUT/DELETE      /income/{id}

GET/POST        /people
PUT/DELETE      /people/{id}
GET             /people/{id}/summary     → all loans, splits, net balance for this person

GET             /dashboard/summary
GET             /calendar/events?month=&year=   → all due events for a given month

GET/PUT         /settings
POST            /settings/telegram/test          → send a test Telegram message
GET             /export/{module}?from=&to=
```
