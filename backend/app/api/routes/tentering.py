from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.tentering import TenteringOrder, TenteringRollEntry
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.schemas.tentering import TenteringOrderInput, TenteringOrderResponse
from app.security.auth import get_current_user, role_codes
from app.security.authorization import require_machine_access
from app.services.machine_order_progress import activate_machine_order
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, is_pkp_order_code, resolve_ws3_sop_code
from app.services.snapshot_report import build_report


router = APIRouter(prefix="/tentering", tags=["tentering"])
SUPPORTED_MACHINES = {"TE-01", "TE-02"}

def _authorize(user: User, machine_id: str) -> None:
    """
    Enforce Tentering machine access for a request.

    Args:
        user: Authenticated MES user.
        machine_id: Requested Tenter identifier.

    Raises:
        HTTPException: 403 for an unassigned user or 404 for a non-Tenter ID.
    """
    require_machine_access(
        user,
        machine_id,
        supported_machines=SUPPORTED_MACHINES,
        not_found_detail="Tentering machine was not found",
    )

def _order_query():
    """
    Build the standard Tentering order query.

    Returns:
        SQLAlchemy statement that eagerly loads roll entries, avoiding a query
        for every order row in a list or export.
    """
    return select(TenteringOrder).options(selectinload(TenteringOrder.entries))

def _single_value(values: list[str | None]) -> str | None:
    """
    Return a source value only when all non-empty values agree.

    Args:
        values: Optional values collected from MES source rows.

    Returns:
        Shared value, or `None` when values are missing or conflicting.
    """
    distinct = {value.strip().casefold(): value.strip() for value in values if value and value.strip()}
    return next(iter(distinct.values())) if len(distinct) == 1 else None


