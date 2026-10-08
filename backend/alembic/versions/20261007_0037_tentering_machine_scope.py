"""Scope Tentering records and access by machine."""

import sqlalchemy as sa
from alembic import op


revision = "20261007_0037"
down_revision = "20261007_0036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "tentering_orders",
        sa.Column("machine_id", sa.String(length=20), nullable=False, server_default="TE-01"),
    )
    op.add_column("tentering_orders", sa.Column("operator_name", sa.String(length=160), nullable=True))
    op.add_column("tentering_orders", sa.Column("operator_identifier", sa.String(length=80), nullable=True))
    op.add_column("tentering_orders", sa.Column("shift", sa.String(length=40), nullable=True))
    op.drop_index("ix_tentering_orders_sop_no", table_name="tentering_orders")
    op.create_index("ix_tentering_orders_sop_no", "tentering_orders", ["sop_no"], unique=False)
    op.create_unique_constraint(
        "uq_tentering_machine_sop", "tentering_orders", ["machine_id", "sop_no"]
    )
    op.alter_column("tentering_orders", "machine_id", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_tentering_machine_sop", "tentering_orders", type_="unique")
    op.drop_index("ix_tentering_orders_sop_no", table_name="tentering_orders")
    op.create_index("ix_tentering_orders_sop_no", "tentering_orders", ["sop_no"], unique=True)
    op.drop_column("tentering_orders", "shift")
    op.drop_column("tentering_orders", "operator_identifier")
    op.drop_column("tentering_orders", "operator_name")
    op.drop_column("tentering_orders", "machine_id")
