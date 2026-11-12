from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SharedTrackerRow(Base):
    __tablename__ = "shared_tracker_rows"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="shared_tracker_rows")
    entries = relationship("SharedTrackerEntry", back_populates="row", cascade="all, delete-orphan")


class SharedTrackerEntry(Base):
    __tablename__ = "shared_tracker_entries"

    id = Column(Integer, primary_key=True, index=True)
    row_id = Column(Integer, ForeignKey("shared_tracker_rows.id"), nullable=False)
    month = Column(Integer, nullable=False)
    year = Column(Integer, nullable=False)
    amount = Column(Numeric(12, 2), nullable=True)
    state = Column(String, default="unpaid")  # "paid" | "unpaid"
    notes = Column(Text, nullable=True)
    held_by = Column(Integer, ForeignKey("people.id"), nullable=True)

    row = relationship("SharedTrackerRow", back_populates="entries")
