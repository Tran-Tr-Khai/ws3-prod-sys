"""Store MES imports separately from production orders."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_0018"
down_revision: str | None = "20260926_0017"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ws3_import_batches",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("source_format", sa.String(length=30), nullable=False, server_default="PASTE"),
        sa.Column("source_columns_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("selected_mapping_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="READY"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ws3_import_batches_status", "ws3_import_batches", ["status"])
    op.create_table(
        "ws3_import_rows",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("batch_id", sa.Integer(), sa.ForeignKey("ws3_import_batches.id", ondelete="CASCADE"), nullable=False),
        sa.Column("source_row_index", sa.Integer(), nullable=False),
        sa.Column("source_key", sa.String(length=500), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="AVAILABLE"),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("ws3_orders.id", ondelete="SET NULL"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_ws3_import_rows_batch_id", "ws3_import_rows", ["batch_id"])
    op.create_index("ix_ws3_import_rows_source_key", "ws3_import_rows", ["source_key"])
    op.create_index("ix_ws3_import_rows_status", "ws3_import_rows", ["status"])
    op.create_index("ix_ws3_import_rows_order_id", "ws3_import_rows", ["order_id"])


def downgrade() -> None:
    op.drop_index("ix_ws3_import_rows_order_id", table_name="ws3_import_rows")
    op.drop_index("ix_ws3_import_rows_status", table_name="ws3_import_rows")
    op.drop_index("ix_ws3_import_rows_source_key", table_name="ws3_import_rows")
    op.drop_index("ix_ws3_import_rows_batch_id", table_name="ws3_import_rows")
    op.drop_table("ws3_import_rows")
    op.drop_index("ix_ws3_import_batches_status", table_name="ws3_import_batches")
    op.drop_table("ws3_import_batches")
