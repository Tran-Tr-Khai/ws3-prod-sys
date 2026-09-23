import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config.settings import get_settings
from app.db.session import get_db
from app.models.user import User, UserSession

SESSION_COOKIE = "ws3_session"


def _token_hash(token: str) -> str:
    secret = get_settings().auth_secret_key.encode()
    return hmac.new(secret, token.encode(), hashlib.sha256).hexdigest()


def create_session(db: Session, user: User) -> str:
    settings = get_settings()
    token = secrets.token_urlsafe(48)
    expires_at = None if settings.auth_session_ttl_hours <= 0 else datetime.now(timezone.utc) + timedelta(hours=settings.auth_session_ttl_hours)
    db.add(UserSession(user_id=user.id, token_hash=_token_hash(token), expires_at=expires_at))
    db.commit()
    return token


def delete_session(db: Session, token: str | None) -> None:
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _token_hash(token)))
        db.commit()


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    session = db.scalar(select(UserSession).where(UserSession.token_hash == _token_hash(token)))
    now = datetime.now(timezone.utc)
    if session is None or (session.expires_at is not None and session.expires_at <= now):
        if session is not None:
            db.delete(session)
            db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    user = db.get(User, session.user_id)
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")
    return user


def role_codes(user: User) -> set[str]:
    return {role.code for role in user.roles}
