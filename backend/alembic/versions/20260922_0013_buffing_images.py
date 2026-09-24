"""Add image attachments to Buffing checks.

Revision ID: 20260922_0013
Revises: 20260922_0012
"""

from alembic import op
import sqlalchemy as sa


revision = "20260922_0013"
down_revision = "20260922_0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The initial migration registers the current model metadata and may have
    # already created this table on a fresh database. Keep this revision safe
    # for both fresh and existing databases.
    if sa.inspect(op.get_bind()).has_table("buffing_check_images"):
        return

    op.create_table(
        "buffing_check_images",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("buffing_check_id", sa.Integer(), sa.ForeignKey("buffing_checks.id", ondelete="CASCADE"), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index("ix_buffing_check_images_check_id", "buffing_check_images", ["buffing_check_id"])


def downgrade() -> None:
    op.drop_index("ix_buffing_check_images_check_id", table_name="buffing_check_images")
    op.drop_table("buffing_check_images")
