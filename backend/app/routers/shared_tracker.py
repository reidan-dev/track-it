import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User, UserSettings
from app.models.person import Person
from app.models.shared_tracker import SharedTrackerRow, SharedTrackerEntry
from app.schemas.shared_tracker import (
    SharedTrackerRowCreate, SharedTrackerRowUpdate, SharedTrackerEntryUpdate,
    SharedTrackerRowOut, SharedTrackerEntryOut, ShareLinkOut,
)
from app.scheduler import send_telegram, _fmt

router = APIRouter(prefix="/shared-tracker", tags=["shared-tracker"])
public_router = APIRouter(prefix="/public/shared-tracker", tags=["shared-tracker"])


def _resolve_holders(db: Session, user_id: int, ids: list[int]) -> list[dict]:
    """allowed_holders ids resolved to display names, scoped to this user."""
    if not ids:
        return []
    people = {p.id: p for p in db.query(Person).filter(Person.id.in_(ids), Person.user_id == user_id).all()}
    return [{"id": pid, "name": people[pid].nickname or people[pid].name} for pid in ids if pid in people]


def _month_view(db: Session, user_id: int, month: int, year: int) -> list[SharedTrackerRowOut]:
    """Rows for this month, auto-creating entries (amount and held_by carried
    from the most recent prior month, state reset to unpaid) wherever one
    doesn't exist yet."""
    rows = db.query(SharedTrackerRow).filter(SharedTrackerRow.user_id == user_id).order_by(SharedTrackerRow.id).all()
    out = []
    for row in rows:
        entry = db.query(SharedTrackerEntry).filter(
            SharedTrackerEntry.row_id == row.id,
            SharedTrackerEntry.month == month,
            SharedTrackerEntry.year == year,
        ).first()
        if not entry:
            prev = db.query(SharedTrackerEntry).filter(
                SharedTrackerEntry.row_id == row.id,
                or_(
                    SharedTrackerEntry.year < year,
                    and_(SharedTrackerEntry.year == year, SharedTrackerEntry.month < month),
                ),
            ).order_by(SharedTrackerEntry.year.desc(), SharedTrackerEntry.month.desc()).first()
            entry = SharedTrackerEntry(
                row_id=row.id, month=month, year=year,
                amount=prev.amount if prev else None,
                held_by=prev.held_by if prev else None,
                state="unpaid",
            )
            db.add(entry)
            db.commit()
            db.refresh(entry)
        allowed = row.allowed_holders or []
        out.append(SharedTrackerRowOut(
            id=row.id, label=row.label, allowed_holders=allowed,
            holders=_resolve_holders(db, user_id, allowed), entry=entry,
        ))
    return out


def _user_by_token(token: str, db: Session) -> User:
    user = db.query(User).filter(User.share_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Shared tracker not found")
    return user


def _notify_viewer_change(db: Session, user: User, row: SharedTrackerRow, entry: SharedTrackerEntry, before: dict, fields: dict) -> None:
    settings = db.query(UserSettings).filter(UserSettings.user_id == user.id).first()
    if not (settings and settings.telegram_enabled and settings.telegram_bot_token and settings.telegram_chat_id):
        return
    changes = []
    if "amount" in fields:
        changes.append(f"Amount: {_fmt(before['amount'], user.currency)} → {_fmt(entry.amount, user.currency)}")
    if "state" in fields:
        changes.append(f"Marked {entry.state.capitalize()}")
    if "notes" in fields:
        changes.append("Notes updated")
    if "held_by" in fields:
        holders = {h["id"]: h["name"] for h in _resolve_holders(db, user.id, row.allowed_holders or [])}
        changes.append(f"Held by: {holders.get(entry.held_by, '— none —')}")
    if not changes:
        return
    text = f"\U0001f4dd Viewer updated ‘{row.label}’\n" + "\n".join(changes)
    send_telegram(settings.telegram_bot_token, settings.telegram_chat_id, text)


def _update_entry(entry_id: int, data: SharedTrackerEntryUpdate, user_id: int, db: Session) -> SharedTrackerEntry:
    entry = (
        db.query(SharedTrackerEntry)
        .join(SharedTrackerRow)
        .filter(SharedTrackerEntry.id == entry_id, SharedTrackerRow.user_id == user_id)
        .first()
    )
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    fields = data.model_dump(exclude_unset=True)
    if fields.get("held_by") is not None:
        row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == entry.row_id).first()
        if fields["held_by"] not in (row.allowed_holders or []):
            raise HTTPException(status_code=400, detail="held_by must be one of the row's allowed holders")
    for field, value in fields.items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


# --- Editor (authenticated) ---

@router.get("", response_model=list[SharedTrackerRowOut])
def list_month(
    month: int,
    year: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _month_view(db, current_user.id, month, year)


@router.post("/rows", status_code=201)
def add_row(
    data: SharedTrackerRowCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = SharedTrackerRow(user_id=current_user.id, label=data.label, allowed_holders=data.allowed_holders)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "label": row.label, "allowed_holders": row.allowed_holders or []}


@router.put("/rows/{row_id}")
def update_row(
    row_id: int,
    data: SharedTrackerRowUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == row_id, SharedTrackerRow.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    db.commit()
    return {"id": row.id, "label": row.label, "allowed_holders": row.allowed_holders or []}


@router.delete("/rows/{row_id}", status_code=204)
def delete_row(
    row_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == row_id, SharedTrackerRow.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    db.delete(row)
    db.commit()


@router.patch("/entries/{entry_id}", response_model=SharedTrackerEntryOut)
def update_entry(
    entry_id: int,
    data: SharedTrackerEntryUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _update_entry(entry_id, data, current_user.id, db)


@router.get("/share-link", response_model=ShareLinkOut)
def get_share_link(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not current_user.share_token:
        current_user.share_token = secrets.token_urlsafe(9)  # ~12 chars, still ~72 bits of entropy
        db.commit()
    return {"token": current_user.share_token}


# --- Viewer (public, no auth) ---

@public_router.get("/{token}", response_model=list[SharedTrackerRowOut])
def public_list_month(
    token: str,
    month: int,
    year: int,
    db: Session = Depends(get_db),
):
    user = _user_by_token(token, db)
    return _month_view(db, user.id, month, year)


@public_router.patch("/{token}/entries/{entry_id}", response_model=SharedTrackerEntryOut)
def public_update_entry(
    token: str,
    entry_id: int,
    data: SharedTrackerEntryUpdate,
    db: Session = Depends(get_db),
):
    user = _user_by_token(token, db)
    fields = data.model_dump(exclude_unset=True)
    before_entry = db.query(SharedTrackerEntry).filter(SharedTrackerEntry.id == entry_id).first()
    before = {"amount": before_entry.amount} if before_entry else {}
    entry = _update_entry(entry_id, data, user.id, db)
    row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == entry.row_id).first()
    _notify_viewer_change(db, user, row, entry, before, fields)
    return entry
