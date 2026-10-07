import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

from fastapi import HTTPException

from app.api.routes.scouring import update_scouring_record
from app.schemas.scouring import ScouringRecordCreate


class FakeDatabase:
    def __init__(self, record):
        self.record = record
        self.committed = False

    def get(self, _model, record_id):
        return self.record if self.record and self.record.id == record_id else None

    def commit(self):
        self.committed = True

    def refresh(self, _record):
        pass


def record_payload(**overrides):
    values = {
        "machine_id": "SC-01",
        "recorded_at": datetime(2026, 10, 7, 8, tzinfo=timezone.utc),
        "order_number": "PKP-001",
        "operator_name": "Old operator",
        "operator_identifier": "1001",
        "shift": "A",
        "order_progress": None,
        "naoh": 1,
        "soap": 2,
        "desizer": 3,
        "h2o2": 4,
        "chelate": 5,
        "speed": 45,
        "temperature": 94,
        "cylinder_temperature": 90,
    }
    values.update(overrides)
    return values


class ScouringRecordUpdateTests(unittest.TestCase):
    def setUp(self):
        self.original_time = datetime(2026, 10, 6, 12, tzinfo=timezone.utc)
        self.record = SimpleNamespace(
            id=12,
            machine_id="SC-01",
            order_number="PKP-001",
            recorded_at=self.original_time,
            batch_identifier="batch-kept",
            **{key: value for key, value in record_payload().items() if key not in {"machine_id", "order_number", "recorded_at"}},
        )
        self.db = FakeDatabase(self.record)

    def test_updates_existing_record_and_preserves_history_identity(self):
        payload = ScouringRecordCreate(**record_payload(operator_name="New operator", naoh=9))

        updated = update_scouring_record(12, payload, self.db)

        self.assertIs(updated, self.record)
        self.assertEqual(updated.id, 12)
        self.assertEqual(updated.recorded_at, self.original_time)
        self.assertEqual(updated.order_number, "PKP-001")
        self.assertEqual(updated.batch_identifier, "batch-kept")
        self.assertEqual(updated.operator_name, "New operator")
        self.assertEqual(updated.naoh, 9)
        self.assertTrue(self.db.committed)

    def test_rejects_changing_order_or_machine(self):
        for overrides in ({"order_number": "PKP-OTHER"}, {"machine_id": "SC-02"}):
            with self.subTest(overrides=overrides):
                db = FakeDatabase(self.record)
                payload = ScouringRecordCreate(**record_payload(**overrides))
                with self.assertRaises(HTTPException) as error:
                    update_scouring_record(12, payload, db)
                self.assertEqual(error.exception.status_code, 409)
                self.assertFalse(db.committed)

    def test_returns_not_found_for_missing_record(self):
        payload = ScouringRecordCreate(**record_payload())
        with self.assertRaises(HTTPException) as error:
            update_scouring_record(999, payload, FakeDatabase(None))
        self.assertEqual(error.exception.status_code, 404)


if __name__ == "__main__":
    unittest.main()
