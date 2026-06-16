from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, Text, JSON, Boolean
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
    receipt_image = Column(Text, nullable=True)      # base64 data URL of an attached receipt photo
    paid_by = Column(Integer, nullable=True)         # person id who fronted the money; null/0 = Me
    payable_to = Column(Integer, nullable=True)      # person id you owe repayment to
    due_date = Column(Date, nullable=True)           # when repayment is expected
    is_paid = Column(Boolean, default=False, nullable=False)  # settled/repaid toggle, like bills & installments

    user = relationship("User", back_populates="expenses")
    settlements = relationship("ExpenseParticipantSettlement", back_populates="expense", cascade="all, delete-orphan")

    @property
    def has_receipt(self) -> bool:
        return self.receipt_image is not None


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
