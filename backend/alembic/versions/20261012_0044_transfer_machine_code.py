"""Rename the Transfer machine code from HT-01 to TR-01."""

import sqlalchemy as sa
from alembic import op


revision = "20261012_0044"
down_revision = "20261010_0043"
branch_labels = None
depends_on = None


def _update_operator_machine_ids(old_code: str, new_code: str) -> None:
    bind = op.get_bind()
    users = sa.table(
        "users",
        sa.column("id", sa.Integer()),
        sa.column("machine_ids", sa.JSON()),
    )
    rows = bind.execute(sa.select(users.c.id, users.c.machine_ids)).all()
    for user_id, machine_ids in rows:
        if not isinstance(machine_ids, list) or old_code not in machine_ids:
            continue
        updated = list(dict.fromkeys(new_code if machine_id == old_code else machine_id for machine_id in machine_ids))
        bind.execute(sa.update(users).where(users.c.id == user_id).values(machine_ids=updated))


def upgrade() -> None:
    op.execute(sa.text("UPDATE machines SET code = 'TR-01' WHERE code = 'HT-01'"))
    for table_name in ("transfer_records", "machine_order_states", "support_tickets"):
        op.execute(sa.text(f"UPDATE {table_name} SET machine_id = 'TR-01' WHERE machine_id = 'HT-01'"))
    _update_operator_machine_ids("HT-01", "TR-01")


def downgrade() -> None:
    op.execute(sa.text("UPDATE machines SET code = 'HT-01' WHERE code = 'TR-01'"))
    for table_name in ("transfer_records", "machine_order_states", "support_tickets"):
        op.execute(sa.text(f"UPDATE {table_name} SET machine_id = 'HT-01' WHERE machine_id = 'TR-01'"))
    _update_operator_machine_ids("TR-01", "HT-01")
