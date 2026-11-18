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
    """
    Hash a browser session token before it is stored or queried.

    Args:
        token: Opaque token issued to the browser.

    Returns:
        HMAC-SHA256 digest safe to persist in the database.
    """
    secret = get_settings().auth_secret_key.encode()
    return hmac.new(secret, token.encode(), hashlib.sha256).hexdigest()


def create_session(db: Session, user: User) -> str:
    """
    Create a new persistent login session for an active user.

    Args:
        db: Database session used to save the token hash.
        user: Authenticated user receiving the new session.

    Returns:
        Raw token that must be sent only in the HTTP-only cookie.
    """
    settings = get_settings()
    token = secrets.token_urlsafe(48)
    expires_at = None if settings.auth_session_ttl_hours <= 0 else datetime.now(timezone.utc) + timedelta(hours=settings.auth_session_ttl_hours)
    db.add(UserSession(user_id=user.id, token_hash=_token_hash(token), expires_at=expires_at))
    db.commit()
    return token


def delete_session(db: Session, token: str | None) -> None:
    """
    Remove a browser session when the user logs out.

    Args:
        db: Database session used to delete the stored token hash.
        token: Raw session token from the browser, if present.
    """
    if token:
        db.execute(delete(UserSession).where(UserSession.token_hash == _token_hash(token)))
        db.commit()


def get_current_user_for_session(token: str | None, db: Session) -> User:
    """
    Resolve one browser session token to an active MES user.

    Both HTTP routes and WebSocket handshakes use this function so realtime
    data cannot bypass the normal session policy.

    Args:
        token: Value of the HTTP-only session cookie, if supplied.
        db: Open database session used to resolve the stored token hash.

    Returns:
        Active authenticated user.

    Raises:
        HTTPException: 401 when the token is absent, expired or belongs to an
            inactive/deleted user.
    """
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


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """
    Resolve the current HTTP request to its authenticated MES user.

    Args:
        request: Incoming request containing the session cookie.
        db: Database session injected by FastAPI.

    Returns:
        Active authenticated user.
    """
    return get_current_user_for_session(request.cookies.get(SESSION_COOKIE), db)


def role_codes(user: User) -> set[str]:
    """
    Return normalized role codes assigned to a user.

    Args:
        user: User with roles loaded from the database.

    Returns:
        Set of role codes used by authorization rules.
    """
    return {role.code for role in user.roles}
