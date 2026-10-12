"""Store the matched weaving roll reference on Tentering entries."""

import sqlalchemy as sa
from alembic import op


revision = "20261007_0039"
down_revision = "20261007_0038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tentering_roll_entries", sa.Column("roll_id", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("tentering_roll_entries", "roll_id")
