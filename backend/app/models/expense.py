from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=True)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    payment_method = Column(String, nullable=True)
    period = Column(Integer, nullable=False)  # 1 or 2
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    participants = Column(JSON, default=list)        # person ids sharing the cost; 0 = Me
    participant_amounts = Column(JSON, default=dict)  # optional custom per-person split

    user = relationship("User", back_populates="expenses")
    settlements = relationship("ExpenseParticipantSettlement", back_populates="expense", cascade="all, delete-orphan")


class ExpenseParticipantSettlement(Base):
    __tablename__ = "expense_participant_settlements"

    id = Column(Integer, primary_key=True, index=True)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=False)
    person_id = Column(Integer, nullable=False)       # 0 = Me
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)
    settled_at = Column(DateTime, default=datetime.utcnow)

    expense = relationship("Expense", back_populates="settlements")
