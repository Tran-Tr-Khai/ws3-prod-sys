"""Add machine-group targets for workshop notifications."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261001_0022"
down_revision: str | None = "20260930_0021"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("support_tickets")}
    if "recipient_group" not in columns:
        op.add_column("support_tickets", sa.Column("recipient_group", sa.String(length=50), nullable=True))

    indexes = {index["name"] for index in sa.inspect(bind).get_indexes("support_tickets")}
    if "ix_support_tickets_recipient_group" not in indexes:
        op.create_index("ix_support_tickets_recipient_group", "support_tickets", ["recipient_group"])


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    indexes = {index["name"] for index in inspector.get_indexes("support_tickets")}
    if "ix_support_tickets_recipient_group" in indexes:
        op.drop_index("ix_support_tickets_recipient_group", table_name="support_tickets")
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("support_tickets")}
    if "recipient_group" in columns:
        op.drop_column("support_tickets", "recipient_group")
