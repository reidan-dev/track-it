from sqlalchemy import Column, Integer, String, Numeric, Date, ForeignKey
from sqlalchemy.orm import relationship
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

    user = relationship("User", back_populates="incomes")
