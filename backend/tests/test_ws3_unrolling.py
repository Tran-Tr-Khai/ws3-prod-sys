import unittest
from datetime import date
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, delete
from sqlalchemy.orm import Session

from app.api.routes.ws3_unrolling import (
    _require_unrolling_read,
    _require_unrolling_write,
    list_unrolling_orders,
    record_unrolling_roll_action,
)
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.models.ws3_unrolling import WS3UnrollingRollEvent
from app.schemas.ws3_unrolling import WS3UnrollingRollAction

WORKER_PROFILE = {"worker_name": "Nguyễn Văn A", "worker_id": "NV-001", "worker_shift": "CA A"}


class WS3UnrollingTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine("sqlite://")
        User.__table__.create(self.engine)
        for model in (WS3ProductionOrder, WS3MachineWS2Record, WS3WorkerRecord, WS3UnrollingRollEvent):
            model.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.user = User(username="unrolling", full_name="Unrolling Worker", password_hash="test", machine_ids=["UN-01"])
        self.db.add(self.user)
        self.db.add(WS3ProductionOrder(
            production_date="2026-10-02", pk_no="PKP261002-001", invoice_no="INV-001",
            po_no="PO-001", source_order_no="SRC-001", item_code="WS20016000",
            item_name="POLYESTER FDY", lot_no="011-6A", quantity="2",
        ))
        for machine_no, roll_id, meters in (
            ("WEV012", "PWEV012260930-21", 1560),
            ("WEV021", "PWEV021260930-32", 1211),
        ):
            self.db.add(WS3MachineWS2Record(
                out_dyeing_sop="INV-001", weaving_date="2026-09-30", roll_id=roll_id,
                machine_no=machine_no, sop_no="SOP-001", po_no="PO-001",
                source_order_no="SRC-001", item_code="WS20016000", item_name="POLYESTER FDY",
                lot_no="011-6A", length_meters=meters,
            ))
            self.db.add(WS3WorkerRecord(
                weaving_date="2026-09-30", shift="CA A", worker="Worker One", sop_no="SOP-001",
                machine_no=machine_no, po_no="PO-001", source_order_no="SRC-001",
                item_code="WS20016000", item_name="POLYESTER FDY", lot_no="011-6A",
            ))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_order_date_is_independent_of_collection_timestamp(self, _roles):
        self.assertEqual(list_unrolling_orders(order_date=date(2026, 10, 3), db=self.db, user=self.user).orders, [])
        order = list_unrolling_orders(order_date=date(2026, 10, 2), db=self.db, user=self.user).orders[0]
        self.assertFalse(order.collection_complete)
        for index, roll in enumerate(order.rolls):
            action = WS3UnrollingRollAction(pk_no=order.pk_no, roll_id=roll.roll_id, action="COLLECT", **WORKER_PROFILE)
            record_unrolling_roll_action(action, db=self.db, user=self.user)
            updated = list_unrolling_orders(db=self.db, user=self.user).orders[0]
            self.assertEqual(updated.collection_complete, index == len(order.rolls) - 1)
            timestamp = updated.rolls[index].collected_at
            self.assertIsNotNone(timestamp)
            self.assertEqual(updated.production_date, "2026-10-02")
            record_unrolling_roll_action(action, db=self.db, user=self.user)
            self.assertEqual(list_unrolling_orders(db=self.db, user=self.user).orders[0].rolls[index].collected_at, timestamp)

        # A missing source roll must not turn a partially matched order complete.
        from sqlalchemy import select
        source = self.db.scalar(select(WS3ProductionOrder))
        source.quantity = "3"
        self.db.commit()
        self.assertFalse(list_unrolling_orders(db=self.db, user=self.user).orders[0].collection_complete)
        for roll in order.rolls:
            record_unrolling_roll_action(WS3UnrollingRollAction(
                pk_no=order.pk_no, roll_id=roll.roll_id, action="TRANSFER_TO_PRODUCTION", **WORKER_PROFILE,
            ), db=self.db, user=self.user)
        # Keep an incompletely matched order visible for later arriving rolls.
        self.assertEqual(len(list_unrolling_orders(db=self.db, user=self.user).orders), 1)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_history_is_joined_once_and_search_filters_before_join(self, _roles):
        from app.services.snapshot_report import build_report
        self.db.add(WS3ProductionOrder(
            production_date="2026-09-01", pk_no="PKP260901-001",
            invoice_no="INV-001", po_no="PO-001", source_order_no="SRC-001",
            item_code="WS20016000", lot_no="011-6A", quantity="2",
        ))
        self.db.commit()
        with patch("app.api.routes.ws3_unrolling.build_report", wraps=build_report) as report:
            result = list_unrolling_orders(db=self.db, user=self.user)
            self.assertEqual(report.call_count, 1)
            self.assertEqual([o.production_date for o in result.orders], ["2026-10-02", "2026-09-01"])
        with patch("app.api.routes.ws3_unrolling.build_report", wraps=build_report) as report:
            result = list_unrolling_orders(q="pkp261002", db=self.db, user=self.user)
            self.assertEqual(len(result.orders), 1)
            self.assertEqual(len(report.call_args.args[0]), 1)
        self.assertEqual(list_unrolling_orders(q="%", db=self.db, user=self.user).orders, [])

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_only_unrolling_assigned_operator_can_write(self, _roles):
        _require_unrolling_read(self.user)
        _require_unrolling_write(self.user)
        other = SimpleNamespace(machine_ids=["SC-01"])
        with self.assertRaises(HTTPException) as error:
            _require_unrolling_write(other)
        self.assertEqual(error.exception.status_code, 403)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_worklist_uses_joined_rolls_and_persists_partial_progress(self, _roles):
        initial = list_unrolling_orders(db=self.db, user=self.user)
        self.assertEqual(len(initial.orders), 1)
        order = initial.orders[0]
        self.assertEqual(order.pk_no, "PKP261002-001")
        self.assertEqual(order.matched_rolls, 2)
        self.assertEqual(order.collected_rolls, 0)
        self.assertEqual({roll.roll_id for roll in order.rolls}, {"PWEV012260930-21", "PWEV021260930-32"})

        action = WS3UnrollingRollAction(pk_no=order.pk_no, roll_id="PWEV012260930-21", action="COLLECT", **WORKER_PROFILE)
        result = record_unrolling_roll_action(action, db=self.db, user=self.user)
        self.assertTrue(result.changed)
        updated = list_unrolling_orders(db=self.db, user=self.user).orders[0]
        self.assertEqual((updated.collected_rolls, updated.transferred_rolls), (1, 0))
        collected_roll = next(roll for roll in updated.rolls if roll.roll_id == "PWEV012260930-21")
        self.assertEqual((collected_roll.collected_by, collected_roll.collected_worker_id, collected_roll.collected_shift),
                         ("Nguyễn Văn A", "NV-001", "CA A"))

        transfer = WS3UnrollingRollAction(pk_no=order.pk_no, roll_id="PWEV012260930-21", action="TRANSFER_TO_PRODUCTION", **WORKER_PROFILE)
        result = record_unrolling_roll_action(transfer, db=self.db, user=self.user)
        self.assertTrue(result.changed)
        updated = list_unrolling_orders(db=self.db, user=self.user).orders[0]
        self.assertEqual((updated.collected_rolls, updated.transferred_rolls), (1, 1))

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_roll_cannot_transfer_before_collection_and_duplicate_collection_is_idempotent(self, _roles):
        transfer = WS3UnrollingRollAction(pk_no="PKP261002-001", roll_id="PWEV012260930-21", action="TRANSFER_TO_PRODUCTION", **WORKER_PROFILE)
        with self.assertRaises(HTTPException) as error:
            record_unrolling_roll_action(transfer, db=self.db, user=self.user)
        self.assertEqual(error.exception.status_code, 409)

        collect = WS3UnrollingRollAction(pk_no="PKP261002-001", roll_id="PWEV012260930-21", action="COLLECT", **WORKER_PROFILE)
        first = record_unrolling_roll_action(collect, db=self.db, user=self.user)
        second = record_unrolling_roll_action(collect, db=self.db, user=self.user)
        self.assertTrue(first.changed)
        self.assertFalse(second.changed)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_worker_cannot_record_roll_not_in_current_joined_order(self, _roles):
        action = WS3UnrollingRollAction(pk_no="PKP261002-001", roll_id="NOT-A-REAL-ROLL", action="COLLECT", **WORKER_PROFILE)
        with self.assertRaises(HTTPException) as error:
            record_unrolling_roll_action(action, db=self.db, user=self.user)
        self.assertEqual(error.exception.status_code, 404)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_collection_progress_survives_snapshot_row_replacement(self, _roles):
        action = WS3UnrollingRollAction(pk_no="PKP261002-001", roll_id="PWEV012260930-21", action="COLLECT", **WORKER_PROFILE)
        record_unrolling_roll_action(action, db=self.db, user=self.user)
        self.db.execute(delete(WS3ProductionOrder))
        self.db.add(WS3ProductionOrder(
            production_date="2026-10-02", pk_no="PKP261002-001", invoice_no="INV-001",
            po_no="PO-001", source_order_no="SRC-001", item_code="WS20016000",
            item_name="POLYESTER FDY", lot_no="011-6A", quantity="2",
        ))
        self.db.commit()
        order = list_unrolling_orders(db=self.db, user=self.user).orders[0]
        self.assertEqual(order.collected_rolls, 1)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"SUPERVISOR"})
    def test_supervisor_can_read_but_not_record_physical_collection(self, _roles):
        _require_unrolling_read(self.user)
        with self.assertRaises(HTTPException) as error:
            _require_unrolling_write(self.user)
        self.assertEqual(error.exception.status_code, 403)

    @patch("app.api.routes.ws3_unrolling.role_codes", return_value={"OPERATOR"})
    def test_roll_action_requires_worker_name_id_and_shift(self, _roles):
        incomplete = WS3UnrollingRollAction(
            pk_no="PKP261002-001", roll_id="PWEV012260930-21", action="COLLECT",
            worker_name="Nguyễn Văn A", worker_id="NV-001",
        )
        with self.assertRaises(HTTPException) as error:
            record_unrolling_roll_action(incomplete, db=self.db, user=self.user)
        self.assertEqual(error.exception.status_code, 422)


if __name__ == "__main__":
    unittest.main()
