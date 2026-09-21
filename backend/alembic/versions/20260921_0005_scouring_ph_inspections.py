"""Add Scouring pH inspections linked to operation records.

Revision ID: 20260921_0005
Revises: 20260919_0004
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0005"
down_revision: str | None = "20260919_0004"
branch_labels: Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    bind = op.get_bind()
    if sa.inspect(bind).has_table("scouring_ph_inspections"):
        return
    op.create_table(
        "scouring_ph_inspections",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scouring_record_id", sa.Integer(), sa.ForeignKey("scouring_records.id", ondelete="CASCADE"), nullable=False),
        sa.Column("inspected_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("operator_name", sa.String(length=160), nullable=True),
        *[sa.Column(f"tank_{index}_ph", sa.Numeric(14, 3), nullable=True) for index in range(8)],
        sa.Column("note", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_scouring_ph_inspections_scouring_record_id", "scouring_ph_inspections", ["scouring_record_id"])
    op.create_index("ix_scouring_ph_inspections_record_id_inspected_at", "scouring_ph_inspections", ["scouring_record_id", "inspected_at"])


def downgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("scouring_ph_inspections"):
        return
    op.drop_index("ix_scouring_ph_inspections_record_id_inspected_at", table_name="scouring_ph_inspections")
    op.drop_index("ix_scouring_ph_inspections_scouring_record_id", table_name="scouring_ph_inspections")
    op.drop_table("scouring_ph_inspections")
