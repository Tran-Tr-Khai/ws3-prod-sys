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
    def __init__(self, record, inspections=None):
        self.record = record
        self.inspections = inspections or []
        self.calls = 0

    def scalars(self, _statement):
        self.calls += 1
        return RecordResult([self.record] if self.calls == 1 else self.inspections)


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
        merged_ranges = {str(item) for item in workbook["Scouring"].merged_cells.ranges}
        self.assertNotIn("A4:A5", merged_ranges)
        self.assertNotIn("U4:U5", merged_ranges)
        self.assertNotIn("V4:V5", merged_ranges)
        self.assertEqual(workbook["Scouring"]["A5"].value, "TEST pH")
        self.assertEqual(workbook["Scouring"]["U5"].value, "KẾT QUẢ")
        self.assertEqual(workbook["Scouring"]["V5"].value, "TIẾN ĐỘ ĐƠN")
        self.assertEqual(workbook["Scouring"]["I4"].border.right.style, "medium")
        self.assertEqual(workbook["Scouring"]["J4"].border.left.style, "medium")
        self.assertEqual(workbook["Scouring"]["C5"].border.right.color.rgb, "009FB0B8")
        self.assertEqual(workbook["Scouring"]["I5"].border.right.color.rgb, "00385466")
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
        inspection = SimpleNamespace(
            id=4,
            scouring_record_id=1,
            inspected_at=datetime(2026, 10, 7, 9, tzinfo=timezone.utc),
            operator_name="Inspector",
            note="Checked",
            **{f"tank_{index}_ph": 7.0 + index / 10 for index in range(8)},
        )
        workbook = self.load_export(export_scouring_records(None, None, None, None, "vi", OneRecordDatabase(record, [inspection]), None))
        sheet = workbook["Scouring"]

        self.assertEqual(sheet["I5"].border.right.style, "medium")
        self.assertEqual(sheet["J5"].border.left.style, "medium")
        self.assertEqual(sheet["J6"].border.right.style, "thin")
        self.assertEqual(sheet["J6"].border.right.color.rgb, "009FB0B8")
        self.assertIsNone(sheet["K6"].border.left)
        self.assertEqual(sheet["A6"].value, "XEM (1)")
        self.assertEqual(sheet["A6"].hyperlink.target, "#'pH inspections'!A2")
        self.assertEqual(sheet["C6"].value, "PKP-001")
        self.assertEqual(sheet["B6"].number_format, "dd/mm/yyyy - hh:mm")
        self.assertEqual(sheet["V6"].value, "ĐANG XỬ LÝ")
        self.assertEqual(workbook["pH inspections"]["A2"].value, 1)
        self.assertEqual(workbook["pH inspections"]["C2"].value, "PKP-001")


if __name__ == "__main__":
    unittest.main()
