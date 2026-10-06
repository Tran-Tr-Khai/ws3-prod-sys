import asyncio
from datetime import date, datetime, timezone
from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from openpyxl import load_workbook
from PIL import Image

from app.api.routes import buffing


class BuffingExcelExportTests(unittest.TestCase):
    def test_report_embeds_primary_photo_instead_of_a_filename(self):
        with TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            photo_path = root / "inspection.jpg"
            Image.new("RGB", (320, 180), color=(40, 120, 80)).save(photo_path)
            image = SimpleNamespace(file_path=photo_path.name, is_primary=True, original_name="inspection.jpg")
            check = SimpleNamespace(
                checked_at=datetime(2026, 10, 3, 3, 15, tzinfo=timezone.utc),
                order_number="PKP261003-001",
                operator_name="Worker A",
                operator_identifier="A001",
                shift="CA A",
                check_1=True,
                check_2=False,
                check_3=True,
                check_4=True,
                check_5=True,
                remark="",
                images=[image],
            )
            db = SimpleNamespace(scalars=lambda _statement: SimpleNamespace(all=lambda: [check]))

            with patch.object(buffing, "media_root", return_value=root):
                response = buffing.export_buffing_checks(
                    check_date=date(2026, 10, 3), machine_id="BU-01",
                    language="vi", db=db, _user=object(), order_number=None,
                )
                content = asyncio.run(self._read_body(response))

            workbook = load_workbook(BytesIO(content))
            sheet = workbook["Buffing"]
            self.assertEqual(len(sheet._images), 1)
            self.assertEqual(sheet._images[0].anchor._from.row, 4)
            self.assertEqual(sheet._images[0].anchor._from.col, 11)
            self.assertEqual(sheet["F5"].value, "ĐẠT")
            self.assertEqual(sheet["G5"].value, "KHÔNG ĐẠT")
            self.assertIsNone(sheet["L5"].value)

    @staticmethod
    async def _read_body(response) -> bytes:
        return b"".join([chunk async for chunk in response.body_iterator])


if __name__ == "__main__":
    unittest.main()
