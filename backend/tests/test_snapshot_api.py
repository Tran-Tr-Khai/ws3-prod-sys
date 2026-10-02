import asyncio
import unittest
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.api.routes.ws3_snapshot import replace_data_snapshot, _require_admin, _require_supervisor
from app.models.ws3_production import WS3ProductionOrder, WS3MachineWS2Record, WS3WorkerRecord


class SnapshotApiTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        for model in (WS3ProductionOrder, WS3MachineWS2Record, WS3WorkerRecord):
            model.__table__.create(self.engine)
        self.db = Session(self.engine)
        self.db.add(WS3ProductionOrder(pk_no='OLD'))
        self.db.add(WS3WorkerRecord(worker='Retained worker'))
        self.db.commit()

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def upload(self, machine=None):
        return asyncio.run(replace_data_snapshot(order_file=UploadFile(filename='order.xls', file=BytesIO(b'')), machine_file=machine, worker_file=None, db=self.db, user=SimpleNamespace()))

    @patch('app.api.routes.ws3_snapshot._require_supervisor')
    @patch('app.api.routes.ws3_snapshot._read_upload', return_value=('order.xls', []))
    @patch('app.api.routes.ws3_snapshot.parse_source', return_value=[{'pk_no': 'NEW'}])
    def test_partial_replacement_keeps_other_source(self, *mocks):
        result = self.upload()
        self.assertEqual(self.db.scalars(select(WS3ProductionOrder.pk_no)).all(), ['NEW'])
        self.assertEqual(self.db.scalars(select(WS3WorkerRecord.worker)).all(), ['Retained worker'])
        self.assertIsNone(result['updated']['workers'])

    @patch('app.api.routes.ws3_snapshot._require_supervisor')
    @patch('app.api.routes.ws3_snapshot._read_upload', return_value=('source.xls', []))
    @patch('app.api.routes.ws3_snapshot.parse_source', side_effect=[[{'pk_no': 'NEW'}], ValueError('Wrong header')])
    def test_invalid_second_source_preserves_all_snapshots(self, *mocks):
        with self.assertRaises(HTTPException):
            self.upload(UploadFile(filename='wrong.xls', file=BytesIO(b'')))
        self.assertEqual(self.db.scalars(select(WS3ProductionOrder.pk_no)).all(), ['OLD'])

    @patch('app.api.routes.ws3_snapshot._require_supervisor')
    @patch('app.api.routes.ws3_snapshot._read_upload', return_value=('source.xls', []))
    @patch('app.api.routes.ws3_snapshot.parse_source', return_value=[{'pk_no': 'NEW'}])
    def test_insert_error_rolls_back_deleted_source(self, *mocks):
        with patch.object(self.db, 'bulk_insert_mappings', side_effect=RuntimeError('write failed')):
            with self.assertRaises(RuntimeError):
                self.upload()
        self.assertEqual(self.db.scalars(select(WS3ProductionOrder.pk_no)).all(), ['OLD'])

    @patch('app.api.routes.ws3_snapshot.role_codes', return_value={'SUPERVISOR'})
    def test_supervisor_cannot_access_warehouse(self, roles):
        _require_supervisor(SimpleNamespace())
        with self.assertRaises(HTTPException) as error:
            _require_admin(SimpleNamespace())
        self.assertEqual(error.exception.status_code, 403)

    @patch('app.api.routes.ws3_snapshot.role_codes', return_value={'OPERATOR'})
    def test_worker_cannot_upload(self, roles):
        with self.assertRaises(HTTPException):
            _require_supervisor(SimpleNamespace())
