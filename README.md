# Track-It 💸

A personal finance tracker built for real life — biweekly expenses, installment obligations, recurring bills, loans with other people, and income. Clean UI, no bloat.

---

## What it does

| Module | Description |
|---|---|
| **Expenses** | Log and categorize daily spending, split into biweekly periods |
| **Bills** | Manage recurring monthly bills that auto-carry over until removed |
| **Installments** | Track term-based payments (e.g. 8/24 paid — auto-persists each month) |
| **Loans** | Track money you borrowed or lent, with remaining terms and balances |
| **Income** | Log salary and freelance income per period |
| **Dashboard** | Net cash position, upcoming dues, and a monthly overview |

---

## Tech Stack

- **Frontend:** React + Vite, TailwindCSS, shadcn/ui
- **Backend:** FastAPI + SQLAlchemy
- **Database:** PostgreSQL
- **Auth:** JWT (email/password)
- **Hosting:** Vercel (frontend) + Railway (backend + DB)
- **Currency:** PHP by default, configurable per account

---

## Project Structure

```
track-it/
├── frontend/          # React + Vite app
│   ├── src/
│   │   ├── pages/     # Dashboard, Expenses, Bills, Installments, Loans, Income
│   │   ├── components/
│   │   └── api/       # API client (axios/fetch wrappers)
│   └── ...
├── backend/           # FastAPI app
│   ├── app/
│   │   ├── routers/   # expenses, bills, installments, loans, income, auth
│   │   ├── models/    # SQLAlchemy models
│   │   ├── schemas/   # Pydantic schemas
│   │   └── db.py
│   └── ...
├── PROMPT.md          # Full feature spec used to build this app
├── DEPLOYMENT.md      # How to deploy locally and online
└── README.md
```

---

## Getting Started

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full local setup and production deployment instructions.

Short version:

```bash
# Backend
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload

# Frontend
cd frontend
npm install
npm run dev
```

---

## Planned Features (next phase)

- **Telegram bot reminders** — connect a bot via Settings, configure which days to receive reminders for bills, installments, and loans — no code changes, fully UI-driven

## Future Features

- **Recurring expense templates** — one-click log for frequent purchases
- **Debt payoff calculator** — snowball vs avalanche method visualized
- **Multi-currency support per entry** — log a USD transaction and see it in PHP
- **Shared loans** — split a loan between multiple people
- **Photo receipts** — attach a photo to an expense entry
- **Monthly report PDF** — generate and download a formatted monthly summary
- **Budget rollover** — unused budget from period 1 carries to period 2
- **Tags** — free-form tags on any entry for custom grouping
- **Mobile PWA** — installable on phone, offline-capable for quick expense logging
- **Bank statement import** — CSV/PDF import to auto-populate expenses

---

## Notes

- This is a single-user personal app — no multi-tenant or public registration
- All amounts are stored in base units (centavos/cents) as integers to avoid float precision issues
- Biweekly periods: Period 1 = 1st–15th, Period 2 = 16th–end of month
