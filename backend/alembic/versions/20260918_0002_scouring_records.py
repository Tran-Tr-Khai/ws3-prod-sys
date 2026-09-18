"""Add server-side Scouring record snapshots.

Revision ID: 20260918_0002
Revises: 20260916_0001
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260918_0002"
down_revision: str | None = "20260916_0001"
branch_labels: Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("scouring_records"):
        # The initial migration uses Base.metadata.create_all(), which can
        # already create this table on a fresh database after the model is
        # registered. Keep this revision safe for both fresh and existing DBs.
        return

    op.create_table(
        "scouring_records",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("batch_identifier", sa.String(length=80), nullable=True),
        sa.Column("operator_name", sa.String(length=160), nullable=True),
        sa.Column("operator_identifier", sa.String(length=80), nullable=True),
        sa.Column("naoh", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("soap", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("desizer", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("h2o2", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("chelate", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("speed", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("temperature", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("cylinder_temperature", sa.Numeric(precision=14, scale=3), nullable=False),
        sa.Column("input_fabric_meters", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("output_fabric_meters", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_scouring_records_machine_id", "scouring_records", ["machine_id"])
    op.create_index("ix_scouring_records_recorded_at", "scouring_records", ["recorded_at"])
    op.create_index(
        "ix_scouring_records_machine_id_recorded_at",
        "scouring_records",
        ["machine_id", "recorded_at"],
    )


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("scouring_records"):
        return
    op.drop_index("ix_scouring_records_machine_id_recorded_at", table_name="scouring_records")
    op.drop_index("ix_scouring_records_recorded_at", table_name="scouring_records")
    op.drop_index("ix_scouring_records_machine_id", table_name="scouring_records")
    op.drop_table("scouring_records")
