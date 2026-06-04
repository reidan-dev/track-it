from sqlalchemy import Column, Integer, String, Numeric, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Loan(Base):
    __tablename__ = "loans"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    person_id = Column(Integer, ForeignKey("people.id"), nullable=False)
    direction = Column(String, nullable=False)  # borrowed / lent
    principal = Column(Numeric(12, 2), nullable=False)
    interest_rate = Column(Numeric(5, 4), nullable=True)
    total_terms = Column(Integer, nullable=True)
    terms_paid = Column(Integer, default=0)
    start_date = Column(Date, nullable=False)
    status = Column(String, default="active")  # active / settled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="loans")
    person = relationship("Person", back_populates="loans")
    payments = relationship("LoanPayment", back_populates="loan", cascade="all, delete-orphan")


class LoanPayment(Base):
    __tablename__ = "loan_payments"

    id = Column(Integer, primary_key=True, index=True)
    loan_id = Column(Integer, ForeignKey("loans.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    paid_at = Column(DateTime, default=datetime.utcnow)
    note = Column(Text, nullable=True)

    loan = relationship("Loan", back_populates="payments")
