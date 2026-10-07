from datetime import date, datetime, time, timedelta, timezone
from io import BytesIO
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.scouring import ScouringRecord
from app.models.scouring_inspection import ScouringPhInspection
from app.api.routes.machine_orders import set_order_progress
from app.schemas.scouring import ScouringPhInspectionCreate, ScouringPhInspectionResponse, ScouringRecordCreate, ScouringRecordResponse
from app.security.auth import get_current_user
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_order_code

router = APIRouter(prefix="/scouring/records", tags=["scouring"])
inspection_router = APIRouter(prefix="/scouring/inspections", tags=["scouring-inspections"])


def _get_record_or_404(record_id: int, db: Session) -> ScouringRecord:
    record = db.get(ScouringRecord, record_id)
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Scouring record '{record_id}' was not found",
        )
    return record


@router.post("", response_model=ScouringRecordResponse, status_code=status.HTTP_201_CREATED)
def create_scouring_record(
    payload: ScouringRecordCreate,
    db: Session = Depends(get_db),
) -> ScouringRecord:
    record = ScouringRecord(**payload.model_dump())
    if payload.order_number and payload.order_progress:
        set_order_progress(db, payload.machine_id, payload.order_number, payload.order_progress)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=ScouringRecordResponse)
def update_scouring_record(
    record_id: int,
    payload: ScouringRecordCreate,
    db: Session = Depends(get_db),
) -> ScouringRecord:
    record = _get_record_or_404(record_id, db)
    previous_progress = record.order_progress
    if payload.machine_id != record.machine_id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A Scouring record cannot be moved to another machine")
    if (payload.order_number or "").strip().casefold() != (record.order_number or "").strip().casefold():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A Scouring record cannot be moved to another order")

    # Keep the original history timestamp and order identity; edits replace the
    # selected row's operational values rather than creating a second event.
    update_values = payload.model_dump(exclude={"machine_id", "recorded_at", "batch_identifier", "order_number"})
    for field, value in update_values.items():
        setattr(record, field, value)
    if record.order_number and record.order_progress and record.order_progress != previous_progress:
        set_order_progress(db, record.machine_id, record.order_number, record.order_progress)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=list[ScouringRecordResponse])
def list_scouring_records(
    limit: int = Query(default=100, ge=1, le=500),
    order_number: str | None = Query(default=None, max_length=80),
    db: Session = Depends(get_db),
) -> list[ScouringRecord]:
    statement = (
        select(ScouringRecord)
        .order_by(desc(ScouringRecord.recorded_at), desc(ScouringRecord.id))
        .limit(limit)
    )
    if order_number and order_number.strip():
        try:
            _rows, aliases = resolve_ws3_order_code(db, order_number)
        except AmbiguousWS3OrderCode as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        aliases = aliases or {order_number.strip().upper()}
        statement = statement.where(func.upper(func.trim(ScouringRecord.order_number)).in_(aliases))
    return list(db.scalars(statement).all())


