from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal


class ExpenseCreate(BaseModel):
    amount: Decimal
    category: str
    date: date
    note: Optional[str] = None
    period: int
    month: int
    year: int


class ExpenseUpdate(BaseModel):
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    date: Optional[date] = None
    note: Optional[str] = None
    period: Optional[int] = None
    month: Optional[int] = None
    year: Optional[int] = None


class ExpenseOut(BaseModel):
    id: int
    user_id: int
    amount: Decimal
    category: str
    date: date
    note: Optional[str] = None
    period: int
    month: int
    year: int

    class Config:
        from_attributes = True
