import unittest

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.db.base import Base
from app.models.tentering import TenteringOrder, TenteringRollEntry
from app.models.user import Role, User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.schemas.tentering import TenteringOrderInput
from app.api.routes.tentering import get_tentering_order, get_tentering_order_source, save_tentering_order


class TenteringRecordTests(unittest.TestCase):
    def setUp(self) -> None:
        self.engine = create_engine("sqlite://")
        Base.metadata.create_all(self.engine, tables=[User.__table__, Role.__table__, TenteringOrder.__table__, TenteringRollEntry.__table__, WS3ProductionOrder.__table__, WS3MachineWS2Record.__table__, WS3WorkerRecord.__table__])

    def tearDown(self) -> None:
        self.engine.dispose()

    def test_one_sop_supports_more_than_nine_unique_roll_slots(self) -> None:
        with Session(self.engine) as db:
            order = TenteringOrder(sop_no="PD260921-030", customer="SEDOVINAKO")
            order.entries = [TenteringRollEntry(roll_number=roll) for roll in range(1, 13)]
            db.add(order)
            db.commit()

            saved = db.query(TenteringOrder).filter_by(sop_no="PD260921-030").one()
            self.assertEqual(len(saved.entries), 12)
            self.assertEqual(saved.entries[-1].roll_number, 12)
            self.assertEqual(saved.order_progress, "IN_PROGRESS")

            db.add(TenteringRollEntry(order_id=saved.id, roll_number=12))
            with self.assertRaises(IntegrityError):
                db.commit()

    def test_same_sop_can_be_recorded_for_both_tenter_machines(self) -> None:
        with Session(self.engine) as db:
            db.add_all([
                TenteringOrder(machine_id="TE-01", sop_no="PD260921-030"),
                TenteringOrder(machine_id="TE-02", sop_no="PD260921-030"),
            ])
            db.commit()
            self.assertEqual(db.query(TenteringOrder).filter_by(sop_no="PD260921-030").count(), 2)

    def test_payload_rejects_duplicate_or_excessive_roll_numbers(self) -> None:
        with self.assertRaises(ValidationError):
            TenteringOrderInput(entries=[{"roll_number": 1}, {"roll_number": 1}])
        self.assertEqual(len(TenteringOrderInput(entries=[{"roll_number": roll} for roll in range(1, 13)]).entries), 12)
        with self.assertRaises(ValidationError):
            TenteringOrderInput(entries=[{"roll_number": 501}])

    def test_payload_rejects_negative_actual_quantity(self) -> None:
        with self.assertRaises(ValidationError):
            TenteringOrderInput(entries=[{"roll_number": 1, "actual_quantity": -1}])

    def test_order_progress_defaults_to_in_progress_and_accepts_completed(self) -> None:
        self.assertEqual(TenteringOrderInput().order_progress, "IN_PROGRESS")
        self.assertEqual(TenteringOrderInput(order_progress="COMPLETED").order_progress, "COMPLETED")

    def test_tentering_source_uses_unambiguous_sop_fields_from_existing_snapshot(self) -> None:
        with Session(self.engine) as db:
            db.add_all([
                WS3ProductionOrder(pk_no="PKP-001", invoice_no="SOP-001", po_no="PO-1", source_order_no="ORDER-1", item_code="ITEM-1", item_name="POLYESTER FDY", lot_no="LOT-1", quantity="1", raw_data_json="{}"),
                WS3MachineWS2Record(out_dyeing_sop="SOP-001", weaving_date="2026-10-04", roll_id="PWEV024261003-1", machine_no="WEV024", sop_no="SOP-001", po_no="PO-1", source_order_no="ORDER-1", item_code="ITEM-1", item_name="POLYESTER FDY", lot_no="LOT-1", length_meters=100, raw_data_json="{}"),
                WS3WorkerRecord(sop_no="SOP-001", customer="SEDOVINAKO", weaving_date="2026-10-03", machine_no="WEV024", worker="Worker", shift="CA A", raw_data_json="{}"),
            ])
            db.flush()
            user = User(username="admin", full_name="Admin", password_hash="x", machine_ids=[], roles=[Role(code="ADMIN", name="Admin")])

            result = get_tentering_order_source(" sop-001 ", "TE-01", db, user)

        self.assertEqual(result["item_description"], "POLYESTER FDY")
        self.assertEqual(result["customer"], "SEDOVINAKO")
        self.assertEqual(result["rolls"], [{"roll_number": 1, "roll_id": "PWEV024261003-1", "weaving_date": "2026-10-03", "length_meters": 100.0}])

    def test_tentering_source_does_not_resolve_pkp_as_operator_order_code(self) -> None:
        with Session(self.engine) as db:
            db.add(WS3ProductionOrder(pk_no="PKP-001", invoice_no="SOP-001", raw_data_json="{}"))
            db.flush()
            user = User(username="admin", full_name="Admin", password_hash="x", machine_ids=[], roles=[Role(code="ADMIN", name="Admin")])

            result = get_tentering_order_source("PKP-001", "TE-01", db, user)

        self.assertIsNone(result)

    def test_tentering_entry_endpoints_reject_pkp_code(self) -> None:
        with Session(self.engine) as db:
            user = User(username="admin", full_name="Admin", password_hash="x", machine_ids=[], roles=[Role(code="ADMIN", name="Admin")])

            with self.assertRaises(HTTPException) as get_error:
                get_tentering_order("PKP261006-001", "TE-01", db, user)
            with self.assertRaises(HTTPException) as save_error:
                save_tentering_order("PKP261006-001", TenteringOrderInput(), "TE-01", db, user)

        self.assertEqual(get_error.exception.status_code, 422)
        self.assertEqual(save_error.exception.status_code, 422)

if __name__ == "__main__":
    unittest.main()
