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

## Production Deployment (Railway + Vercel)

### Architecture

| Service | Hosts | Notes |
|---|---|---|
| **Supabase** | PostgreSQL database | Already provisioned — reuse its connection string |
| **Railway** | FastAPI backend | Always-on (needed for the reminder scheduler) |
| **Vercel** | React/Vite frontend | Static build, auto-deploys on push |

> **Deploy order matters.** The frontend needs the backend's URL (`VITE_API_URL`), and the backend needs the frontend's URL (`ALLOWED_ORIGINS`). So: **deploy the backend first**, deploy the frontend with the backend URL, then come back and set the backend's `ALLOWED_ORIGINS` to the Vercel URL.

---

### Step 1 — Grab the database URL (Supabase, already set up)

The database already lives on Supabase — nothing to provision. Just copy its connection string for the backend:

1. Supabase dashboard → **Project Settings → Database → Connection string → URI**.
2. Use the **direct connection** (port `5432`). It looks like:
   ```
   postgresql://postgres.<ref>:<password>@aws-1-<region>.pooler.supabase.com:5432/postgres
   ```
3. Keep it handy — it's the `DATABASE_URL` in Step 2.

---

### Step 2 — Deploy the backend (Railway)

1. Go to [railway.app](https://railway.app), sign in with GitHub, click **New Project → Deploy from GitHub repo**, and pick your `track-it` repo (authorize access if prompted).
2. Open the new service → **Settings**:
   - **Root Directory**: `backend`
   - **Start Command**:
     ```
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
     (Railway injects `$PORT`.) Keep migrations *out* of the start command — if the DB is briefly unreachable, a migration step there blocks boot and the healthcheck fails with no obvious reason.
   - *(Optional)* **Healthcheck Path**: `/health`
   - *(Optional)* **Pre-Deploy Command** (runs before the new version goes live): `alembic upgrade head` — use this when you have new migrations. Your Supabase DB is already migrated, so you can leave it blank for now.
3. Go to the service's **Variables** tab and add:
   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Supabase connection string from Step 1 |
   | `SECRET_KEY` | A long random string — generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
   | `ALGORITHM` | `HS256` |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `30` |
   | `ALLOWED_ORIGINS` | `http://localhost:5173` for now — you'll add the Vercel URL in Step 4 |
4. Railway auto-deploys (Railpack detects Python from `requirements.txt`). The repo includes **`backend/.python-version` pinned to `3.12`** — keep it: Python 3.13 has no prebuilt wheel for this `pydantic` version and the build fails trying to compile Rust.
5. Under **Settings → Networking**, click **Generate Domain**. Note the URL, e.g. `https://track-it-backend.up.railway.app`.
6. Confirm it's live: open `https://<your-backend>.up.railway.app/health` → should return `{"status":"ok"}`. API docs are at `/docs`.

> Your Supabase DB is already migrated and has a user from development, so there's nothing else to run. **Only if you ever point at a fresh database**, seed a user once with the [Railway CLI](https://docs.railway.app/guides/cli) from `backend/`:
>
> ```bash
> railway link        # select the project + backend service
> railway run python scripts/seed_user.py --email you@example.com --password yourpassword
> ```
> (Migrations apply automatically via the start command.)

---

### Step 3 — Deploy the frontend (Vercel)

1. Go to [vercel.com](https://vercel.com), **Add New → Project**, and import your `track-it` repo.
2. In the import screen:
   - **Root Directory**: `frontend`
   - **Framework Preset**: **Vite** (auto-detected; build = `npm run build`, output = `dist`)
3. Expand **Environment Variables** and add:
   ```
   VITE_API_URL = https://<your-backend>.up.railway.app
   ```
   (No trailing slash. This is baked in at build time, so changing it later requires a redeploy.)
4. Click **Deploy**. When it finishes, note your Vercel URL, e.g. `https://track-it.vercel.app`.

---

### Step 4 — Connect them (CORS)

The backend reads allowed origins from the `ALLOWED_ORIGINS` env var (comma-separated) — no code change needed.

1. Back in Railway → backend service → **Variables**, set:
   ```
   ALLOWED_ORIGINS = https://track-it.vercel.app
   ```
   To also allow Vercel preview deployments, add them comma-separated, e.g.
   `https://track-it.vercel.app,https://track-it-git-main-you.vercel.app`
2. Save — Railway redeploys automatically.

---

### Step 5 — Verify

1. Open your Vercel URL and log in with the seeded account.
2. If requests fail, open the browser devtools **Network** tab:
   - **CORS error** → `ALLOWED_ORIGINS` doesn't exactly match the Vercel domain (check `https://`, no trailing slash).
   - **404/Network error** → `VITE_API_URL` is wrong; fix it in Vercel and **redeploy** (it's build-time).
3. *(Optional)* In the app, go to **Settings → General** to add your Telegram bot token/chat ID, then **Settings → Reminders** to schedule reminders. These fire from the always-on Railway backend.

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
```

- **Schema changes**: run `alembic upgrade head` — either set it as Railway's **Pre-Deploy Command**, or run `railway run alembic upgrade head` once after the deploy. (Keep it out of the start command so a DB hiccup can't block boot.)
- **Frontend env changes** (`VITE_API_URL`) are build-time — after changing them in Vercel, trigger a redeploy.
- **CORS**: whenever the Vercel domain changes, update `ALLOWED_ORIGINS` on Railway.
