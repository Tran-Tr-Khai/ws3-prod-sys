"""Add order and employee metadata to Buffing checklist rows."""

import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
    create_index_if_missing,
)


revision = "20261003_0030"
down_revision = "20261003_0029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    add_column_if_missing("buffing_checks", sa.Column("operator_identifier", sa.String(length=80), nullable=True))
    add_column_if_missing("buffing_checks", sa.Column("shift", sa.String(length=80), nullable=True))
    add_column_if_missing("buffing_checks", sa.Column("order_number", sa.String(length=160), nullable=True))
    create_index_if_missing("ix_buffing_checks_order_number", "buffing_checks", ["order_number"])


def downgrade() -> None:
    op.drop_index("ix_buffing_checks_order_number", table_name="buffing_checks")
    op.drop_column("buffing_checks", "order_number")
    op.drop_column("buffing_checks", "shift")
    op.drop_column("buffing_checks", "operator_identifier")
