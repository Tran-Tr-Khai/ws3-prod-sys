"""Initial WS3 database schema.

Revision ID: 20260916_0001
Revises:
"""
from collections.abc import Sequence

from alembic import op

from app.db.base import Base
from app import models  # noqa: F401 - register all models before create_all

revision: str = "20260916_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade() -> None:
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
