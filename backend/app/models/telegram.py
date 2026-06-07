from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, JSON, UniqueConstraint
from datetime import datetime
from app.database import Base


class TelegramConversation(Base):
    """Per-chat conversation state for multi-step prompt flows.

    Button-only flows pack everything into callback_data and stay stateless;
    prompt flows (add-expense, add-income, loan, receipt-with-no-amount) need to
    remember which step they're on between messages, so they live here.
    """
    __tablename__ = "telegram_conversations"
    __table_args__ = (UniqueConstraint("user_id", "chat_id", name="uq_telegram_conv_user_chat"),)

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_id = Column(String, nullable=False, index=True)
    flow = Column(String, nullable=True)    # e.g. "add_expense", "add_income", "loan"
    step = Column(String, nullable=True)    # current step within the flow
    data = Column(JSON, default=dict)       # accumulated answers
    prompt_message_id = Column(Integer, nullable=True)  # last prompt msg (for cleanup/edit)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
