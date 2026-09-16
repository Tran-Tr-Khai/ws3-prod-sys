from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import Role

INITIAL_ROLES = (
    ("ADMIN", "System administrator"),
    ("PRODUCTION_MANAGER", "Production manager"),
    ("OPERATOR", "Machine operator"),
)


def seed_initial_data(session: Session) -> None:
    for code, name in INITIAL_ROLES:
        role = session.scalar(select(Role).where(Role.code == code))
        if role is None:
            session.add(Role(code=code, name=name))
    session.commit()
