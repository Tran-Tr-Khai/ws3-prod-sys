"""Persist Tentering order progress on the order record."""

import sqlalchemy as sa
from alembic import op


revision = "20261007_0038"
down_revision = "20261007_0037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tentering_orders",
        sa.Column("order_progress", sa.String(length=20), nullable=False, server_default="IN_PROGRESS"),
    )
    op.alter_column("tentering_orders", "order_progress", server_default=None)


def downgrade() -> None:
    op.drop_column("tentering_orders", "order_progress")
