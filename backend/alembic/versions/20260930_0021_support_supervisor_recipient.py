"""Rename the support recipient role from supplier to supervisor."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260930_0021"
down_revision: str | None = "20260930_0020"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    op.execute(sa.text("UPDATE support_tickets SET recipient_role = 'SUPERVISOR' WHERE recipient_role = 'SUPPLIER'"))
    op.alter_column("support_tickets", "recipient_role", server_default="SUPERVISOR")


def downgrade() -> None:
    bind = op.get_bind()
    op.execute(sa.text("UPDATE support_tickets SET recipient_role = 'SUPPLIER' WHERE recipient_role = 'SUPERVISOR'"))
    op.alter_column("support_tickets", "recipient_role", server_default="SUPPLIER")
