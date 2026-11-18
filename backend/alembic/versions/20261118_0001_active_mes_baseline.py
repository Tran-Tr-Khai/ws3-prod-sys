"""Create the active WS3 MES schema from a clean baseline.

This revision intentionally starts a new migration history for fresh
installations. It contains only the production features maintained on `main`:
authentication, support, MES snapshots/orders, Unrolling, Buffing and
Tentering. Historical machine schemas live on the archive branch instead.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = "20261118_0001"
down_revision: str | None = None
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def upgrade() -> None:
    """Create all tables and indexes required by the active MES application."""
    op.create_table(
        "roles",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("code", sa.String(length=50), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_roles_code"), "roles", ["code"], unique=True)

    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=80), nullable=False),
        sa.Column("full_name", sa.String(length=160), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("machine_ids", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )
    op.create_index(op.f("ix_users_username"), "users", ["username"], unique=True)

    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "role_id"),
    )
    op.create_table(
        "user_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_user_sessions_expires_at"), "user_sessions", ["expires_at"], unique=False)
    op.create_index(op.f("ix_user_sessions_token_hash"), "user_sessions", ["token_hash"], unique=True)
    op.create_index(op.f("ix_user_sessions_user_id"), "user_sessions", ["user_id"], unique=False)

    op.create_table(
        "support_tickets",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("created_by", sa.String(length=80), nullable=False),
        sa.Column("creator_role", sa.String(length=30), nullable=False),
        sa.Column("recipient_role", sa.String(length=20), nullable=False),
        sa.Column("recipient_group", sa.String(length=50), nullable=True),
        sa.Column("subject", sa.String(length=160), nullable=False),
        sa.Column("priority", sa.String(length=20), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_tickets_created_by"), "support_tickets", ["created_by"], unique=False)
    op.create_index(op.f("ix_support_tickets_machine_id"), "support_tickets", ["machine_id"], unique=False)
    op.create_index(op.f("ix_support_tickets_recipient_group"), "support_tickets", ["recipient_group"], unique=False)
    op.create_index(op.f("ix_support_tickets_recipient_role"), "support_tickets", ["recipient_role"], unique=False)
    op.create_index(op.f("ix_support_tickets_status"), "support_tickets", ["status"], unique=False)
    op.create_table(
        "support_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("sender", sa.String(length=80), nullable=False),
        sa.Column("sender_role", sa.String(length=30), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("sent_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_support_messages_sender"), "support_messages", ["sender"], unique=False)
    op.create_index(op.f("ix_support_messages_ticket_id"), "support_messages", ["ticket_id"], unique=False)
    op.create_table(
        "support_ticket_reads",
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("ticket_id", sa.Integer(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ticket_id"], ["support_tickets.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id", "ticket_id"),
    )

    op.create_table(
        "ws3_production_plans",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("plan_date", sa.String(length=40), nullable=True),
        sa.Column("sop_no", sa.String(length=120), nullable=True),
        sa.Column("machine_no", sa.String(length=120), nullable=True),
        sa.Column("roll_required", sa.String(length=40), nullable=True),
        sa.Column("item_code", sa.String(length=160), nullable=True),
        sa.Column("item_name", sa.String(length=500), nullable=True),
        sa.Column("po_no", sa.String(length=160), nullable=True),
        sa.Column("source_order_no", sa.String(length=160), nullable=True),
        sa.Column("dyeing_request_sop", sa.String(length=160), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, column in (
        ("ix_ws3_production_plans_dyeing_request_sop", "dyeing_request_sop"),
        ("ix_ws3_production_plans_item_code", "item_code"),
        ("ix_ws3_production_plans_machine_no", "machine_no"),
        ("ix_ws3_production_plans_plan_date", "plan_date"),
        ("ix_ws3_production_plans_po_no", "po_no"),
        ("ix_ws3_production_plans_sop_no", "sop_no"),
        ("ix_ws3_production_plans_source_order_no", "source_order_no"),
    ):
        op.create_index(name, "ws3_production_plans", [column], unique=False)

    op.create_table(
        "ws3_production_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("production_date", sa.String(length=40), nullable=True),
        sa.Column("pk_no", sa.String(length=160), nullable=True),
        sa.Column("out_no", sa.String(length=160), nullable=True),
        sa.Column("po_no", sa.String(length=160), nullable=True),
        sa.Column("source_order_no", sa.String(length=160), nullable=True),
        sa.Column("item_code", sa.String(length=160), nullable=True),
        sa.Column("item_name", sa.String(length=500), nullable=True),
        sa.Column("lot_no", sa.String(length=160), nullable=True),
        sa.Column("invoice_no", sa.String(length=160), nullable=True),
        sa.Column("quantity", sa.String(length=80), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, column in (
        ("ix_ws3_production_orders_invoice_no", "invoice_no"),
        ("ix_ws3_production_orders_item_code", "item_code"),
        ("ix_ws3_production_orders_lot_no", "lot_no"),
        ("ix_ws3_production_orders_out_no", "out_no"),
        ("ix_ws3_production_orders_pk_no", "pk_no"),
        ("ix_ws3_production_orders_po_no", "po_no"),
        ("ix_ws3_production_orders_production_date", "production_date"),
        ("ix_ws3_production_orders_source_order_no", "source_order_no"),
    ):
        op.create_index(name, "ws3_production_orders", [column], unique=False)

    op.create_table(
        "ws3_machine_ws2_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("out_dyeing_sop", sa.String(length=160), nullable=True),
        sa.Column("weaving_date", sa.String(length=40), nullable=True),
        sa.Column("roll_id", sa.String(length=160), nullable=True),
        sa.Column("machine_no", sa.String(length=120), nullable=True),
        sa.Column("sop_no", sa.String(length=120), nullable=True),
        sa.Column("po_no", sa.String(length=160), nullable=True),
        sa.Column("source_order_no", sa.String(length=160), nullable=True),
        sa.Column("item_code", sa.String(length=160), nullable=True),
        sa.Column("item_name", sa.String(length=500), nullable=True),
        sa.Column("lot_no", sa.String(length=160), nullable=True),
        sa.Column("length_meters", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, column in (
        ("ix_ws3_machine_ws2_records_item_code", "item_code"),
        ("ix_ws3_machine_ws2_records_machine_no", "machine_no"),
        ("ix_ws3_machine_ws2_records_out_dyeing_sop", "out_dyeing_sop"),
        ("ix_ws3_machine_ws2_records_po_no", "po_no"),
        ("ix_ws3_machine_ws2_records_roll_id", "roll_id"),
        ("ix_ws3_machine_ws2_records_sop_no", "sop_no"),
        ("ix_ws3_machine_ws2_records_source_order_no", "source_order_no"),
        ("ix_ws3_machine_ws2_records_weaving_date", "weaving_date"),
    ):
        op.create_index(name, "ws3_machine_ws2_records", [column], unique=False)

    op.create_table(
        "ws3_worker_records",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("weaving_date", sa.String(length=40), nullable=True),
        sa.Column("shift", sa.String(length=80), nullable=True),
        sa.Column("worker", sa.String(length=160), nullable=True),
        sa.Column("customer", sa.String(length=160), nullable=True),
        sa.Column("po_no", sa.String(length=160), nullable=True),
        sa.Column("source_order_no", sa.String(length=160), nullable=True),
        sa.Column("item_code", sa.String(length=160), nullable=True),
        sa.Column("item_name", sa.String(length=500), nullable=True),
        sa.Column("sop_no", sa.String(length=120), nullable=True),
        sa.Column("lot_no", sa.String(length=160), nullable=True),
        sa.Column("machine_no", sa.String(length=120), nullable=True),
        sa.Column("quantity", sa.String(length=80), nullable=True),
        sa.Column("length_meters", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    for name, column in (
        ("ix_ws3_worker_records_item_code", "item_code"),
        ("ix_ws3_worker_records_lot_no", "lot_no"),
        ("ix_ws3_worker_records_machine_no", "machine_no"),
        ("ix_ws3_worker_records_po_no", "po_no"),
        ("ix_ws3_worker_records_sop_no", "sop_no"),
        ("ix_ws3_worker_records_source_order_no", "source_order_no"),
        ("ix_ws3_worker_records_weaving_date", "weaving_date"),
    ):
        op.create_index(name, "ws3_worker_records", [column], unique=False)

    op.create_table(
        "ws3_import_batches",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("source_format", sa.String(length=30), nullable=False),
        sa.Column("source_columns_json", sa.Text(), nullable=False),
        sa.Column("selected_mapping_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("source_row_count", sa.Integer(), nullable=True),
        sa.Column("duplicate_count", sa.Integer(), nullable=True),
        sa.Column("incomplete_key_count", sa.Integer(), nullable=True),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ws3_import_batches_status"), "ws3_import_batches", ["status"], unique=False)
    op.create_table(
        "ws3_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_no", sa.String(length=80), nullable=False),
        sa.Column("source_filename", sa.String(length=255), nullable=True),
        sa.Column("source_format", sa.String(length=30), nullable=False),
        sa.Column("source_columns_json", sa.Text(), nullable=False),
        sa.Column("selected_mapping_json", sa.Text(), nullable=False),
        sa.Column("source_rows_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_by_id", sa.Integer(), nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ws3_orders_order_no"), "ws3_orders", ["order_no"], unique=True)
    op.create_index(op.f("ix_ws3_orders_status"), "ws3_orders", ["status"], unique=False)
    op.create_table(
        "ws3_import_rows",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("batch_id", sa.Integer(), nullable=False),
        sa.Column("source_row_index", sa.Integer(), nullable=False),
        sa.Column("source_key", sa.String(length=500), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["batch_id"], ["ws3_import_batches.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["order_id"], ["ws3_orders.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ws3_import_rows_batch_id"), "ws3_import_rows", ["batch_id"], unique=False)
    op.create_index(op.f("ix_ws3_import_rows_order_id"), "ws3_import_rows", ["order_id"], unique=False)
    op.create_index(op.f("ix_ws3_import_rows_source_key"), "ws3_import_rows", ["source_key"], unique=False)
    op.create_index(op.f("ix_ws3_import_rows_status"), "ws3_import_rows", ["status"], unique=False)
    op.create_table(
        "ws3_order_rolls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("source_row_index", sa.Integer(), nullable=False),
        sa.Column("source_key", sa.String(length=500), nullable=True),
        sa.Column("raw_data_json", sa.Text(), nullable=False),
        sa.Column("roll_id", sa.String(length=160), nullable=True),
        sa.Column("item_code", sa.String(length=160), nullable=True),
        sa.Column("item_name", sa.String(length=500), nullable=True),
        sa.Column("lot_no", sa.String(length=160), nullable=True),
        sa.Column("machine_no", sa.String(length=160), nullable=True),
        sa.Column("length_meters", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("shift", sa.String(length=80), nullable=True),
        sa.Column("worker", sa.String(length=160), nullable=True),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["order_id"], ["ws3_orders.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ws3_order_rolls_order_id"), "ws3_order_rolls", ["order_id"], unique=False)
    op.create_index(op.f("ix_ws3_order_rolls_roll_id"), "ws3_order_rolls", ["roll_id"], unique=False)
    op.create_index(op.f("ix_ws3_order_rolls_status"), "ws3_order_rolls", ["status"], unique=False)
    op.create_index("uq_ws3_order_rolls_source_key", "ws3_order_rolls", ["source_key"], unique=True, postgresql_where=sa.text("source_key IS NOT NULL"))

    op.create_table(
        "ws3_unrolling_roll_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pk_no", sa.String(length=160), nullable=False),
        sa.Column("roll_id", sa.String(length=160), nullable=False),
        sa.Column("event_type", sa.String(length=40), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("actor_user_id", sa.Integer(), nullable=True),
        sa.Column("actor_label", sa.String(length=160), nullable=False),
        sa.Column("worker_name", sa.String(length=160), nullable=True),
        sa.Column("worker_id", sa.String(length=80), nullable=True),
        sa.Column("worker_shift", sa.String(length=80), nullable=True),
        sa.CheckConstraint("event_type IN ('COLLECTED', 'COLLECTION_UNDONE', 'TRANSFERRED_TO_PRODUCTION', 'TRANSFER_UNDONE')", name="ck_ws3_unrolling_event_type"),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ws3_unrolling_event_roll_id", "ws3_unrolling_roll_events", ["roll_id"], unique=False)
    op.create_index(op.f("ix_ws3_unrolling_roll_events_pk_no"), "ws3_unrolling_roll_events", ["pk_no"], unique=False)

    op.create_table(
        "buffing_checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("check_date", sa.Date(), nullable=False),
        sa.Column("checked_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("operator_name", sa.String(length=160), nullable=True),
        sa.Column("operator_identifier", sa.String(length=80), nullable=True),
        sa.Column("shift", sa.String(length=80), nullable=True),
        sa.Column("order_number", sa.String(length=160), nullable=True),
        sa.Column("order_progress", sa.String(length=20), nullable=True),
        sa.Column("check_1", sa.Boolean(), nullable=False),
        sa.Column("check_2", sa.Boolean(), nullable=False),
        sa.Column("check_3", sa.Boolean(), nullable=False),
        sa.Column("check_4", sa.Boolean(), nullable=False),
        sa.Column("check_5", sa.Boolean(), nullable=False),
        sa.Column("remark", sa.String(length=500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buffing_checks_check_date", "buffing_checks", ["check_date"], unique=False)
    op.create_index("ix_buffing_checks_machine_date", "buffing_checks", ["machine_id", "check_date"], unique=False)
    op.create_index(op.f("ix_buffing_checks_machine_id"), "buffing_checks", ["machine_id"], unique=False)
    op.create_index(op.f("ix_buffing_checks_order_number"), "buffing_checks", ["order_number"], unique=False)
    op.create_table(
        "buffing_check_images",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("buffing_check_id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.Column("original_name", sa.String(length=255), nullable=False),
        sa.Column("mime_type", sa.String(length=100), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("is_primary", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["buffing_check_id"], ["buffing_checks.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_buffing_check_images_check_id", "buffing_check_images", ["buffing_check_id"], unique=False)

    op.create_table(
        "machine_order_states",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.String(length=50), nullable=False),
        sa.Column("order_number", sa.String(length=160), nullable=False),
        sa.Column("order_progress", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("machine_id", "order_number", name="uq_machine_order_states_machine_order"),
    )
    op.create_index(op.f("ix_machine_order_states_machine_id"), "machine_order_states", ["machine_id"], unique=False)

    op.create_table(
        "tentering_orders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("machine_id", sa.String(length=20), nullable=False),
        sa.Column("sop_no", sa.String(length=160), nullable=False),
        sa.Column("order_progress", sa.String(length=20), nullable=False),
        sa.Column("operator_name", sa.String(length=160), nullable=True),
        sa.Column("operator_identifier", sa.String(length=80), nullable=True),
        sa.Column("shift", sa.String(length=40), nullable=True),
        sa.Column("customer", sa.String(length=160), nullable=True),
        sa.Column("item_description", sa.String(length=300), nullable=True),
        sa.Column("warp_yarn", sa.String(length=160), nullable=True),
        sa.Column("weft_yarn", sa.String(length=160), nullable=True),
        sa.Column("greige_density_pick", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("finish_density_pick", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("shrink_percent", sa.Numeric(precision=8, scale=3), nullable=True),
        sa.Column("greige_width_inch", sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column("finish_width_inch", sa.Numeric(precision=10, scale=3), nullable=True),
        sa.Column("fabric_received_date", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("machine_id", "sop_no", name="uq_tentering_machine_sop"),
    )
    op.create_index(op.f("ix_tentering_orders_sop_no"), "tentering_orders", ["sop_no"], unique=False)
    op.create_table(
        "tentering_roll_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("order_id", sa.Integer(), nullable=False),
        sa.Column("roll_number", sa.SmallInteger(), nullable=False),
        sa.Column("roll_id", sa.String(length=160), nullable=True),
        sa.Column("tenter_date", sa.Date(), nullable=True),
        sa.Column("weaving_date", sa.Date(), nullable=True),
        sa.Column("planned_quantity", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("actual_quantity", sa.Numeric(precision=14, scale=3), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("recorded_by_id", sa.Integer(), nullable=True),
        sa.Column("recorded_by_name", sa.String(length=160), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("actual_quantity IS NULL OR actual_quantity >= 0", name="ck_tentering_actual_qty_nonnegative"),
        sa.CheckConstraint("planned_quantity IS NULL OR planned_quantity >= 0", name="ck_tentering_planned_qty_nonnegative"),
        sa.CheckConstraint("roll_number >= 1", name="ck_tentering_roll_number_positive"),
        sa.ForeignKeyConstraint(["order_id"], ["tentering_orders.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["recorded_by_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("order_id", "roll_number", name="uq_tentering_roll_order_number"),
    )
    op.create_index(op.f("ix_tentering_roll_entries_order_id"), "tentering_roll_entries", ["order_id"], unique=False)
    op.create_index(op.f("ix_tentering_roll_entries_recorded_by_id"), "tentering_roll_entries", ["recorded_by_id"], unique=False)


def downgrade() -> None:
    """Block destructive rollback of the clean baseline schema."""
    raise RuntimeError("The active MES baseline is irreversible. Restore a database backup to roll back.")
