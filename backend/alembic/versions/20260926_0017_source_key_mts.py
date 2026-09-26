"""Include the production meters in the MES source key."""

import json
import re
import unicodedata
from collections.abc import Sequence
from decimal import Decimal, InvalidOperation

import sqlalchemy as sa
from alembic import op

revision: str = "20260926_0017"
down_revision: str | None = "20260926_0016"
branch_labels: Sequence[str] | None = None
depends_on: Sequence[str] | None = None


def _header(value: object) -> str:
    text = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().strip().lower()
    return re.sub(r"\s+", " ", text)


def _value(row: dict[str, object], aliases: tuple[str, ...]) -> str:
    normalized = {_header(key): value for key, value in row.items()}
    for alias in aliases:
        value = str(normalized.get(_header(alias), "") or "").strip()
        if value:
            return value
    return ""


def _mts(value: str) -> str:
    try:
        return format(Decimal(value.replace(",", "")).normalize(), "f")
    except (InvalidOperation, ValueError):
        return re.sub(r"\s+", " ", value.upper())


def _source_key(raw_data: str) -> str | None:
    try:
        row = json.loads(raw_data or "{}")
    except json.JSONDecodeError:
        return None
    values = [
        _value(row, ("DATE", "DATE PRODUCTION")),
        _value(row, ("SHIFT",)),
        _value(row, ("MACHINE", "M/C NO", "LOOM", "LOOM NO")),
        _value(row, ("SOP #", "SOP")),
        _value(row, ("LOT #", "LOT", "LOT NO")),
        _mts(_value(row, ("MTS", "MET", "METER", "METERS", "LENGTH"))),
    ]
    if not all(values):
        return None
    values[0] = values[0][:10].replace("/", "-")
    return "|".join(re.sub(r"\s+", " ", value.upper()) for value in values)


def upgrade() -> None:
    connection = op.get_bind()
    rows = connection.execute(sa.text("SELECT id, raw_data_json FROM ws3_order_rolls")).mappings().all()
    for row in rows:
        connection.execute(
            sa.text("UPDATE ws3_order_rolls SET source_key = :source_key WHERE id = :id"),
            {"source_key": _source_key(row["raw_data_json"]), "id": row["id"]},
        )


def downgrade() -> None:
    # Existing keys cannot be safely converted back without losing MTS identity.
    pass
