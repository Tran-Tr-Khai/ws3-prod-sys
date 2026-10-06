"""Allow repeatable, auditable Unrolling corrections."""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from migration_support import (
    create_index_if_missing,
)

revision: str = "20261003_0028"
down_revision: str | None = "20261003_0027"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    unique_names = {item["name"] for item in inspector.get_unique_constraints("ws3_unrolling_roll_events")}
    if "uq_ws3_unrolling_roll_event" in unique_names:
        op.drop_constraint("uq_ws3_unrolling_roll_event", "ws3_unrolling_roll_events", type_="unique")
    check_names = {item["name"] for item in inspector.get_check_constraints("ws3_unrolling_roll_events")}
    if "ck_ws3_unrolling_event_type" in check_names:
        op.drop_constraint("ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events", type_="check")
    op.create_check_constraint(
        "ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events",
        "event_type IN ('COLLECTED', 'COLLECTION_UNDONE', 'TRANSFERRED_TO_PRODUCTION', 'TRANSFER_UNDONE')",
    )
    create_index_if_missing("ix_ws3_unrolling_event_roll_id", "ws3_unrolling_roll_events", ["roll_id"])


def downgrade() -> None:
    connection = op.get_bind()
    reversal_count = connection.execute(sa.text(
        "SELECT count(*) FROM ws3_unrolling_roll_events "
        "WHERE event_type IN ('COLLECTION_UNDONE', 'TRANSFER_UNDONE')"
    )).scalar_one()
    if reversal_count:
        raise RuntimeError("Cannot downgrade while Unrolling reversal history exists; preserve the audit trail.")
    duplicate = connection.execute(sa.text(
        "SELECT 1 FROM ws3_unrolling_roll_events "
        "GROUP BY pk_no, roll_id, event_type HAVING count(*) > 1 LIMIT 1"
    )).first()
    if duplicate:
        raise RuntimeError("Cannot downgrade while repeated Unrolling events exist; preserve the audit trail.")
    op.drop_index("ix_ws3_unrolling_event_roll_id", table_name="ws3_unrolling_roll_events")
    op.drop_constraint("ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events", type_="check")
    op.create_check_constraint(
        "ck_ws3_unrolling_event_type", "ws3_unrolling_roll_events",
        "event_type IN ('COLLECTED', 'TRANSFERRED_TO_PRODUCTION')",
    )
    op.create_unique_constraint(
        "uq_ws3_unrolling_roll_event", "ws3_unrolling_roll_events", ["pk_no", "roll_id", "event_type"]
    )
