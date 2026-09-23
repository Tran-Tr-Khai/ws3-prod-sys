"""Add internal support chat tables.

Revision ID: 20260921_0009
Revises: 20260921_0008
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260921_0009"
down_revision: str | None = "20260921_0008"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if not inspector.has_table("support_tickets"):
        op.create_table(
            "support_tickets",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("machine_id", sa.String(length=50), nullable=False),
            sa.Column("created_by", sa.String(length=80), nullable=False),
            sa.Column("creator_role", sa.String(length=30), nullable=False),
            sa.Column("subject", sa.String(length=160), nullable=False),
            sa.Column("priority", sa.String(length=20), nullable=False, server_default="NORMAL"),
            sa.Column("status", sa.String(length=20), nullable=False, server_default="NEW"),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_support_tickets_machine_id", "support_tickets", ["machine_id"])
        op.create_index("ix_support_tickets_created_by", "support_tickets", ["created_by"])
        op.create_index("ix_support_tickets_status", "support_tickets", ["status"])
    if not inspector.has_table("support_messages"):
        op.create_table(
            "support_messages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("ticket_id", sa.Integer(), sa.ForeignKey("support_tickets.id", ondelete="CASCADE"), nullable=False),
            sa.Column("sender", sa.String(length=80), nullable=False),
            sa.Column("sender_role", sa.String(length=30), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("sent_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_support_messages_ticket_id", "support_messages", ["ticket_id"])
        op.create_index("ix_support_messages_sender", "support_messages", ["sender"])


def downgrade() -> None:
    op.drop_table("support_messages")
    op.drop_table("support_tickets")
