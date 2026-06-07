"""Inbound Telegram webhook.

One bot per user, so the per-user secret in the URL path *is* the user lookup.
The same secret is also set as Telegram's `secret_token`, returned in the
`X-Telegram-Bot-Api-Secret-Token` header — we verify it to reject spoofed posts.
Always returns 200 so Telegram doesn't retry on app-level errors.
"""
import logging

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserSettings
from app.telegram.handlers import process_update

logger = logging.getLogger("trackit.telegram")

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request, db: Session = Depends(get_db)):
    settings = db.query(UserSettings).filter(
        UserSettings.telegram_webhook_secret == secret,
    ).first()
    if not settings:
        return {"ok": True}  # unknown secret — drop silently

    header = request.headers.get("X-Telegram-Bot-Api-Secret-Token")
    if header != secret:
        logger.warning("Telegram webhook secret header mismatch for user %s", settings.user_id)
        return {"ok": True}

    if not (settings.telegram_enabled and settings.telegram_bot_token):
        return {"ok": True}

    user = db.query(User).filter(User.id == settings.user_id).first()
    if not user:
        return {"ok": True}

    try:
        update = await request.json()
    except Exception:  # noqa: BLE001
        return {"ok": True}

    process_update(db, settings, user, update)
    return {"ok": True}
