import json
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.services.snapshot_sources import read_excel, parse_source
from app.services.snapshot_report import build_report
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_sop_code
from app.security.auth import get_current_user, role_codes
from app.security.authorization import MANAGER_ROLES


router = APIRouter(prefix="/ws3", tags=["ws3-snapshot"])

def _text(value: object) -> str:
    """Convert a spreadsheet value to a stable display and comparison string."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def _date(value: object) -> str:
    """Normalize supported spreadsheet date formats to ISO `YYYY-MM-DD`."""
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


def _decimal(value: str) -> Decimal | None:
    """Parse a human-readable numeric cell without raising on invalid input."""
    try:
        return Decimal(value.replace(",", "")) if value else None
    except InvalidOperation:
        return None


def _require_supervisor(user: User) -> None:
    """
    Restrict snapshot replacement and reports to management roles.

    Args:
        user: Authenticated MES user.

    Raises:
        HTTPException: 403 when the user is not a manager.
    """
    if not role_codes(user).intersection(MANAGER_ROLES):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Supervisor access is required")


async def _read_upload(file: UploadFile) -> tuple[str, list[list[object]]]:
    """
    Read an uploaded spreadsheet and expose its filename with raw rows.

    Args:
        file: Uploaded MES source spreadsheet.

    Returns:
        Original filename and parsed cell rows.

    Raises:
        HTTPException: 422 when the file cannot be read as a spreadsheet.
    """
    filename = file.filename or "source"
    try:
        return filename, read_excel(await file.read(), filename)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"{filename}: cannot read Excel file ({exc})") from exc


@router.post("/data-snapshot")
async def replace_data_snapshot(
    order_file: UploadFile | None = File(default=None), machine_file: UploadFile | None = File(default=None), worker_file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db), user: User = Depends(get_current_user),
) -> dict[str, object]:
    """
    Replace one or more MES snapshot sources in a single database transaction.

    Args:
        order_file: Optional production-order source spreadsheet.
        machine_file: Optional machine/roll source spreadsheet.
        worker_file: Optional worker source spreadsheet.
        db: Database session used for the atomic replacement.
        user: Management user authorizing the import.

    Returns:
        Imported file names, per-source update counts and current totals.

    Raises:
        HTTPException: 403 for insufficient role or 422 for invalid source data.
    """
    _require_supervisor(user)
    uploads = {"order": order_file, "machine": machine_file, "worker": worker_file}
    selected = {key: file for key, file in uploads.items() if file is not None}
    if not selected:
        raise HTTPException(status_code=422, detail="Select at least one source file")
    files: dict[str, str] = {}
    parsed: dict[str, list[dict[str, object]]] = {}
    for key, file in selected.items():
        filename, values = await _read_upload(file)
        files[key] = filename
        try:
            parsed[key] = parse_source(values, key)
        except (ValueError, ArithmeticError) as exc:
            raise HTTPException(status_code=422, detail=f"{filename}: {exc}") from exc
        if not parsed[key]:
            raise HTTPException(status_code=422, detail=f"The {key} file must contain at least one data row")
    try:
        models = {"order": WS3ProductionOrder, "machine": WS3MachineWS2Record, "worker": WS3WorkerRecord}
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
        "updated": {"orders": len(parsed["order"]) if "order" in parsed else None, "machines": len(parsed["machine"]) if "machine" in parsed else None, "workers": len(parsed["worker"]) if "worker" in parsed else None},
        "counts": {"orders": db.query(WS3ProductionOrder).count(), "machines": db.query(WS3MachineWS2Record).count(), "workers": db.query(WS3WorkerRecord).count()},
    }


@router.get("/production-orders")
def production_order_report(production_date: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, object]:
    """
    Build the joined production report for one production date.

    Args:
        production_date: ISO production date from the MES snapshot.
        db: Database session containing all snapshot sources.
        user: Management user requesting the report.

    Returns:
        Report grouped by production order and joined roll data.
    """
    _require_supervisor(user)
    orders = db.scalars(select(WS3ProductionOrder).where(WS3ProductionOrder.production_date == production_date)).all()
    machines = db.scalars(select(WS3MachineWS2Record)).all()
    workers = db.scalars(select(WS3WorkerRecord)).all()
    return build_report(orders, machines, workers, production_date)


@router.get("/production-order-context")
def production_order_context(
    order_number: str,
    machine_id: str = Query(default="BU-01", min_length=1, max_length=50),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object] | None:
    """
    Resolve one SOP/order against the snapshot for a machine operation record.

    Args:
        order_number: SOP or order code entered by the operator.
        machine_id: Machine that will own the operation record.
        db: Database session containing the MES snapshot.
        user: Authenticated user requesting the context.

    Returns:
        First joined production order, or `None` when no source row matches.

    Raises:
        HTTPException: 400 for unsupported machines, 403 for unauthorized
            users or 409 when the entered order code is ambiguous.
    """
    if machine_id not in {"BU-01", "SC-01"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported machine")
    if not role_codes(user).intersection({"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}) and machine_id not in (user.machine_ids or []):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{machine_id} access is required")
    normalized = order_number.strip().upper()
    if not normalized:
        return None
    try:
        orders, _aliases = resolve_ws3_sop_code(db, normalized)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not orders:
        return None
    machines = db.scalars(select(WS3MachineWS2Record)).all()
    workers = db.scalars(select(WS3WorkerRecord)).all()
    return build_report(orders, machines, workers, None)["orders"][0]


@router.get("/data-snapshot/status")
def data_snapshot_status(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, int]:
    """
    Return the number of rows in each active snapshot source.

    Args:
        db: Database session used to count source rows.
        user: Management user requesting the status.

    Returns:
        Counts for production orders, machine rows and worker rows.
    """
    _require_supervisor(user)
    return {"orders": db.query(WS3ProductionOrder).count(), "machines": db.query(WS3MachineWS2Record).count(), "workers": db.query(WS3WorkerRecord).count()}


_WAREHOUSE_SOURCES = {
    "order": (WS3ProductionOrder, WS3ProductionOrder.production_date, (WS3ProductionOrder.pk_no, WS3ProductionOrder.out_no, WS3ProductionOrder.po_no, WS3ProductionOrder.source_order_no, WS3ProductionOrder.item_code, WS3ProductionOrder.item_name, WS3ProductionOrder.lot_no)),
    "machine": (WS3MachineWS2Record, WS3MachineWS2Record.weaving_date, (WS3MachineWS2Record.roll_id, WS3MachineWS2Record.machine_no, WS3MachineWS2Record.sop_no, WS3MachineWS2Record.po_no, WS3MachineWS2Record.source_order_no, WS3MachineWS2Record.item_code, WS3MachineWS2Record.item_name, WS3MachineWS2Record.lot_no)),
    "worker": (WS3WorkerRecord, WS3WorkerRecord.weaving_date, (WS3WorkerRecord.shift, WS3WorkerRecord.worker, WS3WorkerRecord.machine_no, WS3WorkerRecord.sop_no, WS3WorkerRecord.po_no, WS3WorkerRecord.source_order_no, WS3WorkerRecord.item_code, WS3WorkerRecord.item_name, WS3WorkerRecord.lot_no)),
}


def _require_admin(user: User) -> None:
    """
    Restrict raw data warehouse access to administrators.

    Args:
        user: Authenticated MES user.

    Raises:
        HTTPException: 403 when the user is not an administrator.
    """
    if "ADMIN" not in role_codes(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access is required")


@router.get("/admin/data-warehouse/summary")
def admin_data_warehouse_summary(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> dict[str, object]:
    """
    Summarize the available data warehouse sources for administrators.

    Args:
        db: Database session used to aggregate the source tables.
        user: Administrator requesting the summary.

    Returns:
        Row counts, date ranges and latest import time by source.
    """
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
    q: str = Query(default="", max_length=200),
    date: str = Query(default="", max_length=10),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    sort_by: int | None = Query(default=None, ge=0),
    sort_dir: str = Query(default="asc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object]:
    """
    Return a paginated, searchable raw snapshot source for warehouse review.

    Args:
        source: One supported snapshot source: order, machine or worker.
        q: Optional free-text search across canonical and raw source fields.
        date: Optional ISO date filter for the selected source.
        offset: Zero-based result offset.
        limit: Maximum rows returned, capped at 200.
        sort_by: Optional raw source column index to sort before pagination.
        sort_dir: Ascending or descending custom-column sort direction.
        db: Database session containing the selected source.
        user: Administrator requesting raw warehouse data.

    Returns:
        Source metadata, pagination details and raw source records.

    Raises:
        HTTPException: 403 for non-admin users or 404 for unknown sources.
    """
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
            """Return a stable empty-last key for one raw warehouse row."""
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
        records.append({"id": row.id, "date": getattr(row, date_column.key), "created_at": row.created_at.isoformat() if row.created_at else None, "raw_data": raw_data})
    return {"source": source, "total": total, "offset": offset, "limit": limit, "records": records}
