from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class SharedTrackerRowCreate(BaseModel):
    label: str


class SharedTrackerRowUpdate(BaseModel):
    label: str


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


class SharedTrackerRowOut(BaseModel):
    id: int
    label: str
    entry: SharedTrackerEntryOut


class HolderOut(BaseModel):
    id: int
    name: str


class SharedTrackerPublicView(BaseModel):
    rows: list[SharedTrackerRowOut]
    holders: list[HolderOut]


class ShareLinkOut(BaseModel):
    token: str
