import unittest
from datetime import datetime, date
from unittest.mock import patch

from fastapi import HTTPException
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session

from app.db.base import Base
from app.models.buffing import BuffingCheck
from app.models.machine_order_state import MachineOrderState
from app.models.tentering import TenteringOrder, TenteringRollEntry
from app.models.user import User, Role
from app.models.ws3_production import WS3ProductionOrder, WS3MachineWS2Record
from app.services.machine_order_progress import ORDER_RECORDS
from app.services.machine_overview import get_overview, get_overview_details
from app.api.routes.machine_overview import overview, details, mes


class MachineOverviewTests(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite://')
        models = {model for model, _ in ORDER_RECORDS.values()} | {MachineOrderState, TenteringRollEntry, User, Role, WS3ProductionOrder, WS3MachineWS2Record}
        Base.metadata.create_all(self.engine, tables=[model.__table__ for model in models])
        self.db = Session(self.engine)
        self.manager = User(username='manager', roles=[Role(code='ADMIN', name='Admin')])

    def tearDown(self):
        self.db.close()
        self.engine.dispose()

    def record(self, machine, sop, day, progress='IN_PROGRESS'):
        model, sop_field = ORDER_RECORDS[machine]
        when = datetime(2026, 10, day, 8)
        values = dict(machine_id=machine, operator_name='Worker', operator_identifier='001', shift='CA A', order_progress=progress)
        values[sop_field] = sop
        if model is TenteringOrder:
            values.update(created_at=when, updated_at=when, item_description='Fabric')
        elif model is BuffingCheck:
            values.update(checked_at=when, check_date=when.date(), **{f'check_{i}': True for i in range(1, 6)})
        elif machine == 'SC-01':
            values.update(recorded_at=when, item='Fabric', naoh=1, soap=1, desizer=1, h2o2=1, chelate=1, speed=45, temperature=95, cylinder_temperature=95, production_quantity_meters=0)
        else:
            values.update(recorded_at=when, production_date=date(2026, 10, day), item='Fabric', buyer='', design='', speed=40, quantity_meters=0)
            if machine == 'TR-01':
                values['temperature'] = 90
        row = model(**values)
        self.db.add(row)
        self.db.commit()
        return row

    def test_every_machine_prefers_active_then_latest_and_empty(self):
        for machine in ORDER_RECORDS:
            with self.subTest(machine=machine):
                self.assertIsNone(get_overview(self.db, machine))
                active = self.record(machine, 'SOP-A', 1)
                latest = self.record(machine, 'SOP-B', 2, 'COMPLETED')
                self.assertEqual(get_overview(self.db, machine)['id'], active.id)
                active.order_progress = 'COMPLETED'
                if isinstance(active, TenteringOrder):
                    # Keep chronology fixed; the model normally advances updated_at
                    # on an edit, which would correctly make this the latest row.
                    active.updated_at = datetime(2026, 10, 1, 9)
                self.db.commit()
                self.assertEqual(get_overview(self.db, machine)['id'], latest.id)

    def test_canonical_state_overrides_copied_status(self):
        old = self.record('TR-01', 'SOP-A', 1, 'COMPLETED')
        self.record('TR-01', 'SOP-B', 2)
        self.db.add_all([
            MachineOrderState(machine_id='TR-01', order_number='SOP-A', order_progress='IN_PROGRESS'),
            MachineOrderState(machine_id='TR-01', order_number='SOP-B', order_progress='COMPLETED'),
        ])
        self.db.commit()
        result = get_overview(self.db, 'TR-01')
        self.assertEqual(result['id'], old.id)
        self.assertEqual(result['progress'], 'IN_PROGRESS')
        self.assertEqual(result['output'], 0)

    def test_core_does_not_read_mes_images_or_roll_entries(self):
        for machine in ('BU-01', 'TE-01', 'SC-01'):
            self.record(machine, 'SOP-A', 1)
        statements = []
        def capture(conn, cursor, statement, parameters, context, executemany):
            statements.append(statement.lower())
        event.listen(self.engine, 'before_cursor_execute', capture)
        with patch('app.services.machine_overview.resolve_ws3_order_code', side_effect=AssertionError('MES called')):
            for machine in ('BU-01', 'TE-01', 'SC-01'):
                get_overview(self.db, machine)
        event.remove(self.engine, 'before_cursor_execute', capture)
        self.assertEqual(len(statements), 3)
        for statement in statements:
            self.assertIn('limit', statement)
            self.assertNotIn('buffing_check_images', statement)
            self.assertNotIn('tentering_roll_entries', statement)
            self.assertNotIn('ws3_', statement)

    def test_buffing_aggregate_includes_aliases_and_no_images(self):
        first = self.record('BU-01', 'PKP-A', 1)
        latest = self.record('BU-01', 'SOP-A', 2)
        latest.check_3 = False
        self.db.add(WS3ProductionOrder(pk_no='PKP-A', invoice_no='SOP-A'))
        self.db.commit()
        self.assertIsNone(get_overview(self.db, 'BU-01')['inspection'])
        result = get_overview_details(self.db, 'BU-01', latest.id)
        self.assertEqual(result['checks'], 2)
        self.assertEqual(result['failed_checks'], 1)
        self.assertEqual(result['started'], first.checked_at)
        self.assertEqual(result['inspection'], 'WARNING')

    def test_tentering_aggregate_preserves_missing_and_zero_output(self):
        order = self.record('TE-01', 'SOP-A', 1)
        self.db.add(TenteringRollEntry(order_id=order.id, roll_number=1))
        self.db.commit()
        self.assertIsNone(get_overview_details(self.db, 'TE-01', order.id)['output'])
        self.db.add(TenteringRollEntry(order_id=order.id, roll_number=2, actual_quantity=0))
        self.db.commit()
        result = get_overview_details(self.db, 'TE-01', order.id)
        self.assertEqual(result['output'], 0)
        self.assertEqual(result['rolls'], 2)
        self.assertIsNone(get_overview_details(self.db, 'TE-02', order.id))

    def test_endpoints_authorize_all_stages(self):
        worker = User(username='worker', roles=[], machine_ids=['SC-01'])
        calls = [lambda: overview('BU-01', self.db, worker), lambda: details('BU-01', 1, self.db, worker), lambda: mes('BU-01', 'SOP-A', self.db, worker)]
        for call in calls:
            with self.assertRaises(HTTPException) as error:
                call()
            self.assertEqual(error.exception.status_code, 403)

    def test_mes_summary_matches_order_and_keeps_zero_meters(self):
        self.db.add(WS3ProductionOrder(pk_no='PKP-A', invoice_no='SOP-A', item_name='Fabric', quantity='1'))
        self.db.add_all([
            WS3MachineWS2Record(out_dyeing_sop=' sop-a ', roll_id='ROLL-1', length_meters=0),
            WS3MachineWS2Record(out_dyeing_sop='OTHER', roll_id='ROLL-2', length_meters=999),
        ])
        self.db.commit()
        result = mes('SC-01', 'SOP-A', self.db, self.manager)
        self.assertEqual(result, {'item': 'Fabric', 'lot': None, 'rolls': 1, 'input': 0})
        self.assertIsNone(mes('SC-01', 'MISSING', self.db, self.manager))

    def test_mes_does_not_mix_sops_with_same_pkp(self):
        self.db.add_all([
            WS3ProductionOrder(pk_no='PKP-A', invoice_no='SOP-A', quantity='1'),
            WS3ProductionOrder(pk_no='PKP-A', invoice_no='SOP-B', quantity='1'),
            WS3MachineWS2Record(out_dyeing_sop='SOP-A', roll_id='ROLL-1', length_meters=100),
            WS3MachineWS2Record(out_dyeing_sop='SOP-B', roll_id='ROLL-2', length_meters=200),
        ])
        self.db.commit()
        for machine in ORDER_RECORDS:
            with self.subTest(machine=machine):
                result = mes(machine, 'SOP-A', self.db, self.manager)
                self.assertEqual(result['rolls'], 1)
                self.assertEqual(result['input'], 100)


if __name__ == '__main__':
    unittest.main()
