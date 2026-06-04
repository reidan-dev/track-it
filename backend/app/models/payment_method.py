from sqlalchemy import Column, Integer, String, Boolean, ForeignKey
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

    user = relationship("User", back_populates="payment_methods")
