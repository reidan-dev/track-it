from pydantic import BaseModel, Field, field_validator
from typing import Literal, Optional
from decimal import Decimal


class SharedTrackerRowCreate(BaseModel):
    label: str
    allowed_holders: list[int] = []
    row_type: Optional[Literal["bill", "expense", "income", "installment"]] = None
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
    total_terms: Optional[int] = Field(default=None, ge=1)


class SharedTrackerRowUpdate(BaseModel):
    label: Optional[str] = None
    allowed_holders: Optional[list[int]] = None
    row_type: Optional[Literal["bill", "expense", "income", "installment"]] = None
    due_day: Optional[int] = Field(default=None, ge=1, le=31)
    total_terms: Optional[int] = Field(default=None, ge=1)


class SharedTrackerEntryUpdate(BaseModel):
    amount: Optional[Decimal] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    held_by: Optional[int] = None
    participants: Optional[list[int]] = None
    participant_amounts: Optional[dict] = None


class SharedTrackerEntryOut(BaseModel):
    id: int
    row_id: int
    month: int
    year: int
    amount: Optional[Decimal] = None
    state: str
    notes: Optional[str] = None
    held_by: Optional[int] = None
    participants: list[int] = []
    participant_amounts: dict = {}
    linked_record_type: Optional[str] = None
    linked_record_id: Optional[int] = None

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


class HolderOut(BaseModel):
    id: int
    name: str


class SharedTrackerRowOut(BaseModel):
    id: int
    label: str
    allowed_holders: list[int] = []
    holders: list[HolderOut] = []  # allowed_holders resolved to display names
    entry: SharedTrackerEntryOut
    row_type: Optional[Literal["bill", "expense", "income", "installment"]] = None
    due_day: Optional[int] = None
    total_terms: Optional[int] = None
    linked_master_id: Optional[int] = None


class ShareLinkOut(BaseModel):
    token: str
