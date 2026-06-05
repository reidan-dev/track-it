from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    currency = Column(String, default="PHP")
    theme = Column(String, default="system")
    created_at = Column(DateTime, default=datetime.utcnow)

    settings = relationship("UserSettings", back_populates="user", uselist=False, cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="user", cascade="all, delete-orphan")
    installments = relationship("Installment", back_populates="user", cascade="all, delete-orphan")
    bills = relationship("Bill", back_populates="user", cascade="all, delete-orphan")
    loans = relationship("Loan", back_populates="user", cascade="all, delete-orphan")
    incomes = relationship("Income", back_populates="user", cascade="all, delete-orphan")
    people = relationship("Person", back_populates="user", cascade="all, delete-orphan")
    payment_methods = relationship("PaymentMethod", back_populates="user", cascade="all, delete-orphan")


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    telegram_bot_token = Column(String, nullable=True)
    telegram_chat_id = Column(String, nullable=True)
    telegram_enabled = Column(Boolean, default=False)
    reminder_bill_days_before = Column(Integer, default=3)
    reminder_installment_day = Column(Integer, nullable=True)
    reminder_loan_days_before = Column(Integer, default=3)
    reminder_custom_dates = Column(JSON, default=list)
    reminder_bills_enabled = Column(Boolean, default=True)
    reminder_installments_enabled = Column(Boolean, default=True)
    reminder_loans_enabled = Column(Boolean, default=True)
    reminder_custom_enabled = Column(Boolean, default=True)

    # Period-based bill reminders (Telegram)
    bill_reminder_enabled = Column(Boolean, default=False)
    p1_reminder_day = Column(Integer, default=1)       # day-of-month to send P1 reminder (1–15)
    p1_reminder_time = Column(String, default="09:00")  # local time "HH:MM"
    p2_reminder_day = Column(Integer, default=16)      # day-of-month to send P2 reminder (16–31, clamped)
    p2_reminder_time = Column(String, default="09:00")
    reminder_utc_offset = Column(Integer, default=8)   # user's timezone offset from UTC, in hours
    p1_lead_prev_month = Column(Boolean, default=False)  # send P1 reminder during the previous month (advance notice)
    p2_lead_prev_month = Column(Boolean, default=False)
    p1_last_sent = Column(String, nullable=True)       # "YYYY-MM" of the target period-month (dedup stamp)
    p2_last_sent = Column(String, nullable=True)

    # Balance summary reminder — shares the P1/P2 schedule above, just sent as a
    # separate Telegram message. Keeps its own dedup stamps.
    balance_reminder_enabled = Column(Boolean, default=False)
    balance_p1_last_sent = Column(String, nullable=True)
    balance_p2_last_sent = Column(String, nullable=True)

    user = relationship("User", back_populates="settings")
