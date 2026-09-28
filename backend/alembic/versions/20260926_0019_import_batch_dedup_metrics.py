"""Store import audit counts while excluding duplicate source rows."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20260926_0019"
down_revision: str | None = "20260926_0018"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("ws3_import_batches")}
    for name in ("source_row_count", "duplicate_count", "incomplete_key_count"):
        if name not in columns:
            op.add_column("ws3_import_batches", sa.Column(name, sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("ws3_import_batches", "incomplete_key_count")
    op.drop_column("ws3_import_batches", "duplicate_count")
    op.drop_column("ws3_import_batches", "source_row_count")
