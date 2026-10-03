"""Allow repeatable, auditable Unrolling corrections."""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_0028"
down_revision: str | None = "20261003_0027"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("uq_ws3_unrolling_roll_event", "ws3_unrolling_roll_events", type_="unique")
    op.drop_constraint("ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events", type_="check")
    op.create_check_constraint(
        "ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events",
        "event_type IN ('COLLECTED', 'COLLECTION_UNDONE', 'TRANSFERRED_TO_PRODUCTION', 'TRANSFER_UNDONE')",
    )
    op.create_index("ix_ws3_unrolling_event_roll_id", "ws3_unrolling_roll_events", ["roll_id"])


def downgrade() -> None:
    connection = op.get_bind()
    reversal_count = connection.execute(sa.text(
        "SELECT count(*) FROM ws3_unrolling_roll_events "
        "WHERE event_type IN ('COLLECTION_UNDONE', 'TRANSFER_UNDONE')"
    )).scalar_one()
    if reversal_count:
        raise RuntimeError("Cannot downgrade while Unrolling reversal history exists; preserve the audit trail.")
    op.drop_index("ix_ws3_unrolling_event_roll_id", table_name="ws3_unrolling_roll_events")
    op.drop_constraint("ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events", type_="check")
    op.create_check_constraint(
        "ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events",
        "event_type IN ('COLLECTED', 'TRANSFERRED_TO_PRODUCTION')",
    )
    op.create_unique_constraint(
        "uq_ws3_unrolling_roll_event", "ws3_unrolling_roll_events", ["pk_no", "roll_id", "event_type"]
    )
