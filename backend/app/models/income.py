from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Income(Base):
    __tablename__ = "incomes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    source = Column(String, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    date = Column(Date, nullable=False)
    type = Column(String, nullable=False)  # Salary / Freelance / Other
    period = Column(Integer, nullable=False)  # 1 or 2
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    payable_from = Column(Integer, nullable=True)  # person id who pays you (expected income)
    due_date = Column(Date, nullable=True)         # when the income is expected
    earned_by = Column(Integer, nullable=True)      # person id who actually earned it; 0 = Me (informational)
    participants = Column(JSON, default=list)        # person ids sharing this income; 0 = Me
    participant_amounts = Column(JSON, default=dict)  # optional custom per-person split

    user = relationship("User", back_populates="incomes")
    settlements = relationship("IncomeParticipantSettlement", back_populates="income", cascade="all, delete-orphan")


class IncomeParticipantSettlement(Base):
    __tablename__ = "income_participant_settlements"

    id = Column(Integer, primary_key=True, index=True)
    income_id = Column(Integer, ForeignKey("incomes.id"), nullable=False)
    person_id = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)
    settled_at = Column(DateTime, default=datetime.utcnow)

    income = relationship("Income", back_populates="settlements")
