# Deployment Guide

---

## Local Development

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (running locally)
- Git

---

### 1. Clone the repo

```bash
git clone https://github.com/your-username/track-it.git
cd track-it
```

---

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Create a `.env` file in `/backend`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/trackit
SECRET_KEY=your-random-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
```

Create the database:

```bash
createdb trackit
```

Run migrations:

```bash
alembic upgrade head
```

Seed the initial user (run once):

```bash
python scripts/seed_user.py --email you@example.com --password yourpassword
```

Start the dev server:

```bash
uvicorn app.main:app --reload --port 8000
```

Backend runs at: `http://localhost:8000`  
API docs at: `http://localhost:8000/docs`

---

### 3. Frontend (React + Vite)

```bash
cd frontend
npm install
```

Create a `.env` file in `/frontend`:

```env
VITE_API_URL=http://localhost:8000
```

Start the dev server:

```bash
npm run dev
```

Frontend runs at: `http://localhost:5173`

---

## Production Deployment

### Overview

| Service | What it hosts |
|---|---|
| **Vercel** | React frontend |
| **Railway** | FastAPI backend + PostgreSQL database |

---

### Backend → Railway

1. Go to [railway.app](https://railway.app) and create a new project
2. Add a **PostgreSQL** database service — Railway provisions it automatically
3. Add a second service from your GitHub repo (the `backend/` folder)
4. Set the root directory to `backend` in Railway's service settings
5. Set the start command:
   ```
   uvicorn app.main:app --host 0.0.0.0 --port $PORT
   ```
6. Add environment variables in Railway's dashboard:
   ```
   DATABASE_URL        → (copy from the Railway PostgreSQL service)
   SECRET_KEY          → (generate: python -c "import secrets; print(secrets.token_hex(32))")
   ALGORITHM           → HS256
   ACCESS_TOKEN_EXPIRE_MINUTES → 60
   REFRESH_TOKEN_EXPIRE_DAYS   → 30
   ALLOWED_ORIGINS     → https://your-app.vercel.app
   ```
7. Deploy — Railway builds and runs automatically on push to main
8. Note the public Railway URL (e.g. `https://track-it-backend.up.railway.app`)

Run migrations on Railway after first deploy:

```bash
railway run alembic upgrade head
railway run python scripts/seed_user.py --email you@example.com --password yourpassword
```

---

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) and import your GitHub repo
2. Set the **Root Directory** to `frontend`
3. Framework preset: **Vite**
4. Add environment variable:
   ```
   VITE_API_URL=https://your-railway-backend-url.up.railway.app
   ```
5. Deploy — Vercel builds automatically on push to main

---

### CORS Setup

In your FastAPI `main.py`, set `ALLOWED_ORIGINS` to your Vercel domain:

```python
origins = [
    "http://localhost:5173",
    "https://your-app.vercel.app",
]
```

Update this env var on Railway whenever your Vercel domain changes.

---

## Environment Variables Reference

### Backend (`/backend/.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | Random string for JWT signing |
| `ALGORITHM` | JWT algorithm (use `HS256`) |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token lifetime |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs for CORS |

### Frontend (`/frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_API_URL` | Base URL of the FastAPI backend |

---

## Useful Commands

```bash
# Generate a secure SECRET_KEY
python -c "import secrets; print(secrets.token_hex(32))"

# Create a new Alembic migration
alembic revision --autogenerate -m "your migration name"

# Apply migrations
alembic upgrade head

# Roll back last migration
alembic downgrade -1

# Build frontend for production (output to dist/)
cd frontend && npm run build

# Preview production build locally
cd frontend && npm run preview
```

---

## Updating in Production

```bash
# Push to main — both Vercel and Railway auto-deploy on push
git push origin main

# If you have schema changes, run migrations after Railway redeploys:
railway run alembic upgrade head
```
