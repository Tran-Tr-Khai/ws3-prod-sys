"""Store Scouring loss separately from production output quantity."""

import sqlalchemy as sa
from alembic import op


revision = "20261005_0034"
down_revision = "20261005_0033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("scouring_records", sa.Column("loss_meters", sa.Numeric(14, 3), nullable=True))


def downgrade() -> None:
    op.drop_column("scouring_records", "loss_meters")
