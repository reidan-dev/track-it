from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class SharedTrackerRow(Base):
    __tablename__ = "shared_tracker_rows"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    label = Column(String, nullable=False)
    allowed_holders = Column(JSON, default=list)  # person ids the viewer may pick as Held By
    created_at = Column(DateTime, default=datetime.utcnow)
    row_type = Column(String, nullable=True)  # "bill" | "expense" | "income" | "installment"
    due_day = Column(Integer, nullable=True)  # only used when row_type == "bill"
    total_terms = Column(Integer, nullable=True)  # only used when row_type == "installment"
    linked_master_id = Column(Integer, nullable=True)  # created Bill.id/Installment.id, set on first Paid

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
    participants = Column(JSON, default=list)  # person ids the amount is split across; 0 = Me
    participant_amounts = Column(JSON, default=dict)  # optional custom per-person split
    linked_record_type = Column(String, nullable=True)  # "income" | "expense" | "bill_payment" | "installment_payment"
    linked_record_id = Column(Integer, nullable=True)  # id of the created record for this month

    row = relationship("SharedTrackerRow", back_populates="entries")
