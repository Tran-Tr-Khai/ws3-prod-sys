"""Store Scouring loss separately from production output quantity."""

import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
)


revision = "20261005_0034"
down_revision = "20261005_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing("scouring_records", sa.Column("loss_meters", sa.Numeric(14, 3), nullable=True))


def downgrade() -> None:
    op.drop_column("scouring_records", "loss_meters")
