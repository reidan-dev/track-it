from pydantic import BaseModel
from typing import Optional
from decimal import Decimal


class PersonCreate(BaseModel):
    name: str
    nickname: Optional[str] = None
    relationship_type: str = "Other"
    contact_info: Optional[str] = None
    notes: Optional[str] = None


class PersonUpdate(BaseModel):
    name: Optional[str] = None
    nickname: Optional[str] = None
    relationship_type: Optional[str] = None
    contact_info: Optional[str] = None
    notes: Optional[str] = None


class PersonOut(BaseModel):
    id: int
    user_id: int
    name: str
    nickname: Optional[str] = None
    relationship_type: str
    contact_info: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class PersonSummaryOut(PersonOut):
    net_balance: Decimal
    active_loan_count: int
