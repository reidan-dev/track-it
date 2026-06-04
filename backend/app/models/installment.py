from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Installment(Base):
    __tablename__ = "installments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    total_amount = Column(Numeric(12, 2), nullable=False)
    installment_amount = Column(Numeric(12, 2), nullable=False)
    total_terms = Column(Integer, nullable=False)
    terms_paid = Column(Integer, default=0)
    start_month = Column(Integer, nullable=False)
    start_year = Column(Integer, nullable=False)
    status = Column(String, default="active")  # active / completed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="installments")
    payments = relationship("InstallmentPayment", back_populates="installment", cascade="all, delete-orphan")


class InstallmentPayment(Base):
    __tablename__ = "installment_payments"

    id = Column(Integer, primary_key=True, index=True)
    installment_id = Column(Integer, ForeignKey("installments.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)

    installment = relationship("Installment", back_populates="payments")
