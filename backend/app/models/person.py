from sqlalchemy import Column, Integer, String, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Person(Base):
    __tablename__ = "people"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    nickname = Column(String, nullable=True)
    relationship_type = Column(String, default="Other")  # Partner/Family/Friend/Colleague/Acquaintance/Other
    contact_info = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    emoji = Column(String, nullable=True)
    color = Column(String, nullable=True)

    user = relationship("User", back_populates="people")
    loans = relationship("Loan", back_populates="person")
