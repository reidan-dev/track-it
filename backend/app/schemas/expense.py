from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date as _date, datetime
from decimal import Decimal


class ExpenseCreate(BaseModel):
    name: Optional[str] = None
    amount: Decimal
    category: str
    date: _date
    note: Optional[str] = None
    payment_method: Optional[str] = None
    period: int
    month: int
    year: int
    participants: list[int] = [0]
    participant_amounts: dict = {}
    receipt_image: Optional[str] = None


class ExpenseUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    category: Optional[str] = None
    date: Optional[_date] = None
    note: Optional[str] = None
    payment_method: Optional[str] = None
    period: Optional[int] = None
    month: Optional[int] = None
    year: Optional[int] = None
    participants: Optional[list[int]] = None
    participant_amounts: Optional[dict] = None
    receipt_image: Optional[str] = None


class ExpenseSettlementOut(BaseModel):
    id: int
    expense_id: int
    person_id: int
    month: int
    year: int
    period: Optional[int] = None
    settled_at: datetime

    class Config:
        from_attributes = True


class ExpenseOut(BaseModel):
    id: int
    user_id: int
    name: Optional[str] = None
    amount: Decimal
    category: str
    date: _date
    note: Optional[str] = None
    payment_method: Optional[str] = None
    period: int
    month: int
    year: int
    participants: list[int] = []
    participant_amounts: dict = {}
    has_receipt: bool = False
    settlements: list[ExpenseSettlementOut] = []

    @field_validator("participants", mode="before")
    @classmethod
    def coerce_participants(cls, v):
        return v if v is not None else []

    @field_validator("participant_amounts", mode="before")
    @classmethod
    def coerce_participant_amounts(cls, v):
        return v if v is not None else {}

    class Config:
        from_attributes = True
