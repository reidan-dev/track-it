"""Per-chat conversation state for multi-step Telegram prompt flows."""
from datetime import datetime, timedelta

from app.models.telegram import TelegramConversation

# Abandon a half-finished flow after this long so a stale "what for?" prompt
# doesn't hijack an unrelated message days later.
STALE_AFTER = timedelta(hours=2)


def get_state(db, user_id, chat_id):
    conv = db.query(TelegramConversation).filter(
        TelegramConversation.user_id == user_id,
        TelegramConversation.chat_id == str(chat_id),
    ).first()
    if conv and conv.flow and conv.updated_at and (datetime.utcnow() - conv.updated_at) > STALE_AFTER:
        clear_state(db, user_id, chat_id)
        return None
    return conv


def set_state(db, user_id, chat_id, flow=None, step=None, data=None, prompt_message_id=None):
    conv = db.query(TelegramConversation).filter(
        TelegramConversation.user_id == user_id,
        TelegramConversation.chat_id == str(chat_id),
    ).first()
    if not conv:
        conv = TelegramConversation(user_id=user_id, chat_id=str(chat_id))
        db.add(conv)
    conv.flow = flow
    conv.step = step
    conv.data = data or {}
    conv.prompt_message_id = prompt_message_id
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)
    return conv


def update_data(db, conv, step=None, **new_data):
    """Merge fields into an existing flow's data and advance the step."""
    merged = dict(conv.data or {})
    merged.update(new_data)
    conv.data = merged
    if step is not None:
        conv.step = step
    conv.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(conv)
    return conv


def clear_state(db, user_id, chat_id):
    db.query(TelegramConversation).filter(
        TelegramConversation.user_id == user_id,
        TelegramConversation.chat_id == str(chat_id),
    ).delete()
    db.commit()
