from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class SharedTrackerRowCreate(BaseModel):
    label: str
    allowed_holders: list[int] = []


class SharedTrackerRowUpdate(BaseModel):
    label: Optional[str] = None
    allowed_holders: Optional[list[int]] = None


class SharedTrackerEntryUpdate(BaseModel):
    amount: Optional[Decimal] = None
    state: Optional[str] = None
    notes: Optional[str] = None
    held_by: Optional[int] = None


class SharedTrackerEntryOut(BaseModel):
    id: int
    row_id: int
    month: int
    year: int
    amount: Optional[Decimal] = None
    state: str
    notes: Optional[str] = None
    held_by: Optional[int] = None

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


class ShareLinkOut(BaseModel):
    token: str
