import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.database import get_db
from app.auth import get_current_user
from app.models.user import User
from app.models.person import Person
from app.models.shared_tracker import SharedTrackerRow, SharedTrackerEntry
from app.schemas.shared_tracker import (
    SharedTrackerRowCreate, SharedTrackerRowUpdate, SharedTrackerEntryUpdate,
    SharedTrackerRowOut, SharedTrackerEntryOut, SharedTrackerPublicView, ShareLinkOut,
)

router = APIRouter(prefix="/shared-tracker", tags=["shared-tracker"])
public_router = APIRouter(prefix="/public/shared-tracker", tags=["shared-tracker"])


def _month_view(db: Session, user_id: int, month: int, year: int) -> list[SharedTrackerRowOut]:
    """Rows for this month, auto-creating entries (amount carried from the most
    recent prior month, state reset to unpaid) wherever one doesn't exist yet."""
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
        out.append(SharedTrackerRowOut(id=row.id, label=row.label, entry=entry))
    return out


def _user_by_token(token: str, db: Session) -> User:
    user = db.query(User).filter(User.share_token == token).first()
    if not user:
        raise HTTPException(status_code=404, detail="Shared tracker not found")
    return user


def _holders_for_user(db: Session, user_id: int) -> list[dict]:
    """People already assigned as Held By somewhere in this tracker — the only
    ones exposed to the public link, not the full People book."""
    holder_ids = (
        db.query(SharedTrackerEntry.held_by)
        .join(SharedTrackerRow)
        .filter(SharedTrackerRow.user_id == user_id, SharedTrackerEntry.held_by.isnot(None))
        .distinct()
        .all()
    )
    ids = [h[0] for h in holder_ids]
    if not ids:
        return []
    people = db.query(Person).filter(Person.id.in_(ids), Person.user_id == user_id).all()
    return [{"id": p.id, "name": p.nickname or p.name} for p in people]


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
        if not db.query(Person).filter(Person.id == fields["held_by"], Person.user_id == user_id).first():
            raise HTTPException(status_code=400, detail="Invalid held_by")
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
    row = SharedTrackerRow(user_id=current_user.id, label=data.label)
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"id": row.id, "label": row.label}


@router.put("/rows/{row_id}")
def rename_row(
    row_id: int,
    data: SharedTrackerRowUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.query(SharedTrackerRow).filter(SharedTrackerRow.id == row_id, SharedTrackerRow.user_id == current_user.id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Row not found")
    row.label = data.label
    db.commit()
    return {"id": row.id, "label": row.label}


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

@public_router.get("/{token}", response_model=SharedTrackerPublicView)
def public_list_month(
    token: str,
    month: int,
    year: int,
    db: Session = Depends(get_db),
):
    user = _user_by_token(token, db)
    return {
        "rows": _month_view(db, user.id, month, year),
        "holders": _holders_for_user(db, user.id),
    }


@public_router.patch("/{token}/entries/{entry_id}", response_model=SharedTrackerEntryOut)
def public_update_entry(
    token: str,
    entry_id: int,
    data: SharedTrackerEntryUpdate,
    db: Session = Depends(get_db),
):
    user = _user_by_token(token, db)
    return _update_entry(entry_id, data, user.id, db)
