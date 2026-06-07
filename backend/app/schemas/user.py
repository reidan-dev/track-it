from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class UserOut(BaseModel):
    id: int
    email: str
    currency: str
    theme: str
    created_at: datetime

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    currency: Optional[str] = None
    theme: Optional[str] = None


class UserSettingsOut(BaseModel):
    id: int
    user_id: int
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_enabled: bool
    reminder_bill_days_before: int
    reminder_installment_day: Optional[int] = None
    reminder_loan_days_before: int
    reminder_custom_dates: list
    reminder_bills_enabled: bool
    reminder_installments_enabled: bool
    reminder_loans_enabled: bool
    reminder_custom_enabled: bool
    bill_reminder_enabled: Optional[bool] = False
    p1_reminder_day: Optional[int] = 1
    p1_reminder_time: Optional[str] = "09:00"
    p2_reminder_day: Optional[int] = 16
    p2_reminder_time: Optional[str] = "09:00"
    reminder_utc_offset: Optional[int] = 8
    p1_lead_prev_month: Optional[bool] = False
    p2_lead_prev_month: Optional[bool] = False
    balance_reminder_enabled: Optional[bool] = False
    digest_enabled: Optional[bool] = False
    digest_frequency: Optional[str] = "daily"
    digest_time: Optional[str] = "08:00"
    digest_weekday: Optional[int] = 0

    class Config:
        from_attributes = True


class UserSettingsUpdate(BaseModel):
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    telegram_enabled: Optional[bool] = None
    reminder_bill_days_before: Optional[int] = None
    reminder_installment_day: Optional[int] = None
    reminder_loan_days_before: Optional[int] = None
    reminder_custom_dates: Optional[list] = None
    reminder_bills_enabled: Optional[bool] = None
    reminder_installments_enabled: Optional[bool] = None
    reminder_loans_enabled: Optional[bool] = None
    reminder_custom_enabled: Optional[bool] = None
    bill_reminder_enabled: Optional[bool] = None
    p1_reminder_day: Optional[int] = None
    p1_reminder_time: Optional[str] = None
    p2_reminder_day: Optional[int] = None
    p2_reminder_time: Optional[str] = None
    reminder_utc_offset: Optional[int] = None
    p1_lead_prev_month: Optional[bool] = None
    p2_lead_prev_month: Optional[bool] = None
    balance_reminder_enabled: Optional[bool] = None
    digest_enabled: Optional[bool] = None
    digest_frequency: Optional[str] = None
    digest_time: Optional[str] = None
    digest_weekday: Optional[int] = None
    currency: Optional[str] = None
    theme: Optional[str] = None
    palette: Optional[str] = None
