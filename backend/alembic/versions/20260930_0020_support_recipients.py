"""Store the intended recipient for support tickets."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260930_0020"
down_revision: str | None = "20260926_0019"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("support_tickets")}
    if "recipient_role" not in columns:
        op.add_column("support_tickets", sa.Column("recipient_role", sa.String(length=20), nullable=True, server_default="SUPERVISOR"))
    indexes = {item["name"] for item in inspector.get_indexes("support_tickets")}
    if "ix_support_tickets_recipient_role" not in indexes:
        op.create_index("ix_support_tickets_recipient_role", "support_tickets", ["recipient_role"])
    op.alter_column("support_tickets", "recipient_role", nullable=False, server_default=None)


def downgrade() -> None:
    op.drop_index("ix_support_tickets_recipient_role", table_name="support_tickets")
    op.drop_column("support_tickets", "recipient_role")
