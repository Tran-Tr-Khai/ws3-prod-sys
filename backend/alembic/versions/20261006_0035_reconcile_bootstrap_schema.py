"""Align databases created by migrations and by the former model bootstrap.

Only widen columns and reconcile known indexes. Never delete business rows.
"""
import sqlalchemy as sa
from alembic import op

from migration_support import create_index_if_missing, widen_legacy_lot_columns

revision = "20261006_0035"
down_revision = "20261005_0034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    widen_legacy_lot_columns()
    for table, column in (
        ("ws3_production_plans", "po_no"),
        ("ws3_production_orders", "item_code"),
        ("ws3_production_orders", "lot_no"),
        ("ws3_machine_ws2_records", "item_code"),
    ):
        create_index_if_missing(f"ix_{table}_{column}", table, [column])
    create_index_if_missing(
        "ix_ws3_unrolling_event_roll_id", "ws3_unrolling_roll_events", ["roll_id"],
    )
    create_index_if_missing("ix_ws3_orders_order_no", "ws3_orders", ["order_no"], unique=True)
    # 0014 historically created both a unique index and an identical constraint.
    # Keep the index (also declared by the ORM); remove only the redundant one.
    for constraint in sa.inspect(op.get_bind()).get_unique_constraints("ws3_orders"):
        if constraint["name"] == "ws3_orders_order_no_key" and constraint["column_names"] == ["order_no"]:
            op.drop_constraint(constraint["name"], "ws3_orders", type_="unique")
    create_index_if_missing(
        "uq_ws3_order_rolls_source_key", "ws3_order_rolls", ["source_key"],
        unique=True, postgresql_where=sa.text("source_key IS NOT NULL"),
    )
    indexes = {item["name"] for item in sa.inspect(op.get_bind()).get_indexes("ws3_order_rolls")}
    if "ix_ws3_order_rolls_source_key" in indexes:
        op.drop_index("ix_ws3_order_rolls_source_key", table_name="ws3_order_rolls")


def downgrade() -> None:
    # A compatibility repair has no single prior schema. Retain wider columns
    # and indexes, which are backward-compatible, instead of risking truncation.
    pass
