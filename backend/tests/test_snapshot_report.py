import json
import unittest
from decimal import Decimal
from types import SimpleNamespace as Row

from app.services.snapshot_report import build_report, roll_date
from app.services.snapshot_sources import parse_source


def order(**changes):
    values = dict(pk_no='PK1', invoice_no='PD1', quantity='1', po_no='PO1', source_order_no='ORDER1', item_code='ITEM1', item_name='Fabric', lot_no='LOT1', raw_data_json=json.dumps({'columns': ['QTY / MTS'], 'row': ['100']}))
    return Row(**(values | changes))


def machine(**changes):
    values = dict(out_dyeing_sop='PD1', roll_id='PWEV012260930-21', weaving_date='2026-10-02', machine_no='WEV012', sop_no='PNW1', po_no='PO1', source_order_no='ORDER1', item_code='ITEM1', item_name='Fabric', lot_no='LOT1', length_meters=Decimal('100'))
    return Row(**(values | changes))


def worker(**changes):
    return Row(**(dict(sop_no='PNW1', weaving_date='2026-09-30', machine_no='WEV012', shift='CA A', worker='Worker A') | changes))


class ReportTests(unittest.TestCase):
    def report(self, orders=None, machines=None, workers=None):
        return build_report(orders or [order()], machines if machines is not None else [machine()], workers if workers is not None else [worker()], '2026-10-02')['orders'][0]

    def test_roll_date_not_dispatch_date_and_remarks(self):
        result = self.report()
        self.assertEqual(result['status'], 'READY')
        self.assertEqual(result['rolls'][0]['worker'], 'Worker A')
        self.assertEqual(result['rolls'][0]['weaving_date'], '2026-09-30')
        self.assertEqual(result['rolls'][0]['remarks'], 'ORDER1')

    def test_invoice_join_not_position_or_quantity(self):
        result = self.report(machines=[machine(out_dyeing_sop='OTHER'), machine()])
        self.assertEqual(result['matched_rolls'], 1)
        self.assertEqual(result['status'], 'READY')

    def test_multiple_order_lines_do_not_multiply_rolls(self):
        result = self.report(orders=[order(), order()], machines=[machine(), machine(roll_id='PWEV012260930-22')])
        self.assertEqual(result['matched_rolls'], 2)
        self.assertEqual(result['status'], 'READY')

    def test_deduplicate_exact_roll_and_worker_rows(self):
        self.assertEqual(self.report(machines=[machine(), machine()], workers=[worker(), worker()])['status'], 'READY')

    def test_ambiguous_worker_not_arbitrarily_assigned(self):
        result = self.report(workers=[worker(), worker(worker='Worker B', shift='CA B')])
        self.assertIsNone(result['rolls'][0]['worker'])
        self.assertEqual(len(result['rolls'][0]['worker_candidates']), 2)
        self.assertEqual(result['status'], 'CHECK')

    def test_no_nearest_day_fallback(self):
        result = self.report(workers=[worker(weaving_date='2026-10-01')])
        self.assertIsNone(result['rolls'][0]['worker'])

    def test_missing_sop_cannot_match_blank_worker_sop(self):
        self.assertIsNone(self.report(machines=[machine(sop_no=None)], workers=[worker(sop_no=None)])['rolls'][0]['worker'])

    def test_roll_count_and_length_mismatch(self):
        self.assertEqual(self.report(machines=[])['status'], 'CHECK')
        self.assertEqual(self.report(machines=[machine(length_meters=Decimal('99'))])['status'], 'CHECK')

    def test_machine_prefix_and_invalid_roll_dates(self):
        self.assertEqual(roll_date('PWEVM04260703-7', 'WEVM04'), '2026-07-03')
        self.assertIsNone(roll_date('PWEV012260231-1', 'WEV012'))
        self.assertIsNone(roll_date('PWEV099260930-1', 'WEV012'))

    def test_business_mismatch_is_flagged(self):
        result = self.report(machines=[machine(lot_no='OTHER')])
        self.assertEqual(result['matched_rolls'], 0)
        self.assertEqual(result['status'], 'CHECK')


class HeaderTests(unittest.TestCase):
    def test_order_quantity_subheaders_and_extra_term_alias(self):
        headers = ['PK #', 'OUT NO', 'DATE', 'PO #', 'ORDER #', 'ITEM NO', 'FABRIC', 'LOT #', 'INVOICE NO', 'QTY', 'Term', '', '']
        subs = ['A'] * 9 + ['ROLL', 'KGS', 'YDS', 'MTS']
        row = ['PK1', 'OUT1', '2026-10-02', 'PO1', 'ORDER1', 'ITEM1', 'Fabric', 'LOT1', 'PD1', 1, 20, 109, 100]
        result = parse_source([headers, subs, row], 'order')
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]['quantity'], '1')
        self.assertEqual(json.loads(result[0]['raw_data_json'])['columns'][-4:], ['QTY / ROLL', 'QTY / KGS', 'QTY / YDS', 'QTY / MTS'])

    def test_wrong_file_rejected(self):
        with self.assertRaises(ValueError):
            parse_source([['DATE', 'SOP #']], 'order')


if __name__ == '__main__':
    unittest.main()
