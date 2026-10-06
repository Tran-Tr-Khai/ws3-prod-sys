"""Store Scouring operator shift and order progress with each record."""

import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
)


revision = "20261005_0032"
down_revision = "20261005_0031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing("scouring_records", sa.Column("shift", sa.String(length=80), nullable=True))
    add_column_if_missing("scouring_records", sa.Column("order_progress", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("scouring_records", "order_progress")
    op.drop_column("scouring_records", "shift")
