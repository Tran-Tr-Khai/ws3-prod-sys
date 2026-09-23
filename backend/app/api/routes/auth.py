from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config.settings import get_settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginRequest, UserResponse
from app.security.auth import SESSION_COOKIE, create_session, delete_session, get_current_user, role_codes
from app.security.passwords import verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


def to_response(user: User) -> UserResponse:
    codes = role_codes(user)
    role = "ADMIN" if "ADMIN" in codes else "SUPERVISOR" if "PRODUCTION_MANAGER" in codes or "SUPERVISOR" in codes else "OPERATOR"
    return UserResponse(username=user.username, display_name=user.full_name, role=role, machine_ids=user.machine_ids or [])


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> UserResponse:
    user = db.scalar(select(User).options(selectinload(User.roles)).where(User.username == payload.username.strip().lower()))
    if user is None or not user.is_active or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    token = create_session(db, user)
    settings = get_settings()
    cookie_options = {"httponly": True, "secure": settings.auth_cookie_secure, "samesite": "lax", "path": "/"}
    if settings.auth_session_ttl_hours > 0:
        cookie_options["max_age"] = settings.auth_session_ttl_hours * 3600
    response.set_cookie(SESSION_COOKIE, token, **cookie_options)
    return to_response(user)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> None:
    delete_session(db, request.cookies.get(SESSION_COOKIE))
    response.delete_cookie(SESSION_COOKIE, path="/")


@router.get("/me", response_model=UserResponse)
def me(user: User = Depends(get_current_user)) -> UserResponse:
    return to_response(user)
