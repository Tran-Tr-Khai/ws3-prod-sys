"""Persist current order progress independently of individual machine records."""

import sqlalchemy as sa
from alembic import op


revision = "20261005_0033"
down_revision = "20261005_0032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "machine_order_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("order_number", sa.String(length=160), nullable=False),
        sa.Column("order_progress", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("machine_id", "order_number", name="uq_machine_order_states_machine_order"),
    )
    op.create_index("ix_machine_order_states_machine_id", "machine_order_states", ["machine_id"])


def downgrade() -> None:
    op.drop_index("ix_machine_order_states_machine_id", table_name="machine_order_states")
    op.drop_table("machine_order_states")
