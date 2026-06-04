from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


class LoanCreate(BaseModel):
    person_id: int
    direction: str  # borrowed / lent
    principal: Decimal
    interest_rate: Optional[Decimal] = None
    total_terms: Optional[int] = None
    start_date: date
    notes: Optional[str] = None


class LoanUpdate(BaseModel):
    principal: Optional[Decimal] = None
    interest_rate: Optional[Decimal] = None
    total_terms: Optional[int] = None
    notes: Optional[str] = None


class LoanPaymentCreate(BaseModel):
    amount: Decimal
    note: Optional[str] = None


class LoanPaymentOut(BaseModel):
    id: int
    loan_id: int
    amount: Decimal
    paid_at: datetime
    note: Optional[str] = None

    class Config:
        from_attributes = True


class LoanOut(BaseModel):
    id: int
    user_id: int
    person_id: int
    direction: str
    principal: Decimal
    interest_rate: Optional[Decimal] = None
    total_terms: Optional[int] = None
    terms_paid: int
    start_date: date
    status: str
    notes: Optional[str] = None
    payments: list[LoanPaymentOut] = []

    class Config:
        from_attributes = True
