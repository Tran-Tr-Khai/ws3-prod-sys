"""Add WS3 production source and result tables.

Revision ID: 20261001_0023
Revises: 20261001_0022
"""

from alembic import op
import sqlalchemy as sa


revision = "20261001_0023"
down_revision = "20261001_0022"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ws3_import_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_filename", sa.String(length=255), nullable=False),
        sa.Column("order_filename", sa.String(length=255), nullable=False),
        sa.Column("machine_filename", sa.String(length=255), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="SAVED"),
        sa.Column("order_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ready_order_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("check_order_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("roll_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_by_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="SET NULL")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ws3_import_sessions_status", "ws3_import_sessions", ["status"])
    op.create_table(
        "ws3_production_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("ws3_import_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("production_date", sa.String(length=40)), sa.Column("sop_no", sa.String(length=120)),
        sa.Column("lot_no", sa.String(length=120)), sa.Column("machine_no", sa.String(length=120)),
        sa.Column("roll_required", sa.String(length=40)), sa.Column("item_code", sa.String(length=160)),
        sa.Column("item_name", sa.String(length=500)), sa.Column("po_no", sa.String(length=160)),
        sa.Column("order_no", sa.String(length=160)), sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for column in ("session_id", "production_date", "sop_no", "lot_no", "machine_no", "item_code", "order_no"):
        op.create_index(f"ix_ws3_production_plans_{column}", "ws3_production_plans", [column])
    op.create_table(
        "ws3_production_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("ws3_import_sessions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("ws3_production_plans.id", ondelete="SET NULL")),
        sa.Column("order_no", sa.String(length=160), nullable=False), sa.Column("item_code", sa.String(length=160)),
        sa.Column("item_name", sa.String(length=500)), sa.Column("lot_no", sa.String(length=120)),
        sa.Column("sop_no", sa.String(length=120)), sa.Column("machine_no", sa.String(length=120)),
        sa.Column("expected_rolls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("matched_rolls", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=30), nullable=False, server_default="CHECK"),
        sa.Column("warnings_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    for column in ("session_id", "plan_id", "order_no", "status"):
        op.create_index(f"ix_ws3_production_orders_{column}", "ws3_production_orders", [column])
    op.create_table(
        "ws3_production_rolls",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("order_id", sa.Integer(), sa.ForeignKey("ws3_production_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("out_no", sa.String(length=160)), sa.Column("roll_id", sa.String(length=160)),
        sa.Column("production_date", sa.String(length=40)), sa.Column("item_code", sa.String(length=160)),
        sa.Column("item_name", sa.String(length=500)), sa.Column("lot_no", sa.String(length=120)),
        sa.Column("machine_no", sa.String(length=120)), sa.Column("length_meters", sa.Numeric(14, 3)),
        sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_ws3_production_rolls_order_id", "ws3_production_rolls", ["order_id"])
    op.create_index("ix_ws3_production_rolls_roll_id", "ws3_production_rolls", ["roll_id"])


def downgrade() -> None:
    op.drop_table("ws3_production_rolls")
    op.drop_table("ws3_production_orders")
    op.drop_table("ws3_production_plans")
    op.drop_table("ws3_import_sessions")
