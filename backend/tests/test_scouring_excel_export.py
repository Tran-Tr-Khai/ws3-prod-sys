import asyncio
import unittest
from datetime import datetime, timezone
from io import BytesIO
from types import SimpleNamespace

from openpyxl import load_workbook

from app.api.routes.scouring import export_scouring_records


class EmptyResult:
    def all(self):
        return []


class EmptyDatabase:
    def scalars(self, _statement):
        return EmptyResult()


class RecordResult:
    def __init__(self, rows):
        self.rows = rows

    def all(self):
        return self.rows


class OneRecordDatabase:
    def __init__(self, record):
        self.record = record
        self.calls = 0

    def scalars(self, _statement):
        self.calls += 1
        return RecordResult([self.record] if self.calls == 1 else [])


class ScouringExcelExportTests(unittest.TestCase):
    @staticmethod
    def load_export(response):
        async def read_body():
            return b"".join([chunk async for chunk in response.body_iterator])

        return load_workbook(BytesIO(asyncio.run(read_body())))

    def test_export_creates_grouped_headers_and_ph_sheet_without_records(self):
        response = export_scouring_records(
            record_date=None,
            order_progress=None,
            result=None,
            search=None,
            language="vi",
            db=EmptyDatabase(),
            _user=None,
        )

        workbook = self.load_export(response)

        self.assertEqual(workbook.sheetnames, ["Scouring", "pH inspections"])
        self.assertIn("A4:A5", {str(item) for item in workbook["Scouring"].merged_cells.ranges})
        self.assertIn("V4:V5", {str(item) for item in workbook["Scouring"].merged_cells.ranges})
        self.assertEqual(workbook["Scouring"]["A4"].value, "TIẾN ĐỘ ĐƠN")
        self.assertEqual(workbook["Scouring"]["V4"].value, "KẾT QUẢ")
        self.assertEqual(workbook["Scouring"]["J4"].border.right.style, "medium")
        self.assertEqual(workbook["Scouring"]["K4"].border.left.style, "medium")
        self.assertEqual(workbook["Scouring"]["C5"].border.right.color.rgb, "009FB0B8")
        self.assertEqual(workbook["Scouring"]["J5"].border.right.color.rgb, "00385466")
        self.assertEqual(workbook["Scouring"].max_column, 22)
        self.assertEqual(workbook["Scouring"].max_row, 5)

    def test_group_separators_are_kept_in_header_but_not_emphasized_in_rows(self):
        record = SimpleNamespace(
            id=1,
            recorded_at=datetime(2026, 10, 7, 8, tzinfo=timezone.utc),
            order_progress="IN_PROGRESS",
            machine_id="SC-01",
            order_number="PKP-001",
            item="Fabric",
            lot_yarn=None,
            lot_number="LOT-1",
            operator_name="Operator",
            operator_identifier="1001",
            shift="A",
            naoh=1,
            soap=2,
            desizer=3,
            h2o2=4,
            chelate=5,
            speed=45,
            temperature=94,
            cylinder_temperature=90,
            input_fabric_meters=100,
            output_fabric_meters=98,
            loss_meters=2,
        )
        response = export_scouring_records(None, None, None, None, "vi", OneRecordDatabase(record), None)
        sheet = self.load_export(response)["Scouring"]

        self.assertEqual(sheet["J5"].border.right.style, "medium")
        self.assertEqual(sheet["K5"].border.left.style, "medium")
        self.assertEqual(sheet["J6"].border.right.style, "thin")
        self.assertEqual(sheet["J6"].border.right.color.rgb, "009FB0B8")
        self.assertIsNone(sheet["K6"].border.left)


if __name__ == "__main__":
    unittest.main()
