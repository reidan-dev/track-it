from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date as _date
from decimal import Decimal


class IncomeCreate(BaseModel):
    source: str
    amount: Decimal
    date: _date
    type: str  # Salary / Freelance / Other
    period: int
    month: int
    year: int
    payable_from: Optional[int] = None
    due_date: Optional[_date] = None
    earned_by: Optional[int] = None
    participants: list[int] = []
    participant_amounts: dict = {}


class IncomeUpdate(BaseModel):
    source: Optional[str] = None
    amount: Optional[Decimal] = None
    date: Optional[_date] = None
    type: Optional[str] = None
    period: Optional[int] = None
    month: Optional[int] = None
    year: Optional[int] = None
    payable_from: Optional[int] = None
    due_date: Optional[_date] = None
    earned_by: Optional[int] = None
    participants: Optional[list[int]] = None
    participant_amounts: Optional[dict] = None


class IncomeOut(BaseModel):
    id: int
    user_id: int
    source: str
    amount: Decimal
    date: _date
    type: str
    period: int
    month: int
    year: int
    payable_from: Optional[int] = None
    due_date: Optional[_date] = None
    earned_by: Optional[int] = None
    participants: list[int] = []
    participant_amounts: dict = {}

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
