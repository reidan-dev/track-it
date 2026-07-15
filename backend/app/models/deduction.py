from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from datetime import datetime
from app.database import Base


class Deduction(Base):
    """A one-off amount taken off a shared item for a single month/period
    (e.g. a promo credit or an advance payment), reducing what's left to split.
    """
    __tablename__ = "deductions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_type = Column(String, nullable=False)        # bill | installment | expense
    item_id = Column(Integer, nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    period = Column(Integer, nullable=True)           # 1 or 2 for biweekly; null for monthly
    amount = Column(Numeric(12, 2), nullable=False)
    person_id = Column(Integer, nullable=True)        # payer; null = generic credit, 0 = Me
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
