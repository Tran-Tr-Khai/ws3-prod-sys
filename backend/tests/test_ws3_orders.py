"""Regression tests for the WS3 order-import normalization boundary."""

import unittest

from app.api.routes.ws3_orders import _dedupe_rows, _normalise_mes_values


class WS3OrderImportTests(unittest.TestCase):
    """Protect MES header normalization and import deduplication behavior."""

    def test_normalization_skips_a_repeated_header_row(self) -> None:
        """Repeated MES headers must not become an importable data row."""
        headers = [
            "DATE", "SHIFT", "CUSTOMER", "PO #", "ORDER #", "ITEM NO",
            "FABRIC", "STYLE #", "COLOR", "SOP #", "LOT #", "MACHINE",
            "ROLL", "KGS", "YDS", "MTS", "WORKER",
        ]
        values = [
            headers,
            [
                "2026-10-02", "CA A", "Customer A", "PO-1", "ORDER-1",
                "ITEM-1", "Fabric A", "Style A", "Grey", "SOP-1", "LOT-1",
                "M-01", "1", "0", "0", "1,200", "Worker A",
            ],
            headers,
        ]

        columns, rows, ignored_rows = _normalise_mes_values(values)

        self.assertIn("DATE", columns)
        self.assertEqual(rows, [{column: value for column, value in zip(columns, values[1], strict=False)}])
        self.assertEqual(ignored_rows, 1)

    def test_deduplication_marks_duplicate_and_incomplete_rows(self) -> None:
        """Only complete, unseen MES business keys are eligible for import."""
        complete = {
            "DATE": "2026/10/02",
            "SHIFT": "CA A",
            "MACHINE": "M-01",
            "SOP #": "SOP-1",
            "LOT #": "LOT-1",
            "MTS": "1,200",
        }
        duplicate = {**complete, "MTS": "1200.0"}
        incomplete = {key: value for key, value in complete.items() if key != "MTS"}

        new_indexes, duplicate_indexes, incomplete_indexes = _dedupe_rows(
            [complete, duplicate, incomplete],
            existing_keys=set(),
        )

        self.assertEqual(new_indexes, [0])
        self.assertEqual(duplicate_indexes, {1})
        self.assertEqual(incomplete_indexes, {2})
