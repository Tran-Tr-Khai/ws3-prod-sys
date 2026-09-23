"""Allow non-expiring authentication sessions."""

from collections.abc import Sequence

from alembic import op

revision: str = "20260922_0011"
down_revision: str | None = "20260922_0010"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("user_sessions", "expires_at", nullable=True)


def downgrade() -> None:
    op.alter_column("user_sessions", "expires_at", nullable=False)