@router.get("/orders/{sop_no}/source")
def get_tentering_order_source(
    sop_no: str,
    machine_id: str = Query(default="TE-01", max_length=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object] | None:
    """
    Build a safe Tentering draft from the existing MES snapshot.

    The source lookup deliberately returns only unambiguous production fields;
    it never invents a roll or worker assignment when source data conflicts.

    Args:
        sop_no: SOP entered by the operator.
        machine_id: Tenter machine where the SOP will run.
        db: Database session containing the MES snapshot.
        user: Authenticated user requesting the lookup.

    Returns:
        Normalized product/customer/roll data, or None when no SOP is found.

    Raises:
        HTTPException: 403/404 for unauthorized machine access or 409 for an
            ambiguous SOP code.
    """
    _authorize(user, machine_id)
    normalized_sop = sop_no.strip().upper()
    if not normalized_sop:
        return None
    try:
        source_rows, _aliases = resolve_ws3_sop_code(db, normalized_sop)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not source_rows:
        return None

    exact_sop_rows = [row for row in source_rows if (row.invoice_no or "").strip().upper() == normalized_sop]
    rows = exact_sop_rows or source_rows
    worker_rows = db.scalars(
        select(WS3WorkerRecord).where(func.upper(func.trim(WS3WorkerRecord.sop_no)) == normalized_sop)
    ).all()
    # A source lookup is called while an operator types an SOP. Reading every
    # imported roll makes that interaction slower as the warehouse grows.
    machines = db.scalars(
        select(WS3MachineWS2Record).where(
            func.upper(func.trim(WS3MachineWS2Record.out_dyeing_sop)) == normalized_sop
        )
    ).all()
    report = build_report(rows, machines, worker_rows, None)
    report_orders = report["orders"]
    source_rolls = report_orders[0]["rolls"] if report_orders else []
    source_rolls = sorted(
        source_rolls,
        key=lambda roll: int(roll["roll_id"].rsplit("-", 1)[-1]) if str(roll.get("roll_id", "")).rsplit("-", 1)[-1].isdigit() else 0,
    )
    return {
        "item_description": _single_value([row.item_name for row in rows]),
        "customer": _single_value([row.customer for row in worker_rows]),
        "rolls": [
            # The roll ID embeds the weaving date; the 7462 DATE column is not
            # the date workers need to see on the Tentering per-roll record.
            {"roll_number": index + 1, "roll_id": roll.get("roll_id"), "weaving_date": roll.get("weaving_date"), "length_meters": roll.get("length_meters")}
            for index, roll in enumerate(source_rolls)
        ],
        "total_rolls": len(source_rolls),
    }


@router.get("/orders", response_model=list[TenteringOrderResponse])
def list_tentering_orders(
    machine_id: str = Query(default="TE-01", max_length=20),
    q: str = Query(default="", max_length=160),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TenteringOrder]:
    """
    Return a bounded, newest-first SOP history for one Tenter.

    Args:
        machine_id: Tenter machine used to scope the history.
        q: Optional SOP search text.
        limit: Maximum number of orders returned.
        db: Database session.
        user: Authenticated user requesting the history.

    Returns:
        Matching SOP orders with their roll entries.
    """
    _authorize(user, machine_id)
    statement = _order_query().where(TenteringOrder.machine_id == machine_id.strip().upper())
    if q.strip():
        statement = statement.where(func.upper(TenteringOrder.sop_no).contains(q.strip().upper()))
    statement = statement.order_by(TenteringOrder.updated_at.desc(), TenteringOrder.id.desc()).limit(limit)
    return list(db.scalars(statement).all())


@router.get("/orders/export")
def export_tentering_orders(
    machine_id: str = Query(default="TE-01", max_length=20),
    saved_date: date | None = Query(default=None),
    q: str = Query(default="", max_length=160),
    language: str = Query(default="vi", pattern="^(vi|en)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    """
    Export authorized Tentering SOP records and roll details to Excel.

    Args:
        machine_id: Tenter machine used to scope the export.
        saved_date: Optional local date of the saved SOP record.
        q: Optional search across SOP, production fields and roll details.
        language: Workbook labels in Vietnamese or English.
        db: Database session used to load orders and roll entries.
        user: Authenticated user requesting the export.

    Returns:
        Streaming XLSX response with summary and roll-detail sheets.
    """
    _authorize(user, machine_id)
    normalized_machine = machine_id.strip().upper()
    statement = _order_query().where(TenteringOrder.machine_id == normalized_machine)
    if saved_date is not None:
        local_tz = ZoneInfo("Asia/Bangkok")
        start = datetime.combine(saved_date, time.min, tzinfo=local_tz).astimezone(timezone.utc)
        end = datetime.combine(saved_date + timedelta(days=1), time.min, tzinfo=local_tz).astimezone(timezone.utc)
        statement = statement.where(TenteringOrder.updated_at >= start, TenteringOrder.updated_at < end)
    orders = list(db.scalars(statement.order_by(TenteringOrder.updated_at.desc(), TenteringOrder.id.desc())).all())
    search = q.strip().casefold()
    if search:
        orders = [order for order in orders if search in " ".join((
            order.sop_no, order.customer or "", order.item_description or "",
            *(f"{entry.roll_id or ''} {entry.note or ''}" for entry in order.entries),
        )).casefold()]

    is_vi = language == "vi"
    workbook = Workbook()
    summary = workbook.active
    summary.title = "Tong quan" if is_vi else "Summary"
    summary.sheet_view.showGridLines = False
    detail = workbook.create_sheet("Chi tiet cuon" if is_vi else "Roll details")
    detail.sheet_view.showGridLines = False
    dark_fill = PatternFill("solid", fgColor="385466")
    header_fill = PatternFill("solid", fgColor="DCE6EA")
    light_fill = PatternFill("solid", fgColor="F3F7F9")
    border = Border(bottom=Side(style="thin", color="D5E0E5"))
    title_text = "BÁO CÁO TENTERING" if is_vi else "TENTERING REPORT"
    summary.merge_cells("A1:S1")
    title = summary["A1"]
    title.value = title_text
    title.font = Font(name="Aptos Display", size=16, bold=True, color="FFFFFF")
    title.fill = dark_fill
    title.alignment = Alignment(vertical="center")
    summary.row_dimensions[1].height = 30
    date_text = saved_date.strftime("%d/%m/%Y") if saved_date else ("Tất cả ngày" if is_vi else "All dates")
    summary.merge_cells("A2:S2")
    summary["A2"] = f"Máy: {normalized_machine}  |  Ngày cập nhật đơn: {date_text}  |  Số đơn: {len(orders)}  |  Bấm mã SOP để đến nhóm cuộn" if is_vi else f"Machine: {normalized_machine}  |  Order updated date: {date_text}  |  Orders: {len(orders)}  |  Click an SOP to jump to its roll group"
    summary["A2"].font = Font(name="Aptos", size=10, color="385466")
    summary["A2"].fill = PatternFill("solid", fgColor="EAF0F3")
    summary.row_dimensions[2].height = 22
    summary_headers = [
        "CẬP NHẬT", "MÃ SOP", "KHÁCH HÀNG", "MẶT HÀNG", "SỢI DỌC", "SỢI NGANG",
        "MẬT ĐỘ MỘC (PICK)", "MẬT ĐỘ TP (PICK)", "CO RÚT (%)", "KHỔ MỘC (IN)", "KHỔ MỘC (CM)",
        "KHỔ TP (IN)", "KHỔ TP (CM)", "SỐ CUỘN", "SL THEO ĐƠN", "SL THỰC TẾ",
        "NGƯỜI VẬN HÀNH", "CA", "TIẾN ĐỘ",
    ] if is_vi else [
        "UPDATED", "SOP", "CUSTOMER", "ITEM", "WARP YARN", "WEFT YARN", "GREIGE DENSITY (PICK)",
        "FINISH DENSITY (PICK)", "SHRINKAGE (%)", "GREIGE WIDTH (IN)", "GREIGE WIDTH (CM)",
        "FINISH WIDTH (IN)", "FINISH WIDTH (CM)", "ROLLS", "PLANNED QTY", "ACTUAL QTY",
        "OPERATOR", "SHIFT", "PROGRESS",
    ]
    for column, label in enumerate(summary_headers, start=1):
        cell = summary.cell(4, column, label)
        cell.font = Font(name="Aptos", size=9, bold=True, color="385466")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True, shrink_to_fit=True)
        cell.border = Border(
            left=Side(style="thin", color="A9BBC3"),
            right=Side(style="thin", color="A9BBC3"),
            bottom=Side(style="medium", color="8098A3"),
        )
    summary.row_dimensions[4].height = 38

    detail.merge_cells("A1:E1")
    detail_title = detail["A1"]
    detail_title.value = "CHI TIẾT CUỘN THEO SOP" if is_vi else "ROLL DETAILS BY SOP"
    detail_title.font = Font(name="Aptos Display", size=16, bold=True, color="FFFFFF")
    detail_title.fill = dark_fill
    detail_title.alignment = Alignment(vertical="center")
    detail.row_dimensions[1].height = 30
    detail.merge_cells("A2:E2")
    detail["A2"] = "Bấm mã SOP ở sheet Tổng quan để nhảy đến nhóm cuộn tương ứng." if is_vi else "Click an SOP in Summary to jump to its roll group."
    detail["A2"].font = Font(name="Aptos", size=10, color="385466")
    detail["A2"].fill = PatternFill("solid", fgColor="EAF0F3")
    detail.row_dimensions[2].height = 22
    roll_headers = ["MÃ ROLL", "NGÀY DỆT", "SL THEO ĐƠN", "SL THỰC TẾ", "GHI CHÚ"] if is_vi else ["ROLL ID", "WEAVING DATE", "PLANNED QTY", "ACTUAL QTY", "NOTE"]
    for column, label in enumerate(roll_headers, start=1):
        cell = detail.cell(4, column, label)
        cell.font = Font(name="Aptos", size=9, bold=True, color="385466")
        cell.fill = header_fill
        cell.alignment = Alignment(horizontal="left", vertical="center", wrap_text=True)
        cell.border = Border(left=Side(style="thin", color="A9BBC3"), right=Side(style="thin", color="A9BBC3"), bottom=Side(style="medium", color="8098A3"))
    detail.row_dimensions[4].height = 30

    local_tz = ZoneInfo("Asia/Bangkok")
    for row_index, order in enumerate(orders, start=5):
        updated = order.updated_at
        if updated.tzinfo is not None:
            updated = updated.astimezone(local_tz).replace(tzinfo=None)
        planned = [float(entry.planned_quantity) for entry in order.entries if entry.planned_quantity is not None]
        actual = [float(entry.actual_quantity) for entry in order.entries if entry.actual_quantity is not None]
        progress = ("ĐÃ HOÀN THÀNH" if order.order_progress == "COMPLETED" else "ĐANG XỬ LÝ") if is_vi else ("COMPLETED" if order.order_progress == "COMPLETED" else "IN PROGRESS")
        greige_width = float(order.greige_width_inch) if order.greige_width_inch is not None else None
        finish_width = float(order.finish_width_inch) if order.finish_width_inch is not None else None
        values = [
            updated, order.sop_no, order.customer or "—", order.item_description or "—", order.warp_yarn or "—", order.weft_yarn or "—",
            float(order.greige_density_pick) if order.greige_density_pick is not None else None,
            float(order.finish_density_pick) if order.finish_density_pick is not None else None,
            float(order.shrink_percent) if order.shrink_percent is not None else None,
            greige_width, greige_width * 2.54 if greige_width is not None else None,
            finish_width, finish_width * 2.54 if finish_width is not None else None,
            len(order.entries), sum(planned) if planned else None, sum(actual) if actual else None,
            order.operator_name or "—", order.shift or "—", progress,
        ]
        group_row = detail.max_row + 1
        for column in range(1, 6):
            cell = detail.cell(group_row, column)
            cell.fill = PatternFill("solid", fgColor="EAF0F3")
            cell.border = Border(top=Side(style="medium", color="9FB0B8"))
        detail.merge_cells(start_row=group_row, start_column=1, end_row=group_row, end_column=5)
        group_heading = detail.cell(group_row, 1, f"MÃ SOP: {order.sop_no}  |  {len(order.entries)} CUỘN" if is_vi else f"SOP: {order.sop_no}  |  {len(order.entries)} ROLLS")
        group_heading.font = Font(name="Aptos", size=10, bold=True, color="385466")
        group_heading.fill = PatternFill("solid", fgColor="EAF0F3")
        group_heading.hyperlink = f"#'{summary.title}'!B{row_index}"
        group_heading.alignment = Alignment(vertical="center")
        detail.row_dimensions[group_row].height = 23

        for column, value in enumerate(values, start=1):
            cell = summary.cell(row_index, column, value)
            cell.font = Font(name="Aptos", size=9, color="243B4A")
            cell.alignment = Alignment(vertical="center", wrap_text=column in (3, 4, 5, 6))
            cell.border = border
            if row_index % 2:
                cell.fill = light_fill
            if column == 1:
                cell.number_format = "dd/mm/yyyy - hh:mm"
            elif column in (7, 8, 9, 10, 11, 12, 13, 15, 16):
                cell.number_format = "#,##0.###"
            elif column == 2:
                cell.hyperlink = f"#'{detail.title}'!A{group_row}"
                cell.font = Font(name="Aptos", size=9, bold=True, color="0563C1", underline="single")
            elif column == 19:
                cell.font = Font(name="Aptos", size=9, bold=True, color="247044" if order.order_progress == "COMPLETED" else "1D4ED8")

        for roll_index, entry in enumerate(order.entries):
            detail_values = [entry.roll_id or "—", entry.weaving_date, entry.planned_quantity, entry.actual_quantity, entry.note or "—"]
            detail_row = detail.max_row + 1
            for column, value in enumerate(detail_values, start=1):
                cell = detail.cell(detail_row, column, value)
                cell.font = Font(name="Aptos", size=9, color="243B4A")
                cell.alignment = Alignment(vertical="center", wrap_text=column in (1, 5))
                cell.border = Border(left=Side(style="thin", color="D5E0E5"), right=Side(style="thin", color="D5E0E5"), bottom=Side(style="thin", color="D5E0E5"))
                if roll_index % 2 == 0:
                    cell.fill = light_fill
                if column == 2 and value is not None:
                    cell.number_format = "dd/mm/yyyy"
                elif column in (3, 4):
                    cell.number_format = "#,##0.###"
            detail.row_dimensions[detail_row].height = 22

    summary_widths = [23, 22, 22, 42, 24, 24, 19, 25, 16, 18, 18, 22, 22, 16, 18, 18, 22, 14, 19]
    for column, width in enumerate(summary_widths, start=1):
        summary.column_dimensions[get_column_letter(column)].width = width
    detail_widths = [25, 18, 18, 18, 44]
    for column, width in enumerate(detail_widths, start=1):
        detail.column_dimensions[get_column_letter(column)].width = width
    summary.freeze_panes = "A5"
    summary.auto_filter.ref = f"A4:S{4 + len(orders)}"
    detail.freeze_panes = "A5"

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"tentering-report-{normalized_machine.lower()}-{saved_date.isoformat() if saved_date else 'all'}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/orders/{sop_no}", response_model=TenteringOrderResponse)
def get_tentering_order(
    sop_no: str,
    machine_id: str = Query(default="TE-01", max_length=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenteringOrder:
    """
    Return one saved Tentering SOP sheet and its roll set.

    Args:
        sop_no: SOP identity from the URL.
        machine_id: Tenter machine that owns the sheet.
        db: Database session used for the lookup.
        user: Authenticated user requesting the sheet.

    Returns:
        Saved order including the current roll entries.

    Raises:
        HTTPException: 403 for access violations, 404 when the SOP does not
            exist, or 422 when a PKP code is supplied instead of an SOP.
    """
    _authorize(user, machine_id)
    if is_pkp_order_code(sop_no):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng nhập mã SOP, không nhập mã PKP.")
    order = db.scalar(_order_query().where(
        TenteringOrder.machine_id == machine_id.strip().upper(),
        func.upper(func.trim(TenteringOrder.sop_no)) == sop_no.strip().upper(),
    ))
    if order is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tentering SOP was not found")
    return order


@router.put("/orders/{sop_no}", response_model=TenteringOrderResponse)
def save_tentering_order(
    sop_no: str,
    payload: TenteringOrderInput,
    machine_id: str = Query(default="TE-01", max_length=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenteringOrder:
    """
    Replace one Tentering SOP sheet and synchronize its complete roll set.

    Args:
        sop_no: SOP identity from the URL.
        payload: Complete production sheet submitted by the UI.
        machine_id: Tenter machine that owns the sheet.
        db: Database session used for the transactional save.
        user: Authenticated user recording the sheet.

    Returns:
        Saved order including the current roll entries.

    Raises:
        HTTPException: 403 for access violations or 422 for invalid SOP input.
    """
    _authorize(user, machine_id)
    normalized_sop = sop_no.strip().upper()
    normalized_machine = machine_id.strip().upper()
    if not normalized_sop:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SOP number is required")
    if is_pkp_order_code(normalized_sop):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Vui lòng nhập mã SOP, không nhập mã PKP.")

    try:
        order = db.scalar(
            select(TenteringOrder)
            .where(
                TenteringOrder.machine_id == normalized_machine,
                func.upper(func.trim(TenteringOrder.sop_no)) == normalized_sop,
            )
            .with_for_update()
        )
        if order is None:
            order = TenteringOrder(machine_id=normalized_machine, sop_no=normalized_sop)
            db.add(order)
            db.flush()

        progress = "IN_PROGRESS" if "OPERATOR" in role_codes(user) else payload.order_progress
        order_values = payload.model_dump(exclude={"entries"})
        order_values["order_progress"] = progress
        for field, value in order_values.items():
            setattr(order, field, value)

        existing_entries = {entry.roll_number: entry for entry in order.entries}
        submitted_roll_numbers = {entry.roll_number for entry in payload.entries}
        for entry_data in payload.entries:
            entry = existing_entries.get(entry_data.roll_number)
            values = entry_data.model_dump(exclude={"roll_number"})
            if entry is None:
                entry = TenteringRollEntry(
                    order_id=order.id,
                    roll_number=entry_data.roll_number,
                    recorded_by_id=user.id,
                    recorded_by_name=user.full_name or user.username,
                    **values,
                )
                db.add(entry)
            else:
                for field, value in values.items():
                    setattr(entry, field, value)
                entry.recorded_by_id = user.id
                entry.recorded_by_name = user.full_name or user.username

        # PUT represents the whole SOP sheet. Removing a row in the UI must
        # remove its old roll entry rather than leaving a hidden stale record.
        for roll_number, entry in existing_entries.items():
            if roll_number not in submitted_roll_numbers:
                db.delete(entry)

        activate_machine_order(db, normalized_machine, normalized_sop, progress=progress)
        order.order_progress = progress
        db.commit()
        return db.scalar(_order_query().where(TenteringOrder.id == order.id))
    except Exception:
        db.rollback()
        raise
