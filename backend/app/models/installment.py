from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Installment(Base):
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    loaned_amount = Column(Numeric(12, 2), nullable=True)  # original principal (optional)
    installment_amount = Column(Numeric(12, 2), nullable=False)
    total_terms = Column(Integer, nullable=False)
    terms_paid = Column(Integer, default=0)
    start_month = Column(Integer, nullable=False)
    start_year = Column(Integer, nullable=False)
    due_day = Column(String, nullable=True)   # "10" monthly or "5, 20" biweekly
    frequency = Column(String, default="monthly")   # monthly | biweekly
    participants = Column(JSON, default=list)
    participant_amounts = Column(JSON, default=dict)
    payment_method = Column(String, nullable=True)
    status = Column(String, default="active")
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="installments")
    payments = relationship("InstallmentPayment", back_populates="installment", cascade="all, delete-orphan")
    settlements = relationship("InstallmentParticipantSettlement", back_populates="installment", cascade="all, delete-orphan")


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True, index=True)
    installment_id = Column(Integer, ForeignKey("installments.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)          # 1 or 2 for biweekly; null for monthly
    paid_at = Column(DateTime, default=datetime.utcnow)

    installment = relationship("Installment", back_populates="payments")


class InstallmentParticipantSettlement(Base):
    __tablename__ = "installment_participant_settlements"

    id = Column(Integer, primary_key=True, index=True)
    installment_id = Column(Integer, ForeignKey("installments.id"), nullable=False)
    person_id = Column(Integer, nullable=False)       # 0 = Me
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)           # 1 or 2 for biweekly; null for monthly
    settled_at = Column(DateTime, default=datetime.utcnow)

    installment = relationship("Installment", back_populates="settlements")
