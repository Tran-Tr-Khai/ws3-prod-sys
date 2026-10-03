"""Persist Unrolling collection and production handoff events."""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_0027"
down_revision: str | None = "20261002_0026"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ws3_unrolling_roll_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("pk_no", sa.String(length=160), nullable=False),
        sa.Column("roll_id", sa.String(length=160), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_label", sa.String(length=160), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint(
            "event_type IN ('COLLECTED', 'COLLECTION_UNDONE', 'TRANSFERRED_TO_PRODUCTION', 'TRANSFER_UNDONE')",
            name="ck_ws3_unrolling_event_type",
        ),
    )
    op.create_index("ix_ws3_unrolling_roll_events_pk_no", "ws3_unrolling_roll_events", ["pk_no"])


def downgrade() -> None:
    op.drop_index("ix_ws3_unrolling_roll_events_pk_no", table_name="ws3_unrolling_roll_events")
    op.drop_table("ws3_unrolling_roll_events")
