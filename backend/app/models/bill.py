from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Bill(Base):
    __tablename__ = "bills"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=True)  # nullable for variable bills
    due_day = Column(Integer, nullable=False)
    frequency = Column(String, default="monthly")   # monthly | biweekly
    category = Column(String, nullable=False)
    is_recurring = Column(Boolean, default=True)
    start_month = Column(Integer, nullable=False)
    start_year = Column(Integer, nullable=False)
    end_month = Column(Integer, nullable=True)
    end_year = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    payment_method = Column(String, nullable=True)
    payable_to = Column(Integer, ForeignKey("people.id"), nullable=True)  # person who receives this payment
    participants = Column(JSON, default=list)
    participant_amounts = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="bills")
    payments = relationship("BillPayment", back_populates="bill", cascade="all, delete-orphan")
    settlements = relationship("BillParticipantSettlement", back_populates="bill", cascade="all, delete-orphan")


class BillPayment(Base):
    __tablename__ = "bill_payments"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)          # 1 or 2 for biweekly; null for monthly
    amount_paid = Column(Numeric(12, 2), nullable=True)
    paid_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="payments")


class BillParticipantSettlement(Base):
    __tablename__ = "bill_participant_settlements"

    id = Column(Integer, primary_key=True, index=True)
    bill_id = Column(Integer, ForeignKey("bills.id"), nullable=False)
    person_id = Column(Integer, nullable=False)       # 0 = Me
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)           # 1 or 2 for biweekly; null for monthly
    settled_at = Column(DateTime, default=datetime.utcnow)

    bill = relationship("Bill", back_populates="settlements")