@router.get("/export")
def export_scouring_records(
    record_date: date | None = Query(default=None),
    order_progress: str | None = Query(default=None, pattern="^(IN_PROGRESS|COMPLETED|UNKNOWN)$"),
    result: str | None = Query(default=None, pattern="^(COMPLETE|WARNING|INCOMPLETE)$"),
    search: str | None = Query(default=None, max_length=160),
    language: str = Query(default="vi", pattern="^(vi|en)$"),
    db: Session = Depends(get_db),
    _user=Depends(get_current_user),
) -> StreamingResponse:
    timezone_local = ZoneInfo("Asia/Ho_Chi_Minh")
    statement = select(ScouringRecord)
    if record_date is not None:
        start = datetime.combine(record_date, time.min, tzinfo=timezone_local).astimezone(timezone.utc)
        end = (datetime.combine(record_date, time.min, tzinfo=timezone_local) + timedelta(days=1)).astimezone(timezone.utc)
        statement = statement.where(ScouringRecord.recorded_at >= start, ScouringRecord.recorded_at < end)
    if order_progress == "UNKNOWN":
        statement = statement.where(ScouringRecord.order_progress.is_(None))
    elif order_progress:
        statement = statement.where(ScouringRecord.order_progress == order_progress)
    if search and search.strip():
        term = f"%{search.strip()}%"
        statement = statement.where(or_(
            ScouringRecord.order_number.ilike(term), ScouringRecord.item.ilike(term),
            ScouringRecord.lot_number.ilike(term), ScouringRecord.operator_name.ilike(term),
            ScouringRecord.operator_identifier.ilike(term), ScouringRecord.shift.ilike(term),
        ))
    records = list(db.scalars(statement.order_by(desc(ScouringRecord.recorded_at), desc(ScouringRecord.id))).all())

    def record_result(record: ScouringRecord) -> str:
        return "WARNING" if record.speed < 40 or record.speed > 50 or record.temperature < 90 or record.temperature > 98 else "COMPLETE"

    if result and result != "INCOMPLETE":
        records = [record for record in records if record_result(record) == result]
    elif result == "INCOMPLETE":
        records = []  # Required Scouring parameters are non-null in the database schema.

    record_ids = [record.id for record in records]
    inspections = list(db.scalars(
        select(ScouringPhInspection)
        .where(ScouringPhInspection.scouring_record_id.in_(record_ids))
        .order_by(ScouringPhInspection.inspected_at, ScouringPhInspection.id)
    ).all()) if record_ids else []

    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Scouring"
    sheet.sheet_view.showGridLines = False
    is_vi = language == "vi"
    headers = (
        ["TIẾN ĐỘ ĐƠN", "THỜI GIAN", "MÁY", "SỐ ORDER", "MẶT HÀNG", "LOT SỢI", "SỐ LOT", "NGƯỜI VẬN HÀNH", "ID NHÂN VIÊN", "CA", "NaOH (L)", "Soap (L)", "Desizer (L)", "H2O2 (L)", "Chelate (L)", "TỐC ĐỘ (m/min)", "NHIỆT ĐỘ (°C)", "NHIỆT ĐỘ LÔ GIA (°C)", "MÉT ĐẦU VÀO", "MÉT ĐẦU RA", "HAO HỤT", "KẾT QUẢ"]
        if is_vi else
        ["ORDER PROGRESS", "DATE & TIME", "MACHINE", "ORDER", "ITEM", "YARN LOT", "LOT", "OPERATOR", "EMPLOYEE ID", "SHIFT", "NaOH (L)", "Soap (L)", "Desizer (L)", "H2O2 (L)", "Chelate (L)", "SPEED (m/min)", "TEMPERATURE (°C)", "CYLINDER TEMP. (°C)", "INPUT (m)", "OUTPUT (m)", "LOSS (m)", "RESULT"]
    )
    last_col = len(headers)
    sheet.merge_cells(start_row=1, start_column=1, end_row=1, end_column=last_col)
    title_cell = sheet.cell(1, 1, "BÁO CÁO LỊCH SỬ SCOURING" if is_vi else "SCOURING HISTORY REPORT")
    title_cell.font = Font(name="Aptos Display", size=16, bold=True, color="FFFFFF")
    title_cell.fill = PatternFill("solid", fgColor="385466")
    title_cell.alignment = Alignment(vertical="center")
    sheet.row_dimensions[1].height = 32
    sheet.merge_cells(start_row=2, start_column=1, end_row=2, end_column=last_col)
    date_text = record_date.strftime("%d/%m/%Y") if record_date else ("Tất cả ngày" if is_vi else "All dates")
    sheet.cell(2, 1, f"Máy: SC-01    |    Ngày ghi: {date_text}    |    Số bản ghi: {len(records)}" if is_vi else f"Machine: SC-01    |    Record date: {date_text}    |    Records: {len(records)}")
    sheet.cell(2, 1).font = Font(name="Aptos", size=10, color="385466")
    sheet.cell(2, 1).fill = PatternFill("solid", fgColor="EAF0F3")
    sheet.cell(2, 1).alignment = Alignment(vertical="center")
    sheet.merge_cells(start_row=4, start_column=1, end_row=5, end_column=1)
    progress_header = sheet.cell(4, 1, "TIẾN ĐỘ ĐƠN" if is_vi else "ORDER PROGRESS")
    progress_header.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
    progress_header.fill = PatternFill("solid", fgColor="385466")
    progress_header.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    group_border = Side(style="medium", color="385466")
    column_border = Side(style="thin", color="9FB0B8")
    progress_header.border = Border(left=group_border, right=group_border, bottom=group_border)
    group_ranges = [(2, 10, "THÔNG TIN CHUNG" if is_vi else "GENERAL INFORMATION"), (11, 15, "HÓA CHẤT" if is_vi else "CHEMICALS"), (16, 18, "ĐIỀU KIỆN QUY TRÌNH" if is_vi else "PROCESS CONDITIONS"), (19, 21, "SẢN XUẤT" if is_vi else "PRODUCTION")]
    for start_col, end_col, label in group_ranges:
        # Style the full merged range before merging so Excel retains the group
        # edges, with softer separators between columns inside the group.
        for column in range(start_col, end_col + 1):
            cell = sheet.cell(4, column)
            cell.fill = PatternFill("solid", fgColor="385466")
            cell.border = Border(
                left=group_border if column == start_col else Side(style=None),
                right=group_border if column == end_col else Side(style=None),
                bottom=group_border,
            )
        sheet.merge_cells(start_row=4, start_column=start_col, end_row=4, end_column=end_col)
        cell = sheet.cell(4, start_col, label)
        cell.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="385466")
        cell.alignment = Alignment(horizontal="center", vertical="center")
    sheet.merge_cells(start_row=4, start_column=22, end_row=5, end_column=22)
    result_group = sheet.cell(4, 22, "KẾT QUẢ" if is_vi else "RESULT")
    result_group.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
    result_group.fill = PatternFill("solid", fgColor="385466")
    result_group.alignment = Alignment(horizontal="center", vertical="center")
    result_group.border = Border(left=group_border, right=group_border, bottom=group_border)
    thin_border = Border(bottom=Side(style="thin", color="D5E0E5"))
    group_starts = {start for start, _end, _label in group_ranges}
    group_ends = {end for _start, end, _label in group_ranges}
    for column, value in enumerate(headers, start=1):
        # The result header is already vertically merged across rows 4-5.
        if column in (1, 22):
            continue
        cell = sheet.cell(5, column, value)
        cell.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="476271")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = Border(
            left=group_border if column in group_starts else Side(style=None),
            right=group_border if column in group_ends else column_border,
            bottom=Side(style="medium", color="243B4A"),
        )
    sheet.row_dimensions[5].height = 34
    for row_index, record in enumerate(records, start=6):
        timestamp = record.recorded_at
        if timestamp.tzinfo is not None:
            timestamp = timestamp.astimezone(timezone_local).replace(tzinfo=None)
        progress = "ĐANG XỬ LÝ" if record.order_progress == "IN_PROGRESS" else "ĐÃ HOÀN THÀNH" if record.order_progress == "COMPLETED" else ("CHƯA CẬP NHẬT" if is_vi else "NOT SET")
        values = [progress if is_vi else ("IN PROGRESS" if record.order_progress == "IN_PROGRESS" else "COMPLETED" if record.order_progress == "COMPLETED" else "NOT SET"), timestamp, record.machine_id, record.order_number or "—", record.item or "—", record.lot_yarn or "—", record.lot_number or "—", record.operator_name or "—", record.operator_identifier or "—", record.shift or "—", record.naoh, record.soap, record.desizer, record.h2o2, record.chelate, record.speed, record.temperature, record.cylinder_temperature, record.input_fabric_meters, record.output_fabric_meters, record.loss_meters, ("CẢNH BÁO" if is_vi else "WARNING") if record_result(record) == "WARNING" else ("ĐẠT" if is_vi else "PASS")]
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(row_index, column, value)
            cell.font = Font(name="Aptos", size=9, color="243B4A")
            cell.alignment = Alignment(vertical="center", wrap_text=column in (4, 7))
            # Group emphasis belongs to the header only; body rows use a
            # uniform, subtle grid so the dataset stays visually calm.
            cell.border = Border(right=column_border, bottom=Side(style="thin", color="D5E0E5"))
            if row_index % 2:
                cell.fill = PatternFill("solid", fgColor="F3F7F9")
            if column == 2:
                cell.number_format = "dd/mm/yy hh:mm"
            if 11 <= column <= 21:
                cell.number_format = "#,##0.###"
            if column == 1:
                progress_colors = {
                    "IN_PROGRESS": ("1D4ED8", "DBEAFE"),
                    "COMPLETED": ("15803D", "DCFCE7"),
                    None: ("475569", "E2E8F0"),
                }
                font_color, fill_color = progress_colors.get(record.order_progress, progress_colors[None])
                cell.font = Font(name="Aptos", size=9, bold=True, color=font_color)
                cell.fill = PatternFill("solid", fgColor=fill_color)
            if column == 22:
                warning = record_result(record) == "WARNING"
                cell.font = Font(name="Aptos", size=9, bold=True, color="B42318" if warning else "247044")
                cell.fill = PatternFill("solid", fgColor="FDECEC" if warning else "E7F4EC")
        sheet.row_dimensions[row_index].height = 22
    widths = [19, 18, 12, 20, 34, 15, 15, 22, 16, 12, 13, 13, 13, 13, 13, 15, 15, 18, 15, 15, 14, 14]
    for column, width in enumerate(widths, start=1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes = "C6"
    sheet.auto_filter.ref = f"A5:V{5 + len(records)}"
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation = "landscape"
    sheet.page_setup.fitToWidth = 1
    sheet.page_setup.fitToHeight = 0
    sheet.print_title_rows = "1:5"

    ph_sheet = workbook.create_sheet("pH inspections" if is_vi else "pH Inspections")
    ph_sheet.sheet_view.showGridLines = False
    ph_headers = ["THỜI GIAN", "SỐ ORDER", "NGƯỜI KIỂM TRA", *[f"TANK {index}" for index in range(8)], "GHI CHÚ"] if is_vi else ["DATE & TIME", "ORDER", "INSPECTOR", *[f"TANK {index}" for index in range(8)], "NOTE"]
    ph_sheet.append(ph_headers)
    for cell in ph_sheet[1]:
        cell.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="476271")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    record_by_id = {record.id: record for record in records}
    for inspection in inspections:
        inspected_at = inspection.inspected_at
        if inspected_at.tzinfo is not None:
            inspected_at = inspected_at.astimezone(timezone_local).replace(tzinfo=None)
        tank_values = [getattr(inspection, f"tank_{index}_ph") for index in range(8)]
        ph_sheet.append([inspected_at, record_by_id[inspection.scouring_record_id].order_number or "—", inspection.operator_name or "—", *tank_values, inspection.note or "—"])
        row = ph_sheet.max_row
        ph_sheet.cell(row, 1).number_format = "dd/mm/yy hh:mm"
        for cell in ph_sheet[row]:
            cell.border = thin_border
            cell.alignment = Alignment(vertical="center", wrap_text=cell.column == 12)
    for column, width in enumerate([18, 20, 22, *([12] * 8), 44], start=1):
        ph_sheet.column_dimensions[get_column_letter(column)].width = width
    ph_sheet.freeze_panes = "A2"
    ph_sheet.auto_filter.ref = f"A1:L{ph_sheet.max_row}"

    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    filename = f"scouring-report-{record_date.isoformat() if record_date else 'all'}.xlsx"
    return StreamingResponse(output, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@router.get("/latest", response_model=ScouringRecordResponse)
def get_latest_scouring_record(db: Session = Depends(get_db)) -> ScouringRecord:
    record = db.scalars(
        select(ScouringRecord)
        .order_by(desc(ScouringRecord.recorded_at), desc(ScouringRecord.id))
        .limit(1)
    ).first()
    if record is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Scouring records were found",
        )
    return record


