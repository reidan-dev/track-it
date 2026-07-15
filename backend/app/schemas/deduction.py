from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


class DeductionCreate(BaseModel):
    item_type: str                     # bill | installment | expense
    item_id: int
    month: int
    year: int
    period: Optional[int] = None
    amount: Decimal
    person_id: Optional[int] = None    # payer; null = generic credit, 0 = Me
    note: Optional[str] = None


class DeductionOut(BaseModel):
    id: int
    user_id: int
    item_type: str
    item_id: int
    month: int
    year: int
    period: Optional[int] = None
    amount: Decimal
    person_id: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
