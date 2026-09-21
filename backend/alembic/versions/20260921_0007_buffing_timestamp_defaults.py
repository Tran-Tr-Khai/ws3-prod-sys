"""Fix timestamp defaults for Buffing checks.

Revision ID: 20260921_0007
Revises: 20260921_0006
"""

from alembic import op
import sqlalchemy as sa

revision = "20260921_0007"
down_revision = "20260921_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("buffing_checks", "created_at", server_default=sa.text("now()"), existing_type=sa.DateTime(timezone=True), existing_nullable=False)
    op.alter_column("buffing_checks", "updated_at", server_default=sa.text("now()"), existing_type=sa.DateTime(timezone=True), existing_nullable=False)


def downgrade() -> None:
    op.alter_column("buffing_checks", "created_at", server_default=None, existing_type=sa.DateTime(timezone=True), existing_nullable=False)
    op.alter_column("buffing_checks", "updated_at", server_default=None, existing_type=sa.DateTime(timezone=True), existing_nullable=False)
