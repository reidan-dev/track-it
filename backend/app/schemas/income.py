from pydantic import BaseModel
from typing import Optional
from datetime import date
from decimal import Decimal


class IncomeCreate(BaseModel):
    source: str
    amount: Decimal
    date: date
    type: str  # Salary / Freelance / Other
    period: int
    month: int
    year: int
    payable_from: Optional[int] = None
    due_date: Optional[date] = None


class IncomeUpdate(BaseModel):
    source: Optional[str] = None
    amount: Optional[Decimal] = None
    date: Optional[date] = None
    type: Optional[str] = None
    period: Optional[int] = None
    month: Optional[int] = None
    year: Optional[int] = None
    payable_from: Optional[int] = None
    due_date: Optional[date] = None


class IncomeOut(BaseModel):
    id: int
    user_id: int
    source: str
    amount: Decimal
    date: date
    type: str
    period: int
    month: int
    year: int
    payable_from: Optional[int] = None
    due_date: Optional[date] = None

    class Config:
        from_attributes = True
