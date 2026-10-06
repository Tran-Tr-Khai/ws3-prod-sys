"""Store the canonical PLAN and ORDER join keys."""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
    create_index_if_missing,
)

revision: str = "20261002_0025"
down_revision: str | None = "20261001_0024"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing("ws3_production_plans", sa.Column("dyeing_request_sop", sa.String(length=160), nullable=True))
    add_column_if_missing("ws3_production_orders", sa.Column("invoice_no", sa.String(length=160), nullable=True))
    create_index_if_missing("ix_ws3_production_plans_dyeing_request_sop", "ws3_production_plans", ["dyeing_request_sop"])
    create_index_if_missing("ix_ws3_production_orders_invoice_no", "ws3_production_orders", ["invoice_no"])


def downgrade() -> None:
    op.drop_index("ix_ws3_production_orders_invoice_no", table_name="ws3_production_orders")
    op.drop_index("ix_ws3_production_plans_dyeing_request_sop", table_name="ws3_production_plans")
    op.drop_column("ws3_production_orders", "invoice_no")
    op.drop_column("ws3_production_plans", "dyeing_request_sop")
