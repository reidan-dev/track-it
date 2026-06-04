from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import auth, expenses, installments, bills, loans, income, people, dashboard, calendar, settings as settings_router, export

app = FastAPI(title="Track-It API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(expenses.router)
app.include_router(installments.router)
app.include_router(bills.router)
app.include_router(loans.router)
app.include_router(income.router)
app.include_router(people.router)
app.include_router(dashboard.router)
app.include_router(calendar.router)
app.include_router(settings_router.router)
app.include_router(export.router)


@app.get("/health")
def health():
    return {"status": "ok"}
