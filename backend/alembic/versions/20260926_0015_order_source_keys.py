"""Add source keys for idempotent MES imports."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_0015"
down_revision: str | None = "20260926_0014"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("ws3_order_rolls") and "source_key" not in {column["name"] for column in inspector.get_columns("ws3_order_rolls")}: 
        op.add_column("ws3_order_rolls", sa.Column("source_key", sa.String(length=500), nullable=True))
    if inspector.has_table("ws3_order_rolls") and "ix_ws3_order_rolls_source_key" not in {index["name"] for index in inspector.get_indexes("ws3_order_rolls")}: 
        op.create_index("ix_ws3_order_rolls_source_key", "ws3_order_rolls", ["source_key"])


def downgrade() -> None:
    op.drop_index("ix_ws3_order_rolls_source_key", table_name="ws3_order_rolls")
    op.drop_column("ws3_order_rolls", "source_key")
