from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Numeric, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


class PaymentMethod(Base):
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    icon = Column(String, nullable=True)   # emoji
    color = Column(String, nullable=True)  # hex color
    is_default = Column(Boolean, default=False)
    # Anchor balance: user-entered snapshot. Displayed balance = this minus
    # expenses logged with this method dated on/after the anchor date.
    balance = Column(Numeric(12, 2), nullable=True)
    balance_updated_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="payment_methods")
