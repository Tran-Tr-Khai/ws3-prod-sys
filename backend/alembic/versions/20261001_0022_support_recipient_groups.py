"""Add machine-group targets for workshop notifications."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261001_0022"
down_revision: str | None = "20260930_0021"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("support_tickets", sa.Column("recipient_group", sa.String(length=50), nullable=True))
    op.create_index("ix_support_tickets_recipient_group", "support_tickets", ["recipient_group"])


def downgrade() -> None:
    op.drop_index("ix_support_tickets_recipient_group", table_name="support_tickets")
    op.drop_column("support_tickets", "recipient_group")
