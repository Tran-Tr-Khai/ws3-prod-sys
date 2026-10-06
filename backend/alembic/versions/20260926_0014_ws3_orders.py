"""Add flexible MES source imports and WS3 orders."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_0014"
down_revision: str | None = "20260922_0013"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("ws3_orders"):
        op.create_table(
            "ws3_orders",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_no", sa.String(length=80), nullable=False),
            sa.Column("source_filename", sa.String(length=255), nullable=True),
            sa.Column("source_format", sa.String(length=30), nullable=False, server_default="PASTE"),
            sa.Column("source_columns_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("selected_mapping_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("source_rows_json", sa.Text(), nullable=False, server_default="[]"),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="DRAFT"),
            sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
            sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ws3_orders_order_no", "ws3_orders", ["order_no"], unique=True)
        op.create_index("ix_ws3_orders_status", "ws3_orders", ["status"])
    if not inspector.has_table("ws3_order_rolls"):
        op.create_table(
            "ws3_order_rolls",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("order_id", sa.Integer(), sa.ForeignKey("ws3_orders.id", ondelete="CASCADE"), nullable=False),
            sa.Column("source_row_index", sa.Integer(), nullable=False),
            sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
            sa.Column("roll_id", sa.String(length=160), nullable=True),
            sa.Column("item_code", sa.String(length=160), nullable=True),
            sa.Column("item_name", sa.String(length=500), nullable=True),
            sa.Column("lot_no", sa.String(length=160), nullable=True),
            sa.Column("machine_no", sa.String(length=160), nullable=True),
            sa.Column("length_meters", sa.Numeric(14, 3), nullable=True),
            sa.Column("shift", sa.String(length=80), nullable=True),
            sa.Column("worker", sa.String(length=160), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False, server_default="WAITING"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ws3_order_rolls_order_id", "ws3_order_rolls", ["order_id"])
        op.create_index("ix_ws3_order_rolls_roll_id", "ws3_order_rolls", ["roll_id"])
        op.create_index("ix_ws3_order_rolls_status", "ws3_order_rolls", ["status"])


def downgrade() -> None:
    op.drop_table("ws3_order_rolls")
    op.drop_index("ix_ws3_orders_status", table_name="ws3_orders")
    op.drop_index("ix_ws3_orders_order_no", table_name="ws3_orders")
    op.drop_table("ws3_orders")
