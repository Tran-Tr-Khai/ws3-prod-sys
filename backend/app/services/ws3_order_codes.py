"""Resolve WS3 operator-facing SOP codes to their linked PKP order rows."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.ws3_production import WS3ProductionOrder


class AmbiguousWS3OrderCode(ValueError):
    """Raised when one SOP code points to more than one PKP production order."""


def resolve_ws3_order_code(db: Session, code: str) -> tuple[list[WS3ProductionOrder], set[str]]:
    """Return every MES row for the PKP identified by a PKP or SOP code.

    PKP is checked first because it is the stable grouping key for the MES
    report. SOP (stored in ORDEROFWS3's invoice number) is the worker-facing
    alias. Returning all aliases lets callers include historical records that
    were saved under PKP before operators switched to SOP.
    """
    normalized = code.strip().upper()
    if not normalized:
        return [], set()

    pk_rows = db.scalars(
        select(WS3ProductionOrder).where(func.upper(func.trim(WS3ProductionOrder.pk_no)) == normalized)
    ).all()
    if pk_rows:
        pk_no = next((row.pk_no.strip() for row in pk_rows if row.pk_no and row.pk_no.strip()), normalized)
    else:
        sop_rows = db.scalars(
            select(WS3ProductionOrder).where(func.upper(func.trim(WS3ProductionOrder.invoice_no)) == normalized)
        ).all()
        linked_pk = {row.pk_no.strip() for row in sop_rows if row.pk_no and row.pk_no.strip()}
        if not linked_pk:
            return [], set()
        if len(linked_pk) > 1:
            raise AmbiguousWS3OrderCode(f"SOP '{code.strip()}' is linked to multiple PKP orders")
        pk_no = next(iter(linked_pk))

    rows = db.scalars(
        select(WS3ProductionOrder).where(func.upper(func.trim(WS3ProductionOrder.pk_no)) == pk_no.upper())
    ).all()
    aliases = {pk_no.upper()}
    aliases.update(row.invoice_no.strip().upper() for row in rows if row.invoice_no and row.invoice_no.strip())
    return rows, aliases
