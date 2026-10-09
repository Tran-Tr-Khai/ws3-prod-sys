"""Allow Tentering orders to contain more than nine rolls."""

import sqlalchemy as sa
from alembic import op


revision = "20261008_0041"
down_revision = "20261007_0039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("tentering_roll_entries") as batch_op:
        batch_op.drop_constraint("ck_tentering_roll_number_1_9", type_="check")
        batch_op.create_check_constraint("ck_tentering_roll_number_positive", "roll_number >= 1")


def downgrade() -> None:
    bind = op.get_bind()
    has_high_roll_numbers = bind.execute(
        sa.text("SELECT 1 FROM tentering_roll_entries WHERE roll_number > 9 LIMIT 1")
    ).first()
    if has_high_roll_numbers:
        raise RuntimeError("Cannot restore the nine-roll limit while Tentering entries above roll 9 exist")
    with op.batch_alter_table("tentering_roll_entries") as batch_op:
        batch_op.drop_constraint("ck_tentering_roll_number_positive", type_="check")
        batch_op.create_check_constraint("ck_tentering_roll_number_1_9", "roll_number BETWEEN 1 AND 9")
