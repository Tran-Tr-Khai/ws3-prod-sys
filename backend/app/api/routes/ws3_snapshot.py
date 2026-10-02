import json
import re
import unicodedata
from datetime import datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3ProductionPlan, WS3WorkerRecord
from app.security.auth import get_current_user, role_codes


router = APIRouter(prefix="/ws3", tags=["ws3-snapshot"])

_PLAN_COLUMN_LABELS = [
    "", "odgood", "mcnm",
    "dyeing request / date", "dyeing request / sop #", "dyeing request / lotno",
    "dyeing request / roll", "dyeing request / kgs", "dyeing request / yds",
    "customer", "po #", "order #", "style #", "item no", "fabric",
    "spec / width", "spec / gm2", "deliv", "lot #", "machine", "grade",
    "stock / roll", "stock / kgs", "stock / qty", "plno",
    "plan / date", "plan / roll", "plan / kgs", "plan / qty", "remark", "v",
]
_ORDER_COLUMN_LABELS = [
    "", "PK #", "OUT NO", "DATE", "CUSTOMER", "PO #", "ORDER #", "ITEM NO",
    "FABRIC", "SPEC", "COLOR", "LOT #", "QTY / ROLL", "QTY / KGS",
    "QTY / YDS", "QTY / MTS", "SHIPMENT PLACE", "INVOICE NO", "REMARK",
    "JOB (CLICK)", "JOB (PRINT)",
]
_WORKER_COLUMN_LABELS = [
    "", "DATE", "SHIFT", "CUSTOMER", "PO #", "ORDER #", "ITEM NO", "FABRIC",
    "STYLE #", "COLOR", "SOP #", "LOT #", "MACHINE", "QTY UNIT",
    "PRODUCTION QTY / ROLL", "PRODUCTION QTY / KGS", "PRODUCTION QTY / YDS",
    "PRODUCTION QTY / MTS", "WORKER",
]

_WAREHOUSE_COLUMN_LABELS = {
    "plan": _PLAN_COLUMN_LABELS,
    "order": _ORDER_COLUMN_LABELS,
    "worker": _WORKER_COLUMN_LABELS,
}


def _text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _header(value: object) -> str:
    text = unicodedata.normalize("NFKD", _text(value)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", text).strip()


def _date(value: object) -> str:
    text = _text(value)
    if not text:
        return ""
    for pattern in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text[:10], pattern).date().isoformat()
        except ValueError:
            continue
    if re.fullmatch(r"\d{8}", text):
        try:
            return datetime.strptime(text, "%Y%m%d").date().isoformat()
        except ValueError:
            pass
    if re.fullmatch(r"\d{6}", text):
        try:
            return datetime.strptime(text, "%y%m%d").date().isoformat()
        except ValueError:
            pass
    return text


def _machine(value: object) -> str:
    text = _text(value).upper()
    match = re.search(r"(?:P)?WEV[- ]?(\d+)", text)
    if match:
        return f"WEV{int(match.group(1)):03d}"
    if text.isdigit():
        return f"WEV{int(text):03d}"
    return text


def _decimal(value: str) -> Decimal | None:
    try:
        return Decimal(value.replace(",", "")) if value else None
    except InvalidOperation:
        return None


