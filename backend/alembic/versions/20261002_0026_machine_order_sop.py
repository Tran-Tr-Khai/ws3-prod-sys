"""Store MACHINE-ORDER's explicit dyeing invoice join key.

Existing machine snapshots must be refreshed: legacy dates were derived from
ROLL # rather than the source DATE column. Keep old rows recoverable.
"""
import sqlalchemy as sa
from alembic import op

from migration_support import (
    add_column_if_missing,
    create_index_if_missing,
)

revision = '20261002_0026'
down_revision = '20261002_0025'
branch_labels = None
depends_on = None


def upgrade():
    add_column_if_missing('ws3_machine_ws2_records', sa.Column('out_dyeing_sop', sa.String(160), nullable=True))
    create_index_if_missing('ix_ws3_machine_ws2_records_out_dyeing_sop', 'ws3_machine_ws2_records', ['out_dyeing_sop'])


def downgrade():
    op.drop_index('ix_ws3_machine_ws2_records_out_dyeing_sop', table_name='ws3_machine_ws2_records')
    op.drop_column('ws3_machine_ws2_records', 'out_dyeing_sop')
