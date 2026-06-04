from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime
from decimal import Decimal


class BillCreate(BaseModel):
    name: str
    amount: Optional[Decimal] = None
    due_day: int
    frequency: str = "monthly"
    category: str
    is_recurring: bool = True
    start_month: int
    start_year: int
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payable_to: Optional[int] = None
    participants: list[int] = [0]
    participant_amounts: dict = {}


class BillUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[Decimal] = None
    due_day: Optional[int] = None
    frequency: Optional[str] = None
    category: Optional[str] = None
    is_recurring: Optional[bool] = None
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payable_to: Optional[int] = None
    participants: Optional[list[int]] = None
    participant_amounts: Optional[dict] = None


class BillPaymentOut(BaseModel):
    id: int
    bill_id: int
    month: int
    year: int
    period: Optional[int] = None
    amount_paid: Optional[Decimal] = None
    paid_at: datetime

    class Config:
        from_attributes = True


class BillSettlementOut(BaseModel):
    id: int
    bill_id: int
    person_id: int
    month: int
    year: int
    period: Optional[int] = None
    settled_at: datetime

    class Config:
        from_attributes = True


class BillOut(BaseModel):
    id: int
    user_id: int
    name: str
    amount: Optional[Decimal] = None
    due_day: int
    frequency: str = "monthly"
    category: str
    is_recurring: bool
    start_month: int
    start_year: int
    end_month: Optional[int] = None
    end_year: Optional[int] = None
    notes: Optional[str] = None
    payment_method: Optional[str] = None
    payable_to: Optional[int] = None
    participants: list[int] = []
    participant_amounts: dict = {}
    payments: list[BillPaymentOut] = []
    settlements: list[BillSettlementOut] = []

    @field_validator("frequency", mode="before")
    @classmethod
    def coerce_frequency(cls, v):
        return v or "monthly"

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