def _require_supervisor(user: User) -> None:
    if not role_codes(user).intersection({"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor access is required")


async def _read_upload(file: UploadFile) -> tuple[str, list[list[object]]]:
    filename = file.filename or "source"
    suffix = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    content = await file.read()
    if suffix == "xls":
        import xlrd
        from xlrd.xldate import xldate_as_datetime

        workbook = xlrd.open_workbook(file_contents=content, on_demand=True)
        sheet = workbook.sheet_by_index(0)
        return filename, [[xldate_as_datetime(cell.value, workbook.datemode) if cell.ctype == xlrd.XL_CELL_DATE else cell.value for cell in sheet.row(row)] for row in range(sheet.nrows)]
    if suffix == "xlsx":
        from openpyxl import load_workbook

        workbook = load_workbook(filename=BytesIO(content), read_only=True, data_only=True)
        return filename, [list(row) for row in workbook.active.iter_rows(values_only=True)]
    raise HTTPException(status_code=415, detail="Each source must be an XLS or XLSX file")


def _header_row(values: list[list[object]], required: set[str]) -> tuple[int, list[str]]:
    for row_index, row in enumerate(values[:30]):
        headers = [_header(value) for value in row]
        if required.issubset(set(headers)):
            return row_index, headers
    raise HTTPException(status_code=422, detail=f"Could not find required columns: {', '.join(sorted(required))}")


def _column(headers: list[str], *names: str) -> int | None:
    wanted = {_header(name) for name in names}
    return next((index for index, value in enumerate(headers) if value in wanted), None)


def _value(row: list[object], index: int | None) -> str:
    return _text(row[index]) if index is not None and index < len(row) else ""


def _raw(row: list[object], headers: list[str]) -> str:
    """Preserve every original cell, alongside its source-column position/name."""
    return json.dumps({"columns": headers, "row": [_text(value) for value in row]}, ensure_ascii=False)


def _data_rows(values: list[list[object]], start: int, date_index: int | None = None) -> list[list[object]]:
    result: list[list[object]] = []
    for row in values[start:]:
        if not any(_text(value) for value in row):
            continue
        if date_index is not None:
            candidate = _value(row, date_index)
            if candidate and _header(candidate) == "date":
                continue
            if candidate and not re.search(r"\d", candidate):
                continue
        result.append(row)
    return result


def _parse_plan(values: list[list[object]]) -> list[dict[str, object]]:
    # PLAN exports have a descriptive/group heading followed by the actual
    # column-name row. Pick the row with the most recognizable leaf columns,
    # not merely the first row that happens to contain SOP# and LOTNO.
    plan_headers = {
        "date", "sop #", "sop#", "lotno", "lot no", "roll", "kgs", "yds",
        "width", "gm2", "delv", "lot #", "machine", "grade", "qty", "remark",
    }
    candidates: list[tuple[int, int, list[str]]] = []
    for row_index, row in enumerate(values[:30]):
        headers = [_header(value) for value in row]
        normalized = set(headers)
        if {"sop #", "sop#"}.isdisjoint(normalized) or not normalized.intersection({"lotno", "lot no"}):
            continue
        candidates.append((sum(header in plan_headers for header in headers), row_index, headers))
    if not candidates:
        header_row, headers = _header_row(values, {"sop #", "lotno"})
    else:
        _, header_row, headers = max(candidates, key=lambda item: (item[0], item[1]))
    # This PLAN export has a two-tier header: the lower row contains a mix of
    # field names and aliases (A, B, I-N, Q-T, X, AD), while the upper row and
    # merged group labels provide the real meanings. Keep a semantic label for
    # each source column so the warehouse never exposes those Excel aliases.
    headers = [
        _PLAN_COLUMN_LABELS[index] if index < len(_PLAN_COLUMN_LABELS) else column_header
        for index, column_header in enumerate(headers)
    ]
    records = []
    for row in _data_rows(values, header_row + 1, 3):
        records.append({
            "plan_date": _date(_value(row, 3)) or None, "sop_no": _value(row, 4) or None,
            "machine_no": _machine(_value(row, 5)) or None, "roll_required": _value(row, 6) or None,
            "po_no": _value(row, 10) or None, "source_order_no": _value(row, 11) or None,
            "item_code": _value(row, 13) or None, "item_name": _value(row, 14) or None,
            "raw_data_json": _raw(row, headers),
        })
    return records


def _parse_orders(values: list[list[object]]) -> list[dict[str, object]]:
    header_row, headers = _header_row(values, {"pk #", "out no"})
    fields = {"date": _column(headers, "date"), "pk_no": _column(headers, "pk #"), "out_no": _column(headers, "out no"), "po_no": _column(headers, "po #"), "source_order_no": _column(headers, "order #"), "item_code": _column(headers, "item no"), "item_name": _column(headers, "fabric"), "lot_no": _column(headers, "lot #"), "quantity": _column(headers, "qty")}
    # ORDEROFWS3 also uses a two-row header. The first row provides actual
    # field names; the second contains aliases and units under the merged QTY
    # heading. Preserve those useful labels in the warehouse, not A/B/C codes.
    display_headers = [
        _ORDER_COLUMN_LABELS[index] if index < len(_ORDER_COLUMN_LABELS) else column_header
        for index, column_header in enumerate(headers)
    ]
    return [{"production_date": _date(_value(row, fields["date"])) or None, **{key: _value(row, index) or None for key, index in fields.items() if key != "date"}, "raw_data_json": _raw(row, display_headers)} for row in _data_rows(values, header_row + 1, fields["date"])]


def _parse_machine(values: list[list[object]]) -> list[dict[str, object]]:
    header_row, headers = _header_row(values, {"roll #", "machine", "sop #"})
    fields = {"date": _column(headers, "date"), "roll_id": _column(headers, "roll #"), "machine_no": _column(headers, "machine"), "sop_no": _column(headers, "sop #"), "po_no": _column(headers, "po #"), "source_order_no": _column(headers, "order #"), "item_code": _column(headers, "item no"), "item_name": _column(headers, "fabric"), "lot_no": _column(headers, "lot #"), "length": _column(headers, "mts")}
    records = []
    for row in _data_rows(values, header_row + 1, fields["date"]):
        roll_id = _value(row, fields["roll_id"])
        roll_date = re.search(r"PWEV\d+(\d{6})-\d+", roll_id.upper())
        records.append({"weaving_date": _date(roll_date.group(1)) if roll_date else (_date(_value(row, fields["date"])) or None), "roll_id": roll_id or None, "machine_no": _machine(_value(row, fields["machine_no"]) or roll_id) or None, "sop_no": _value(row, fields["sop_no"]) or None, "po_no": _value(row, fields["po_no"]) or None, "source_order_no": _value(row, fields["source_order_no"]) or None, "item_code": _value(row, fields["item_code"]) or None, "item_name": _value(row, fields["item_name"]) or None, "lot_no": _value(row, fields["lot_no"]) or None, "length_meters": _decimal(_value(row, fields["length"])), "raw_data_json": _raw(row, headers)})
    return records


def _parse_workers(values: list[list[object]]) -> list[dict[str, object]]:
    header_row, headers = _header_row(values, {"date", "shift", "machine", "worker"})
    subheaders = [_header(value) for value in values[header_row + 1]] if header_row + 1 < len(values) else []
    production_quantity = _column(headers, "production qty")
    quantity_roll = next((index for index, value in enumerate(subheaders) if value == "roll" and (production_quantity is None or index >= production_quantity)), None)
    quantity_kgs = next((index for index, value in enumerate(subheaders) if value == "kgs" and (production_quantity is None or index >= production_quantity)), None)
    quantity_yds = next((index for index, value in enumerate(subheaders) if value == "yds" and (production_quantity is None or index >= production_quantity)), None)
    quantity_mts = next((index for index, value in enumerate(subheaders) if value == "mts" and (production_quantity is None or index >= production_quantity)), None)
    fields = {"date": _column(headers, "date"), "shift": _column(headers, "shift"), "worker": _column(headers, "worker"), "customer": _column(headers, "customer"), "po_no": _column(headers, "po #"), "source_order_no": _column(headers, "order #"), "item_code": _column(headers, "item no"), "item_name": _column(headers, "fabric"), "sop_no": _column(headers, "sop #"), "lot_no": _column(headers, "lot #"), "machine_no": _column(headers, "machine"), "quantity": quantity_roll, "length": quantity_mts}
    return [{"weaving_date": _date(_value(row, fields["date"])) or None, **{key: (_machine(_value(row, index)) if key == "machine_no" else _value(row, index)) or None for key, index in fields.items() if key not in {"date", "length"}}, "length_meters": _decimal(_value(row, fields["length"])), "raw_data_json": _raw(row, [_WORKER_COLUMN_LABELS[index] if index < len(_WORKER_COLUMN_LABELS) else header for index, header in enumerate(headers)])} for row in _data_rows(values, header_row + 1, fields["date"])]


@router.post("/data-snapshot")
async def replace_data_snapshot(
    plan_file: UploadFile | None = File(default=None), order_file: UploadFile | None = File(default=None), machine_file: UploadFile | None = File(default=None), worker_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_supervisor(user)
    uploads = {"plan": plan_file, "order": order_file, "machine": machine_file, "worker": worker_file}
    selected = {key: file for key, file in uploads.items() if file is not None}
    if not selected:
        raise HTTPException(status_code=422, detail="Select at least one source file")
    files: dict[str, str] = {}
    parsed: dict[str, list[dict[str, object]]] = {}
    parsers = {"plan": _parse_plan, "order": _parse_orders, "machine": _parse_machine, "worker": _parse_workers}
    for key, file in selected.items():
        filename, values = await _read_upload(file)
        files[key] = filename
        parsed[key] = parsers[key](values)
        if not parsed[key]:
            raise HTTPException(status_code=422, detail=f"The {key} file must contain at least one data row")
    try:
        models = {"plan": WS3ProductionPlan, "order": WS3ProductionOrder, "machine": WS3MachineWS2Record, "worker": WS3WorkerRecord}
        for key, rows in parsed.items():
            model = models[key]
            db.execute(delete(model))
            db.bulk_insert_mappings(model, rows)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {
        "status": "REPLACED",
        "files": files,
        "updated": {"plans": len(parsed["plan"]) if "plan" in parsed else None, "orders": len(parsed["order"]) if "order" in parsed else None, "machines": len(parsed["machine"]) if "machine" in parsed else None, "workers": len(parsed["worker"]) if "worker" in parsed else None},
        "counts": {"plans": db.query(WS3ProductionPlan).count(), "orders": db.query(WS3ProductionOrder).count(), "machines": db.query(WS3MachineWS2Record).count(), "workers": db.query(WS3WorkerRecord).count()},
    }


def _matching_workers(
    machine: WS3MachineWS2Record,
    workers_by_machine_day: dict[tuple[str, str], list[WS3WorkerRecord]],
    all_workers: list[WS3WorkerRecord] | None = None,
) -> list[WS3WorkerRecord]:
    def matches_business_key(candidate: WS3WorkerRecord) -> bool:
        for attr in ("sop_no", "po_no", "source_order_no", "item_code", "lot_no"):
            machine_value = getattr(machine, attr)
            worker_value = getattr(candidate, attr)
            if machine_value and worker_value and machine_value != worker_value:
                return False
        return True

    candidates = [item for item in workers_by_machine_day.get((machine.machine_no or "", machine.weaving_date or ""), []) if matches_business_key(item)]
    if not candidates and all_workers:
        # Some worker exports use the work date while the roll ID uses the
        # weaving date.  If the exact day is absent, retain the business key
        # and machine constraints and use the closest available worker day.
        fallback = [item for item in all_workers if item.machine_no == machine.machine_no and matches_business_key(item)]
        if fallback and machine.weaving_date:
            try:
                target = datetime.strptime(machine.weaving_date, "%Y-%m-%d").date()
                closest_distance = min(abs((datetime.strptime(item.weaving_date, "%Y-%m-%d").date() - target).days) for item in fallback if item.weaving_date)
                candidates = [item for item in fallback if item.weaving_date and abs((datetime.strptime(item.weaving_date, "%Y-%m-%d").date() - target).days) == closest_distance]
            except ValueError:
                candidates = fallback

    # Repeated snapshot rows are not multiple operators. Resolve duplicates
    # by the actual shift/operator pair before declaring the roll ambiguous.
    unique: dict[tuple[str, str], WS3WorkerRecord] = {}
    for item in candidates:
        unique.setdefault((item.shift or "", item.worker or ""), item)
    return list(unique.values())


@router.get("/production-orders")
def production_order_report(production_date: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, object]:
    _require_supervisor(user)
    orders = db.scalars(select(WS3ProductionOrder).where(WS3ProductionOrder.production_date == production_date)).all()
    plans = db.scalars(select(WS3ProductionPlan)).all()
    machines = db.scalars(select(WS3MachineWS2Record)).all()
    workers = db.scalars(select(WS3WorkerRecord)).all()
    plan_exact: dict[tuple[str, str, str], list[WS3ProductionPlan]] = {}
    plan_fallback: dict[tuple[str, str], list[WS3ProductionPlan]] = {}
    for item in plans:
        plan_exact.setdefault((item.item_code or "", item.po_no or "", item.source_order_no or ""), []).append(item)
        plan_fallback.setdefault((item.item_code or "", item.source_order_no or ""), []).append(item)
    machines_by_key: dict[tuple[str, str], list[WS3MachineWS2Record]] = {}
    for item in machines:
        machines_by_key.setdefault((item.machine_no or "", item.weaving_date or ""), []).append(item)
    workers_by_machine_day: dict[tuple[str, str], list[WS3WorkerRecord]] = {}
    for item in workers:
        workers_by_machine_day.setdefault((item.machine_no or "", item.weaving_date or ""), []).append(item)
    grouped: dict[str, list[WS3ProductionOrder]] = {}
    for item in orders:
        grouped.setdefault(item.pk_no or item.out_no or f"row-{item.id}", []).append(item)
    result = []
    for pk_no, lines in grouped.items():
        sample = lines[0]
        matched_plans = plan_exact.get((sample.item_code or "", sample.po_no or "", sample.source_order_no or ""), []) or plan_fallback.get((sample.item_code or "", sample.source_order_no or ""), [])
        # PLAN is a schedule snapshot and can contain many historical rows for
        # the same PO/order.  Select the schedule day nearest to the report
        # date before resolving the actual MACHINE_WS2 rolls; otherwise the
        # first historical machine is chosen arbitrarily.
        if matched_plans and sample.production_date:
            plan_dates = sorted({item.plan_date for item in matched_plans if item.plan_date})
            if plan_dates:
                prior_dates = [item for item in plan_dates if item <= sample.production_date]
                selected_date = max(prior_dates) if prior_dates else min(plan_dates)
                matched_plans = [item for item in matched_plans if item.plan_date == selected_date]
        candidates: list[WS3MachineWS2Record] = []
        for plan in matched_plans:
            candidates.extend(
                item for item in machines_by_key.get((plan.machine_no or "", plan.plan_date or ""), [])
                if item.po_no == sample.po_no and item.source_order_no == sample.source_order_no
                and item.item_code == sample.item_code and item.lot_no == sample.lot_no
            )
        # Keep the plan/machine relationship as the primary path.  The
        # business-key fallback is useful for legacy exports where the roll
        # date in the ID and the PLAN date are off by one day.
        if not candidates:
            candidates = [
                item for item in machines
                if item.po_no == sample.po_no and item.source_order_no == sample.source_order_no
                and item.item_code == sample.item_code and item.lot_no == sample.lot_no
                and item.machine_no in {plan.machine_no for plan in matched_plans}
            ]
        unique_machines = list({item.roll_id or f"row-{item.id}": item for item in candidates}.values())[:len(lines)]
        warnings: list[str] = []
        if not matched_plans:
            warnings.append("Không tìm thấy PLAN phù hợp.")
        if len(unique_machines) < len(lines):
            warnings.append(f"Thiếu {len(lines) - len(unique_machines)} roll từ MACHINE_WS2.")
        rolls = []
        for index, line in enumerate(lines):
            machine = unique_machines[index] if index < len(unique_machines) else None
            worker_matches = _matching_workers(machine, workers_by_machine_day, workers) if machine else []
            if machine and len(worker_matches) != 1:
                warnings.append(f"Không xác định duy nhất ca/công nhân cho roll {machine.roll_id or line.out_no}.")
            worker = worker_matches[0] if len(worker_matches) == 1 else None
            rolls.append({"out_no": line.out_no, "roll_id": machine.roll_id if machine else None, "machine_no": machine.machine_no if machine else None, "weaving_date": machine.weaving_date if machine else None, "length_meters": float(machine.length_meters) if machine and machine.length_meters is not None else None, "shift": worker.shift if worker else None, "worker": worker.worker if worker else None})
        result.append({"pk_no": pk_no, "production_date": sample.production_date, "item_code": sample.item_code, "item_name": sample.item_name, "lot_no": sample.lot_no, "sop_no": matched_plans[0].sop_no if matched_plans else None, "machine_no": matched_plans[0].machine_no if matched_plans else None, "expected_rolls": len(lines), "matched_rolls": len(unique_machines), "status": "READY" if not warnings else "CHECK", "warnings": list(dict.fromkeys(warnings)), "rolls": rolls})
    return {"production_date": production_date, "summary": {"orders": len(result), "ready": sum(item["status"] == "READY" for item in result), "check": sum(item["status"] != "READY" for item in result)}, "orders": result}


@router.get("/data-snapshot/status")
def data_snapshot_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, int]:
    _require_supervisor(user)
    return {"plans": db.query(WS3ProductionPlan).count(), "orders": db.query(WS3ProductionOrder).count(), "machines": db.query(WS3MachineWS2Record).count(), "workers": db.query(WS3WorkerRecord).count()}


_WAREHOUSE_SOURCES = {
    "plan": (WS3ProductionPlan, WS3ProductionPlan.plan_date, (WS3ProductionPlan.sop_no, WS3ProductionPlan.machine_no, WS3ProductionPlan.item_code, WS3ProductionPlan.item_name, WS3ProductionPlan.po_no, WS3ProductionPlan.source_order_no)),
    "order": (WS3ProductionOrder, WS3ProductionOrder.production_date, (WS3ProductionOrder.pk_no, WS3ProductionOrder.out_no, WS3ProductionOrder.po_no, WS3ProductionOrder.source_order_no, WS3ProductionOrder.item_code, WS3ProductionOrder.item_name, WS3ProductionOrder.lot_no)),
    "machine": (WS3MachineWS2Record, WS3MachineWS2Record.weaving_date, (WS3MachineWS2Record.roll_id, WS3MachineWS2Record.machine_no, WS3MachineWS2Record.sop_no, WS3MachineWS2Record.po_no, WS3MachineWS2Record.source_order_no, WS3MachineWS2Record.item_code, WS3MachineWS2Record.item_name, WS3MachineWS2Record.lot_no)),
    "worker": (WS3WorkerRecord, WS3WorkerRecord.weaving_date, (WS3WorkerRecord.shift, WS3WorkerRecord.worker, WS3WorkerRecord.machine_no, WS3WorkerRecord.sop_no, WS3WorkerRecord.po_no, WS3WorkerRecord.source_order_no, WS3WorkerRecord.item_code, WS3WorkerRecord.item_name, WS3WorkerRecord.lot_no)),
}


def _require_admin(user: User) -> None:
    if "ADMIN" not in role_codes(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required")


@router.get("/admin/data-warehouse/summary")
def admin_data_warehouse_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, object]:
    _require_admin(user)
    summary: dict[str, object] = {}
    for key, (model, date_column, _) in _WAREHOUSE_SOURCES.items():
        count, first_date, last_date, updated_at = db.query(
            func.count(model.id), func.min(date_column), func.max(date_column), func.max(model.created_at)
        ).one()
        summary[key] = {"count": count, "first_date": first_date, "last_date": last_date, "updated_at": updated_at.isoformat() if updated_at else None}
    return summary


@router.get("/admin/data-warehouse/{source}")
def admin_data_warehouse_records(
    source: str,
    q: str = "",
    date: str = "",
    offset: int = 0,
    limit: int = 50,
    sort_by: int | None = None,
    sort_dir: str = "asc",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    _require_admin(user)
    if source not in _WAREHOUSE_SOURCES:
        raise HTTPException(status_code=404, detail="Unknown data source")
    if offset < 0 or limit < 1 or limit > 200:
        raise HTTPException(status_code=422, detail="Invalid pagination values")
    if sort_by is not None and sort_by < 0:
        raise HTTPException(status_code=422, detail="Invalid sort column")
    if sort_dir not in {"asc", "desc"}:
        raise HTTPException(status_code=422, detail="Invalid sort direction")
    model, date_column, searchable_columns = _WAREHOUSE_SOURCES[source]
    query = db.query(model)
    if date:
        query = query.filter(date_column == date)
    if q.strip():
        term = f"%{q.strip()}%"
        query = query.filter(or_(*(column.ilike(term) for column in searchable_columns), model.raw_data_json.ilike(term)))
    total = query.count()
    if sort_by is None:
        rows = query.order_by(model.id).offset(offset).limit(limit).all()
    else:
        # Raw rows are JSON stored as text. Sort the complete filtered result
        # before pagination so page boundaries follow the selected column.
        sortable_rows = query.order_by(model.id).all()

        def sort_key(row: object) -> tuple[int, object]:
            try:
                raw = json.loads(row.raw_data_json or "{}")
                values = raw.get("row", []) if isinstance(raw, dict) else []
                value = _text(values[sort_by]) if sort_by < len(values) else ""
            except (TypeError, json.JSONDecodeError):
                value = ""
            if not value:
                return (1, "")
            normalized_date = _date(value)
            if re.fullmatch(r"\d{4}-\d{2}-\d{2}", normalized_date):
                return (0, (0, normalized_date))
            numeric = _decimal(value)
            if numeric is not None:
                return (0, (1, numeric))
            return (0, (2, value.casefold()))

        non_empty = [row for row in sortable_rows if sort_key(row)[0] == 0]
        empty = [row for row in sortable_rows if sort_key(row)[0] == 1]
        non_empty.sort(key=sort_key, reverse=sort_dir == "desc")
        rows = (non_empty + empty)[offset:offset + limit]
    records = []
    for row in rows:
        try:
            raw_data = json.loads(row.raw_data_json or "{}")
        except (TypeError, json.JSONDecodeError):
            raw_data = {"row": [row.raw_data_json or ""]}
        # Older snapshots may have been saved with the Excel row of letter
        # aliases (A/B/C or I/J/K) as the warehouse header. Replace only the
        # display labels here; cell positions and source values stay intact.
        column_labels = _WAREHOUSE_COLUMN_LABELS.get(source)
        if column_labels:
            original_columns = raw_data.get("columns", [])
            source_row = raw_data.get("row", [])
            column_count = max(len(original_columns), len(source_row))
            raw_data["columns"] = [
                column_labels[index] if index < len(column_labels) else _text(label)
                for index, label in enumerate(original_columns[:column_count] + [""] * max(0, column_count - len(original_columns)))
            ]
        records.append({"id": row.id, "date": getattr(row, date_column.key), "created_at": row.created_at.isoformat() if row.created_at else None, "raw_data": raw_data})
    return {"source": source, "total": total, "offset": offset, "limit": limit, "records": records}