@router.get("/{record_id}", response_model=ScouringRecordResponse)
def get_scouring_record(record_id: int, db: Session = Depends(get_db)) -> ScouringRecord:
    return _get_record_or_404(record_id, db)


@inspection_router.post("", response_model=ScouringPhInspectionResponse, status_code=status.HTTP_201_CREATED)
def create_scouring_ph_inspection(
    payload: ScouringPhInspectionCreate,
    db: Session = Depends(get_db),
) -> ScouringPhInspection:
    if db.get(ScouringRecord, payload.scouring_record_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scouring operation record was not found")
    tank_values = [getattr(payload, f"tank_{index}_ph") for index in range(8)]
    if not any(value is not None for value in tank_values):
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one tank pH value is required")
    inspection = ScouringPhInspection(**payload.model_dump())
    db.add(inspection)
    db.commit()
    db.refresh(inspection)
    return inspection


@inspection_router.get("", response_model=list[ScouringPhInspectionResponse])
def list_scouring_ph_inspections(
    scouring_record_id: int | None = Query(default=None, gt=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: Session = Depends(get_db),
) -> list[ScouringPhInspection]:
    statement = select(ScouringPhInspection).order_by(desc(ScouringPhInspection.inspected_at), desc(ScouringPhInspection.id)).limit(limit)
    if scouring_record_id is not None:
        statement = statement.where(ScouringPhInspection.scouring_record_id == scouring_record_id)
    return list(db.scalars(statement).all())


@inspection_router.get("/{inspection_id}", response_model=ScouringPhInspectionResponse)
def get_scouring_ph_inspection(inspection_id: int, db: Session = Depends(get_db)) -> ScouringPhInspection:
    inspection = db.get(ScouringPhInspection, inspection_id)
    if inspection is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"PH inspection '{inspection_id}' was not found")
    return inspection
