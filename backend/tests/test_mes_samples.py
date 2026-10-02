"""Optional integration test: set WS3_MES_FIXTURE_DIR to the supplied MES folder."""
import os
import unittest
from pathlib import Path

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from app.models.ws3_production import WS3ProductionOrder, WS3MachineWS2Record, WS3WorkerRecord
from app.services.snapshot_report import build_report
from app.services.snapshot_sources import read_excel, parse_source


@unittest.skipUnless(os.environ.get('WS3_MES_FIXTURE_DIR'), 'MES sample files not configured')
class MesSampleTests(unittest.TestCase):
    def test_import_and_join_original_three_files(self):
        engine = create_engine('sqlite://')
        sources = [('order', 'WS3-ORDER', WS3ProductionOrder), ('machine', 'MACHINE-ORDER', WS3MachineWS2Record), ('worker', 'MACHINE-DETAILS', WS3WorkerRecord)]
        with Session(engine) as db:
            for source, filename, model in sources:
                model.__table__.create(engine)
                path = Path(os.environ['WS3_MES_FIXTURE_DIR']) / (filename + '.XLS.xls')
                records = parse_source(read_excel(path.read_bytes(), path.name), source)
                db.bulk_insert_mappings(model, records)
            db.commit()
            result = build_report(db.scalars(select(WS3ProductionOrder)).all(), db.scalars(select(WS3MachineWS2Record)).all(), db.scalars(select(WS3WorkerRecord)).all(), '2026-10-02')
            self.assertEqual(result['summary'], {'orders': 18, 'ready': 16, 'check': 2})
            self.assertEqual(sum(o['matched_rolls'] for o in result['orders']), 70)
            example = next(o for o in result['orders'] if o['pk_no'] == 'PKP261002-001')
            self.assertEqual({r['machine_no'] for r in example['rolls']}, {'WEV012', 'WEV021', 'WEV039', 'WEV042', 'WEV091', 'WEV099', 'WEV101', 'WEV204'})
            self.assertTrue(all(r['worker'] and r['shift'] and r['remarks'] == 'PNS2605-0038' for r in example['rolls']))
        engine.dispose()
