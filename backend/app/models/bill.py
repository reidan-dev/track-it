from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    due_day = Column(Integer, nullable=False)
    category = Column(String, nullable=False)
    is_recurring = Column(Boolean, default=True)
    start_month = Column(Integer, nullable=False)
    start_year = Column(Integer, nullable=False)
    end_month = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bills")
    payments = relationship("BillPayment", back_populates="bill", cascade="all, delete-orphan")


class BillPayment(Base):
    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount_paid = Column(Numeric(12, 2), nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="payments")
