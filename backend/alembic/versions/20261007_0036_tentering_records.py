"""Add Tentering order metadata and up to nine per-order roll entries."""

import sqlalchemy as sa
from alembic import op


revision = "20261007_0036"
down_revision = "20261006_0035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "tentering_orders",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("sop_no", sa.String(length=160), nullable=False),
        sa.Column("customer", sa.String(length=160), nullable=True),
        sa.Column("item_description", sa.String(length=300), nullable=True),
        sa.Column("warp_yarn", sa.String(length=160), nullable=True),
        sa.Column("weft_yarn", sa.String(length=160), nullable=True),
        sa.Column("greige_density_pick", sa.Numeric(14, 3), nullable=True),
        sa.Column("finish_density_pick", sa.Numeric(14, 3), nullable=True),
        sa.Column("shrink_percent", sa.Numeric(8, 3), nullable=True),
        sa.Column("greige_width_inch", sa.Numeric(10, 3), nullable=True),
        sa.Column("finish_width_inch", sa.Numeric(10, 3), nullable=True),
        sa.Column("fabric_received_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_tentering_orders_sop_no", "tentering_orders", ["sop_no"], unique=True)

    op.create_table(
        "tentering_roll_entries",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("tentering_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("roll_number", sa.SmallInteger(), nullable=False),
        sa.Column("tenter_date", sa.Date(), nullable=True),
        sa.Column("weaving_date", sa.Date(), nullable=True),
        sa.Column("planned_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("actual_quantity", sa.Numeric(14, 3), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("recorded_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
        sa.Column("recorded_by_name", sa.String(length=160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("order_id", "roll_number", name="uq_tentering_roll_order_number"),
        sa.CheckConstraint("roll_number BETWEEN 1 AND 9", name="ck_tentering_roll_number_1_9"),
        sa.CheckConstraint("planned_quantity IS NULL OR planned_quantity >= 0", name="ck_tentering_planned_qty_nonnegative"),
        sa.CheckConstraint("actual_quantity IS NULL OR actual_quantity >= 0", name="ck_tentering_actual_qty_nonnegative"),
    )
    op.create_index("ix_tentering_roll_entries_order_id", "tentering_roll_entries", ["order_id"])
    op.create_index("ix_tentering_roll_entries_recorded_by_id", "tentering_roll_entries", ["recorded_by_id"])


def downgrade() -> None:
    op.drop_index("ix_tentering_roll_entries_recorded_by_id", table_name="tentering_roll_entries")
    op.drop_index("ix_tentering_roll_entries_order_id", table_name="tentering_roll_entries")
    op.drop_table("tentering_roll_entries")
    op.drop_index("ix_tentering_orders_sop_no", table_name="tentering_orders")
    op.drop_table("tentering_orders")
