"""Prevent the same MES source key from being imported twice."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_0016"
down_revision: str | None = "20260926_0015"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if inspector.has_table("ws3_order_rolls"):
        indexes = {index["name"] for index in inspector.get_indexes("ws3_order_rolls")}
        if "ix_ws3_order_rolls_source_key" in indexes:
            op.drop_index("ix_ws3_order_rolls_source_key", table_name="ws3_order_rolls")
        op.create_index(
            "uq_ws3_order_rolls_source_key",
            "ws3_order_rolls",
            ["source_key"],
            unique=True,
            postgresql_where=sa.text("source_key IS NOT NULL"),
        )


def downgrade() -> None:
    op.drop_index("uq_ws3_order_rolls_source_key", table_name="ws3_order_rolls")
    op.create_index("ix_ws3_order_rolls_source_key", "ws3_order_rolls", ["source_key"])
