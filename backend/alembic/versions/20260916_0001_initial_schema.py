"""Initial schema frozen from repository revision 7bed5e8.

Do not import application models here: later model changes must have their own
migration. Retain existing tables bootstrapped by the old initial revision.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260916_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    if not sa.inspect(op.get_bind()).has_table("machines"):
        op.create_table(
            "machines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("machine_type", sa.String(length=80), nullable=False),
            sa.Column("location", sa.String(length=120), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_machines_code"), "machines", ["code"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("parameter_definitions"):
        op.create_table(
            "parameter_definitions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("unit", sa.String(length=40), nullable=True),
            sa.Column("data_type", sa.String(length=30), nullable=False),
            sa.Column("category", sa.String(length=80), nullable=True),
            sa.Column("min_value", sa.Float(), nullable=True),
            sa.Column("max_value", sa.Float(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_parameter_definitions_code"), "parameter_definitions", ["code"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("processes"):
        op.create_table(
            "processes",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=160), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_processes_code"), "processes", ["code"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("roles"):
        op.create_table(
            "roles",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("code", sa.String(length=50), nullable=False),
            sa.Column("name", sa.String(length=120), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_roles_code"), "roles", ["code"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("users"):
        op.create_table(
            "users",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("username", sa.String(length=80), nullable=False),
            sa.Column("full_name", sa.String(length=160), nullable=False),
            sa.Column("email", sa.String(length=255), nullable=True),
            sa.Column("password_hash", sa.String(length=255), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("email")
        )
        op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("audit_logs"):
        op.create_table(
            "audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("entity_type", sa.String(length=80), nullable=False),
            sa.Column("entity_id", sa.String(length=80), nullable=True),
            sa.Column("before_data", sa.JSON(), nullable=True),
            sa.Column("after_data", sa.JSON(), nullable=True),
            sa.Column("ip_address", sa.String(length=45), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default="now()", nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index("ix_audit_logs_entity", "audit_logs", ["entity_type", "entity_id"], unique=False)
    if not sa.inspect(op.get_bind()).has_table("batches"):
        op.create_table(
            "batches",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("batch_no", sa.String(length=80), nullable=False),
            sa.Column("process_id", sa.Integer(), nullable=True),
            sa.Column("machine_id", sa.Integer(), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("planned_quantity", sa.Numeric(precision=14, scale=3), nullable=True),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["machine_id"], ["machines.id"]),
            sa.ForeignKeyConstraint(["process_id"], ["processes.id"]),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_batches_batch_no"), "batches", ["batch_no"], unique=True)
    if not sa.inspect(op.get_bind()).has_table("machine_parameters"):
        op.create_table(
            "machine_parameters",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("machine_id", sa.Integer(), nullable=False),
            sa.Column("parameter_definition_id", sa.Integer(), nullable=False),
            sa.Column("default_value", sa.Float(), nullable=True),
            sa.Column("min_value", sa.Float(), nullable=True),
            sa.Column("max_value", sa.Float(), nullable=True),
            sa.Column("is_enabled", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["parameter_definition_id"], ["parameter_definitions.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("machine_id", "parameter_definition_id")
        )
    if not sa.inspect(op.get_bind()).has_table("user_roles"):
        op.create_table(
            "user_roles",
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("role_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("user_id", "role_id")
        )
    if not sa.inspect(op.get_bind()).has_table("alarms"):
        op.create_table(
            "alarms",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("machine_id", sa.Integer(), nullable=False),
            sa.Column("batch_id", sa.Integer(), nullable=True),
            sa.Column("code", sa.String(length=80), nullable=False),
            sa.Column("severity", sa.String(length=20), nullable=False),
            sa.Column("message", sa.Text(), nullable=False),
            sa.Column("status", sa.String(length=20), nullable=False),
            sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("acknowledged_by_id", sa.Integer(), nullable=True),
            sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["acknowledged_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["machine_id"], ["machines.id"]),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_alarms_code"), "alarms", ["code"], unique=False)
        op.create_index(op.f("ix_alarms_occurred_at"), "alarms", ["occurred_at"], unique=False)
    if not sa.inspect(op.get_bind()).has_table("operator_logs"):
        op.create_table(
            "operator_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("operator_id", sa.Integer(), nullable=False),
            sa.Column("machine_id", sa.Integer(), nullable=True),
            sa.Column("batch_id", sa.Integer(), nullable=True),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("message", sa.Text(), nullable=True),
            sa.Column("logged_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["machine_id"], ["machines.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["operator_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_operator_logs_logged_at"), "operator_logs", ["logged_at"], unique=False)
    if not sa.inspect(op.get_bind()).has_table("parameter_values"):
        op.create_table(
            "parameter_values",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("machine_parameter_id", sa.Integer(), nullable=False),
            sa.Column("batch_id", sa.Integer(), nullable=True),
            sa.Column("value_numeric", sa.Float(), nullable=True),
            sa.Column("value_text", sa.Text(), nullable=True),
            sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("source", sa.String(length=30), nullable=False),
            sa.Column("recorded_by_id", sa.Integer(), nullable=True),
            sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["machine_parameter_id"], ["machine_parameters.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["recorded_by_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id")
        )
        op.create_index(op.f("ix_parameter_values_captured_at"), "parameter_values", ["captured_at"], unique=False)
    if not sa.inspect(op.get_bind()).has_table("production_records"):
        op.create_table(
            "production_records",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("machine_id", sa.Integer(), nullable=False),
            sa.Column("process_id", sa.Integer(), nullable=True),
            sa.Column("batch_id", sa.Integer(), nullable=True),
            sa.Column("operator_id", sa.Integer(), nullable=True),
            sa.Column("record_type", sa.String(length=50), nullable=False),
            sa.Column("quantity", sa.Numeric(precision=14, scale=3), nullable=True),
            sa.Column("unit", sa.String(length=30), nullable=True),
            sa.Column("status", sa.String(length=30), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["batch_id"], ["batches.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["machine_id"], ["machines.id"]),
            sa.ForeignKeyConstraint(["operator_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["process_id"], ["processes.id"]),
            sa.PrimaryKeyConstraint("id")
        )


def downgrade() -> None:
    op.drop_table("production_records")
    op.drop_index(op.f("ix_parameter_values_captured_at"), table_name="parameter_values")
    op.drop_table("parameter_values")
    op.drop_index(op.f("ix_operator_logs_logged_at"), table_name="operator_logs")
    op.drop_table("operator_logs")
    op.drop_index(op.f("ix_alarms_occurred_at"), table_name="alarms")
    op.drop_index(op.f("ix_alarms_code"), table_name="alarms")
    op.drop_table("alarms")
    op.drop_table("user_roles")
    op.drop_table("machine_parameters")
    op.drop_index(op.f("ix_batches_batch_no"), table_name="batches")
    op.drop_table("batches")
    op.drop_index("ix_audit_logs_entity", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index(op.f("ix_users_username"), table_name="users")
    op.drop_table("users")
    op.drop_index(op.f("ix_roles_code"), table_name="roles")
    op.drop_table("roles")
    op.drop_index(op.f("ix_processes_code"), table_name="processes")
    op.drop_table("processes")
    op.drop_index(op.f("ix_parameter_definitions_code"), table_name="parameter_definitions")
    op.drop_table("parameter_definitions")
    op.drop_index(op.f("ix_machines_code"), table_name="machines")
    op.drop_table("machines")
