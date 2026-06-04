from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BillCreate(BaseModel):
    name: str
    amount: Decimal
    due_day: int
    category: str
    is_recurring: bool = True
    start_month: int
    start_year: int
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None


class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    due_day: Optional[int] = None
    category: Optional[str] = None
    is_recurring: Optional[bool] = None
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None


class BillPaymentOut(BaseModel):
    id: int
    bill_id: int
    month: int
    year: int
    amount_paid: Decimal
    paid_at: datetime

    class Config:
        from_attributes = True


class BillOut(BaseModel):
    id: int
    user_id: int
    name: str
    amount: Decimal
    due_day: int
    category: str
    is_recurring: bool
    start_month: int
    start_year: int
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None
    payments: list[BillPaymentOut] = []

    class Config:
        from_attributes = True
