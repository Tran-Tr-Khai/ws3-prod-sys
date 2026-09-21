"""Document operator requirement for new Buffing checks.

Revision ID: 20260921_0008
Revises: 20260921_0007
"""

from alembic import op
import sqlalchemy as sa

revision = "20260921_0008"
down_revision = "20260921_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Keep legacy rows with no operator; BuffingCheckCreate rejects missing values
    # for all new API writes without inventing historical operator names.
    pass


def downgrade() -> None:
    pass
