"""Store Print daily production entries."""

import sqlalchemy as sa
from alembic import op


revision = "20261010_0043"
down_revision = "20261009_0042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "print_records",
        sa.Column("id", sa.Integer(), primary_key=True, nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("production_date", sa.Date(), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("order_number", sa.String(length=160), nullable=False),
        sa.Column("operator_name", sa.String(length=160), nullable=False),
        sa.Column("operator_identifier", sa.String(length=80), nullable=False),
        sa.Column("shift", sa.String(length=80), nullable=False),
        sa.Column("order_progress", sa.String(length=20), nullable=False),
        sa.Column("item", sa.String(length=300), nullable=False),
        sa.Column("buyer", sa.String(length=160), nullable=False),
        sa.Column("design", sa.String(length=160), nullable=False),
        sa.Column("speed", sa.Numeric(10, 2), nullable=False),
        sa.Column("quantity_meters", sa.Numeric(14, 3), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_print_records_machine_id", "print_records", ["machine_id"])
    op.create_index("ix_print_records_production_date", "print_records", ["production_date"])
    op.create_index("ix_print_records_order_number", "print_records", ["order_number"])
    op.create_index("ix_print_records_machine_date", "print_records", ["machine_id", "production_date"])


def downgrade() -> None:
    op.drop_index("ix_print_records_machine_date", table_name="print_records")
    op.drop_index("ix_print_records_order_number", table_name="print_records")
    op.drop_index("ix_print_records_production_date", table_name="print_records")
    op.drop_index("ix_print_records_machine_id", table_name="print_records")
    op.drop_table("print_records")
