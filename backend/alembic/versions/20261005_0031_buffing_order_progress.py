"""Store Buffing order progress with each checklist record."""

import sqlalchemy as sa
from alembic import op


revision = "20261005_0031"
down_revision = "20261003_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Historical inspections have no reliable progress value, so keep them unknown.
    op.add_column("buffing_checks", sa.Column("order_progress", sa.String(length=20), nullable=True))


def downgrade() -> None:
    op.drop_column("buffing_checks", "order_progress")
