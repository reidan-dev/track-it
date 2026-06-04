from pydantic import BaseModel, field_validator, computed_field
from typing import Optional
from datetime import datetime
from decimal import Decimal


class InstallmentCreate(BaseModel):
    name: str
    loaned_amount: Optional[Decimal] = None
    installment_amount: Decimal
    total_terms: int
    terms_paid: int = 0
    start_month: int
    start_year: int
    due_day: Optional[str] = None
    frequency: str = "monthly"
    participants: list[int] = [0]
    participant_amounts: dict = {}
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class InstallmentUpdate(BaseModel):
    name: Optional[str] = None
    loaned_amount: Optional[Decimal] = None
    installment_amount: Optional[Decimal] = None
    total_terms: Optional[int] = None
    terms_paid: Optional[int] = None
    due_day: Optional[str] = None
    frequency: Optional[str] = None
    participants: Optional[list[int]] = None
    participant_amounts: Optional[dict] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None


class InstallmentPaymentOut(BaseModel):
    id: int
    installment_id: int
    month: int
    year: int
    period: Optional[int] = None
    paid_at: datetime

    class Config:
        from_attributes = True


class InstallmentSettlementOut(BaseModel):
    id: int
    installment_id: int
    person_id: int
    month: int
    year: int
    period: Optional[int] = None
    settled_at: datetime

    class Config:
        from_attributes = True


class InstallmentOut(BaseModel):
    id: int
    user_id: int
    name: str
    loaned_amount: Optional[Decimal] = None
    installment_amount: Decimal
    total_terms: int
    terms_paid: int
    start_month: int
    start_year: int
    due_day: Optional[str] = None
    frequency: str = "monthly"
    participants: list[int] = []
    participant_amounts: dict = {}
    payment_method: Optional[str] = None
    status: str
    notes: Optional[str] = None
    payments: list[InstallmentPaymentOut] = []
    settlements: list[InstallmentSettlementOut] = []

    @computed_field
    @property
    def total_amount(self) -> Decimal:
        return self.installment_amount * self.total_terms

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
