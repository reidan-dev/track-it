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

    user = relationship("User", back_populates="settings")
