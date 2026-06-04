from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    category = Column(String, nullable=False)
    date = Column(Date, nullable=False)
    note = Column(Text, nullable=True)
    payment_method = Column(String, nullable=True)
    period = Column(Integer, nullable=False)  # 1 or 2
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)

    user = relationship("User", back_populates="expenses")
