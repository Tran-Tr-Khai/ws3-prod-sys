"""Add Buffing daily checklist history.

Revision ID: 20260921_0006
Revises: 20260921_0005
"""

from alembic import op
import sqlalchemy as sa

revision = "20260921_0006"
down_revision = "20260921_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # The initial migration registers the current SQLAlchemy metadata.  Fresh
    # deployments can therefore already contain this table before this
    # historical migration is applied.  Keep the migration safe for both
    # existing installations and a newly provisioned database.
    if sa.inspect(op.get_bind()).has_table("buffing_checks"):
        return

    op.create_table(
        "buffing_checks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("check_date", sa.Date(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("operator_name", sa.String(length=160), nullable=True),
        sa.Column("check_1", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("check_2", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("check_3", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("check_4", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("check_5", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("remark", sa.String(length=500), nullable=True),
    )
    op.create_index("ix_buffing_checks_check_date", "buffing_checks", ["check_date"])
    op.create_index("ix_buffing_checks_machine_id", "buffing_checks", ["machine_id"])
    op.create_index("ix_buffing_checks_machine_date", "buffing_checks", ["machine_id", "check_date"])


def downgrade() -> None:
    op.drop_index("ix_buffing_checks_machine_date", table_name="buffing_checks")
    op.drop_index("ix_buffing_checks_machine_id", table_name="buffing_checks")
    op.drop_index("ix_buffing_checks_check_date", table_name="buffing_checks")
    op.drop_table("buffing_checks")
