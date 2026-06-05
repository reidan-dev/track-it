from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import httpx
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User, UserSettings
from app.schemas.user import UserSettingsOut, UserSettingsUpdate
from app.scheduler import build_period_message, build_balance_message, send_telegram

router = APIRouter(prefix="/settings", tags=["settings"])


def _get_or_create_settings(user: User, db: Session) -> UserSettings:
    if not user.settings:
        settings = UserSettings(user_id=user.id)
        db.add(settings)
        db.commit()
        db.refresh(user)
    return user.settings


@router.get("")
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(current_user, db)
    result = UserSettingsOut.model_validate(s).model_dump()
    result["currency"] = current_user.currency
    result["theme"] = current_user.theme
    return result


@router.put("")
def update_settings(
    data: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(current_user, db)
    update_data = data.model_dump(exclude_unset=True)
    if "currency" in update_data:
        current_user.currency = update_data.pop("currency")
    if "theme" in update_data:
        current_user.theme = update_data.pop("theme")
    for field, value in update_data.items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    result = UserSettingsOut.model_validate(s).model_dump()
    result["currency"] = current_user.currency
    result["theme"] = current_user.theme
    return result


@router.post("/telegram/test")
async def test_telegram(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(current_user, db)
    if not s.telegram_bot_token or not s.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Telegram not configured")
    url = f"https://api.telegram.org/bot{s.telegram_bot_token}/sendMessage"
    async with httpx.AsyncClient() as client:
        resp = await client.post(url, json={
            "chat_id": s.telegram_chat_id,
            "text": "track.it: Telegram integration is working!",
        })
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Failed to send Telegram message")
    return {"message": "Test message sent"}


@router.post("/reminders/test")
def test_reminder(
    period: int = 1,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = _get_or_create_settings(current_user, db)
    if not s.telegram_bot_token or not s.telegram_chat_id:
        raise HTTPException(status_code=400, detail="Telegram not configured")
    if period not in (1, 2):
        raise HTTPException(status_code=400, detail="period must be 1 or 2")
    offset = s.reminder_utc_offset if s.reminder_utc_offset is not None else 8
    local_now = datetime.utcnow() + timedelta(hours=offset)
    lead = s.p1_lead_prev_month if period == 1 else s.p2_lead_prev_month
    if lead:
        ty, tm = (local_now.year + 1, 1) if local_now.month == 12 else (local_now.year, local_now.month + 1)
    else:
        ty, tm = local_now.year, local_now.month

    # Mirror the scheduler: send both messages for this period, separately.
    bill_ok = send_telegram(s.telegram_bot_token, s.telegram_chat_id, build_period_message(db, current_user, tm, ty, period))
    bal_ok = send_telegram(s.telegram_bot_token, s.telegram_chat_id, build_balance_message(db, current_user, tm, ty, period))
    if not (bill_ok and bal_ok):
        raise HTTPException(status_code=400, detail="Failed to send one or more Telegram messages")
    return {"message": f"Period {period}: bill + balance reminders sent"}
