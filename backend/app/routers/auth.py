from fastapi import APIRouter, Depends, HTTPException, status, Response, Cookie
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.auth import verify_password, create_access_token, create_refresh_token, decode_token
from app.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    token_type: str = "bearer"


def _set_refresh_cookie(response: Response, refresh_token: str) -> None:
    # Best-effort cookie fallback. The client also keeps the refresh token in
    # localStorage and sends it in the request body, so cross-site SameSite
    # rules can't silently log the user out.
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        max_age=settings.refresh_token_expire_days * 86400,
        samesite="lax",
        secure=False,
    )


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    access_token = create_access_token({"sub": str(user.id)})
    refresh_token = create_refresh_token({"sub": str(user.id)})
    _set_refresh_cookie(response, refresh_token)
    return {"access_token": access_token, "refresh_token": refresh_token}


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    response: Response,
    body: Optional[RefreshRequest] = None,
    refresh_token: Optional[str] = Cookie(default=None),
):
    # Prefer the token from the request body (origin-independent); fall back to
    # the cookie for browsers that still send it.
    token = (body.refresh_token if body else None) or refresh_token
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")
    payload = decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    access_token = create_access_token({"sub": payload["sub"]})
    new_refresh = create_refresh_token({"sub": payload["sub"]})
    _set_refresh_cookie(response, new_refresh)
    return {"access_token": access_token, "refresh_token": new_refresh}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}
