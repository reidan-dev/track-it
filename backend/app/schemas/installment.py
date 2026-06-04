from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InstallmentCreate(BaseModel):
    name: str
    total_amount: Decimal
    installment_amount: Decimal
    total_terms: int
    start_month: int
    start_year: int
    notes: Optional[str] = None


class InstallmentUpdate(BaseModel):
    name: Optional[str] = None
    total_amount: Optional[Decimal] = None
    installment_amount: Optional[Decimal] = None
    total_terms: Optional[int] = None
    notes: Optional[str] = None


class InstallmentPaymentOut(BaseModel):
    id: int
    installment_id: int
    month: int
    year: int
    paid_at: datetime

    class Config:
        from_attributes = True


class InstallmentOut(BaseModel):
    id: int
    user_id: int
    name: str
    total_amount: Decimal
    installment_amount: Decimal
    total_terms: int
    terms_paid: int
    start_month: int
    start_year: int
    status: str
    notes: Optional[str] = None
    payments: list[InstallmentPaymentOut] = []

    class Config:
        from_attributes = True
