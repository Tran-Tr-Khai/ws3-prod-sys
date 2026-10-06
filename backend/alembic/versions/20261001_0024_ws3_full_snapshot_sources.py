"""Replace intermediate WS3 tables with four full-snapshot source tables.

Revision ID: 20261001_0024
Revises: 20261001_0023
"""

import sqlalchemy as sa
from alembic import op

from migration_support import (
    create_index_if_missing,
    create_table_if_missing,
    has_snapshot_schema,
    widen_legacy_lot_columns,
)


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
    if has_snapshot_schema():
        widen_legacy_lot_columns()
    else:
        # Never erase populated interim tables based on an assumption.
        inspector = sa.inspect(op.get_bind())
        interim_tables = (
            "ws3_production_rolls", "ws3_production_orders",
            "ws3_production_plans", "ws3_import_sessions",
        )
        for table in interim_tables:
            if inspector.has_table(table):
                source = sa.table(table)
                if op.get_bind().execute(sa.select(sa.literal(1)).select_from(source).limit(1)).first():
                    raise RuntimeError(
                        f"Cannot replace populated interim table {table}. "
                        "Back up and explicitly map its data to snapshot sources first."
                    )
        for table in interim_tables:
            if inspector.has_table(table):
                op.drop_table(table)

    create_table_if_missing(
        "ws3_production_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_date", sa.String(length=40)), sa.Column("sop_no", sa.String(length=120)),
        sa.Column("machine_no", sa.String(length=120)), sa.Column("roll_required", sa.String(length=40)),
        sa.Column("po_no", sa.String(length=160)), sa.Column("source_order_no", sa.String(length=160)),
        sa.Column("item_code", sa.String(length=160)), sa.Column("item_name", sa.String(length=500)),
        sa.Column("raw_data_json", sa.Text(), nullable=False, server_default="{}"), *_timestamps(),
    )
    for column in ("plan_date", "sop_no", "machine_no", "po_no", "source_order_no", "item_code"):
        create_index_if_missing(f"ix_ws3_production_plans_{column}", "ws3_production_plans", [column])

    create_table_if_missing(
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
        create_index_if_missing(f"ix_ws3_production_orders_{column}", "ws3_production_orders", [column])

    create_table_if_missing(
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
        create_index_if_missing(f"ix_ws3_machine_ws2_records_{column}", "ws3_machine_ws2_records", [column])

    create_table_if_missing(
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
        create_index_if_missing(f"ix_ws3_worker_records_{column}", "ws3_worker_records", [column])


def downgrade() -> None:
    raise RuntimeError(
        "0024 is an irreversible source-format transition. "
        "Restore a verified pre-upgrade backup instead of dropping snapshot data."
    )
