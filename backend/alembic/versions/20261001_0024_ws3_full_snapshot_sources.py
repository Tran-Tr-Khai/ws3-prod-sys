"""Replace intermediate WS3 tables with four full-snapshot source tables.

Revision ID: 20261001_0024
Revises: 20261001_0023
"""

from alembic import op
import sqlalchemy as sa


revision = "20261001_0024"
down_revision = "20261001_0023"
branch_labels = None
depends_on = None


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    ]


def upgrade() -> None:
    # 0023 only introduced empty, interim tables; full snapshots are the agreed source of truth.
    op.drop_table("ws3_production_rolls")
    op.drop_table("ws3_production_orders")
    op.drop_table("ws3_production_plans")
    op.drop_table("ws3_import_sessions")

    op.create_table(
        "ws3_production_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_date", sa.String(length=40)), sa.Column("sop_no", sa.String(length=120)),
        sa.Column("machine_no", sa.String(length=120)), sa.Column("roll_required", sa.String(length=40)),
        sa.Column("po_no", sa.String(length=160)), sa.Column("source_order_no", sa.String(length=160)),
        sa.Column("item_code", sa.String(length=160)), sa.Column("item_name", sa.String(length=500)),
        sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"), *_timestamps(),
    )
    for column in ("plan_date", "sop_no", "machine_no", "po_no", "source_order_no", "item_code"):
        op.create_index(f"ix_ws3_production_plans_{column}", "ws3_production_plans", [column])

    op.create_table(
        "ws3_production_orders",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("production_date", sa.String(length=40)), sa.Column("pk_no", sa.String(length=160)),
        sa.Column("out_no", sa.String(length=160)), sa.Column("po_no", sa.String(length=160)),
        sa.Column("source_order_no", sa.String(length=160)), sa.Column("item_code", sa.String(length=160)),
        sa.Column("item_name", sa.String(length=500)), sa.Column("lot_no", sa.String(length=160)),
        sa.Column("quantity", sa.String(length=80)), sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
        *_timestamps(),
    )
    for column in ("production_date", "pk_no", "out_no", "po_no", "source_order_no", "item_code", "lot_no"):
        op.create_index(f"ix_ws3_production_orders_{column}", "ws3_production_orders", [column])

    op.create_table(
        "ws3_machine_ws2_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("weaving_date", sa.String(length=40)), sa.Column("roll_id", sa.String(length=160)),
        sa.Column("machine_no", sa.String(length=120)), sa.Column("sop_no", sa.String(length=120)),
        sa.Column("po_no", sa.String(length=160)), sa.Column("source_order_no", sa.String(length=160)),
        sa.Column("item_code", sa.String(length=160)), sa.Column("item_name", sa.String(length=500)),
        sa.Column("lot_no", sa.String(length=160)), sa.Column("length_meters", sa.Numeric(14, 3)),
        sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"), *_timestamps(),
    )
    for column in ("weaving_date", "roll_id", "machine_no", "sop_no", "po_no", "source_order_no", "item_code"):
        op.create_index(f"ix_ws3_machine_ws2_records_{column}", "ws3_machine_ws2_records", [column])

    op.create_table(
        "ws3_worker_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("weaving_date", sa.String(length=40)), sa.Column("shift", sa.String(length=80)),
        sa.Column("worker", sa.String(length=160)), sa.Column("customer", sa.String(length=160)),
        sa.Column("po_no", sa.String(length=160)), sa.Column("source_order_no", sa.String(length=160)),
        sa.Column("item_code", sa.String(length=160)), sa.Column("item_name", sa.String(length=500)),
        sa.Column("sop_no", sa.String(length=120)), sa.Column("lot_no", sa.String(length=160)),
        sa.Column("machine_no", sa.String(length=120)), sa.Column("quantity", sa.String(length=80)),
        sa.Column("length_meters", sa.Numeric(14, 3)), sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"),
        *_timestamps(),
    )
    for column in ("weaving_date", "po_no", "source_order_no", "item_code", "sop_no", "lot_no", "machine_no"):
        op.create_index(f"ix_ws3_worker_records_{column}", "ws3_worker_records", [column])


def downgrade() -> None:
    op.drop_table("ws3_worker_records")
    op.drop_table("ws3_machine_ws2_records")
    op.drop_table("ws3_production_orders")
    op.drop_table("ws3_production_plans")
