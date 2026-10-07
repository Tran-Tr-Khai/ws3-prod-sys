from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.models.ws3_production import WS3ProductionOrder
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_order_code


def test_sop_resolves_to_all_rows_of_linked_pkp_and_returns_legacy_aliases() -> None:
    engine = create_engine("sqlite://")
    WS3ProductionOrder.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            WS3ProductionOrder(pk_no="PKP-001", invoice_no="SOP-001", raw_data_json="{}"),
            WS3ProductionOrder(pk_no="PKP-001", invoice_no="SOP-002", raw_data_json="{}"),
            WS3ProductionOrder(pk_no="PKP-002", invoice_no="SOP-003", raw_data_json="{}"),
        ])
        db.flush()

        rows, aliases = resolve_ws3_order_code(db, " sop-001 ")

    assert {row.pk_no for row in rows} == {"PKP-001"}
    assert aliases == {"PKP-001", "SOP-001", "SOP-002"}


def test_sop_mapped_to_multiple_pkps_is_rejected() -> None:
    engine = create_engine("sqlite://")
    WS3ProductionOrder.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            WS3ProductionOrder(pk_no="PKP-001", invoice_no="SOP-DUP", raw_data_json="{}"),
            WS3ProductionOrder(pk_no="PKP-002", invoice_no="SOP-DUP", raw_data_json="{}"),
        ])
        db.flush()

        try:
            resolve_ws3_order_code(db, "SOP-DUP")
        except AmbiguousWS3OrderCode:
            pass
        else:
            raise AssertionError("Ambiguous SOP must not silently resolve to an arbitrary order")
