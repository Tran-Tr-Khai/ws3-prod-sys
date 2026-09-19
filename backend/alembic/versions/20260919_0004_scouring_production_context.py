"""Add production quantity and daily report context to Scouring records.

Revision ID: 20260919_0004
Revises: 20260918_0002
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260919_0004"
down_revision: str | None = "20260918_0002"
branch_labels: Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("scouring_records")}
    if "order_number" not in columns:
        op.add_column("scouring_records", sa.Column("order_number", sa.String(length=80), nullable=True))
    if "item" not in columns:
        op.add_column("scouring_records", sa.Column("item", sa.String(length=120), nullable=True))
    if "lot_yarn" not in columns:
        op.add_column("scouring_records", sa.Column("lot_yarn", sa.String(length=80), nullable=True))
    if "lot_number" not in columns:
        op.add_column("scouring_records", sa.Column("lot_number", sa.String(length=80), nullable=True))
    if "production_quantity_meters" not in columns:
        op.add_column("scouring_records", sa.Column("production_quantity_meters", sa.Numeric(14, 3), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    columns = {column["name"] for column in sa.inspect(bind).get_columns("scouring_records")}
    for name in ("production_quantity_meters", "lot_number", "lot_yarn", "item", "order_number"):
        if name in columns:
            op.drop_column("scouring_records", name)
