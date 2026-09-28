"""Store import audit counts while excluding duplicate source rows."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0019"
down_revision: str | None = "20260926_0018"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("ws3_import_batches", sa.Column("source_row_count", sa.Integer(), nullable=True))
    op.add_column("ws3_import_batches", sa.Column("duplicate_count", sa.Integer(), nullable=True))
    op.add_column("ws3_import_batches", sa.Column("incomplete_key_count", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ws3_import_batches", "incomplete_key_count")
    op.drop_column("ws3_import_batches", "duplicate_count")
    op.drop_column("ws3_import_batches", "source_row_count")
