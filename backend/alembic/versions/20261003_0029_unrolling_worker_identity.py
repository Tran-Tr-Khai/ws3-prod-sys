"""Store the worker-entered identity and shift on Unrolling events."""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
)

revision: str = "20261003_0029"
down_revision: str | None = "20261003_0028"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    add_column_if_missing("ws3_unrolling_roll_events", sa.Column("worker_name", sa.String(length=160), nullable=True))
    add_column_if_missing("ws3_unrolling_roll_events", sa.Column("worker_id", sa.String(length=80), nullable=True))
    add_column_if_missing("ws3_unrolling_roll_events", sa.Column("worker_shift", sa.String(length=80), nullable=True))


def downgrade() -> None:
    op.drop_column("ws3_unrolling_roll_events", "worker_shift")
    op.drop_column("ws3_unrolling_roll_events", "worker_id")
    op.drop_column("ws3_unrolling_roll_events", "worker_name")
