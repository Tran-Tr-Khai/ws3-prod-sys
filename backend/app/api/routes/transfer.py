from datetime import date, datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from sqlalchemy import desc, select, update
from sqlalchemy.orm import Session

from app.api.routes.machine_orders import set_order_progress
from app.db.session import get_db
from app.models.transfer import TransferRecord
from app.models.user import User
from app.schemas.transfer import TransferRecordCreate, TransferRecordResponse
from app.security.auth import get_current_user, role_codes
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, is_pkp_order_code, resolve_ws3_sop_code


router = APIRouter(prefix="/transfer/records", tags=["H/T Transfer"])
MANAGER_ROLES = {"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}
MACHINE_ID = "HT-01"


def _authorize(user: User) -> None:
    if role_codes(user).intersection(MANAGER_ROLES):
        return
    if "OPERATOR" in role_codes(user) and MACHINE_ID in (user.machine_ids or []):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{MACHINE_ID} access is required")


@router.post("", response_model=TransferRecordResponse, status_code=status.HTTP_201_CREATED)
def create_transfer_record(
    payload: TransferRecordCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TransferRecord:
    _authorize(user)
    sop_no = payload.order_number.strip().upper()
    if is_pkp_order_code(sop_no):
        raise HTTPException(status_code=422, detail="Vui lòng nhập mã SOP, không nhập mã PKP.")
    try:
        order_rows, _aliases = resolve_ws3_sop_code(db, sop_no)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not order_rows:
        raise HTTPException(status_code=422, detail="Không tìm thấy mã SOP trong dữ liệu MES.")

    values = payload.model_dump()
    values["order_number"] = sop_no
    record = TransferRecord(**values)
    set_order_progress(db, MACHINE_ID, sop_no, payload.order_progress)
    db.execute(
        update(TransferRecord)
        .where(TransferRecord.machine_id == MACHINE_ID, TransferRecord.order_number == sop_no)
        .values(order_progress=payload.order_progress)
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("", response_model=list[TransferRecordResponse])
def list_transfer_records(
    production_date: date | None = Query(default=None),
    limit: int = Query(default=200, ge=1, le=500),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TransferRecord]:
    _authorize(user)
    statement = select(TransferRecord).where(TransferRecord.machine_id == MACHINE_ID)
    if production_date is not None:
        statement = statement.where(TransferRecord.production_date == production_date)
    statement = statement.order_by(desc(TransferRecord.recorded_at), desc(TransferRecord.id)).limit(limit)
    return list(db.scalars(statement).all())


@router.get("/export")
def export_transfer_records(
    production_date: date | None = Query(default=None),
    language: str = Query(default="vi", pattern="^(vi|en)$"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> StreamingResponse:
    _authorize(user)
    statement = select(TransferRecord).where(TransferRecord.machine_id == MACHINE_ID)
    if production_date is not None:
        statement = statement.where(TransferRecord.production_date == production_date)
    records = list(db.scalars(statement.order_by(TransferRecord.recorded_at, TransferRecord.id)).all())

    is_vi = language == "vi"
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "HT Transfer"
    sheet.sheet_view.showGridLines = False
    sheet.merge_cells("A1:L1")
    title = sheet["A1"]
    title.value = "H/T TRANSFER DAILY REPORT"
    title.font = Font(name="Aptos Display", size=15, bold=True, color="FFFFFF")
    title.fill = PatternFill("solid", fgColor="385466")
    title.alignment = Alignment(horizontal="center", vertical="center")
    sheet.row_dimensions[1].height = 28
    sheet.merge_cells("A2:L2")
    date_label = production_date.strftime("%d/%m/%Y") if production_date else ("Tất cả ngày" if is_vi else "All dates")
    sheet["A2"] = f"Máy: {MACHINE_ID}  |  Ngày: {date_label}" if is_vi else f"Machine: {MACHINE_ID}  |  Date: {date_label}"
    sheet["A2"].font = Font(name="Aptos", size=10, color="385466")
    sheet["A2"].fill = PatternFill("solid", fgColor="EAF0F3")
    headers = (
        ["Ngày", "Loại vải", "Người mua", "Thiết kế", "Nhiệt độ (°C)", "Tốc độ (m/min)", "Sản lượng (m)", "Mã đơn hàng SOP#", "Ca", "Người vận hành", "ID nhân viên", "Tiến độ đơn"]
        if is_vi else
        ["Date", "Item", "Buyer", "Design", "Temp (°C)", "Speed (m/min)", "Q'ty (m)", "SOP#", "Shift", "Operator", "Employee ID", "Order progress"]
    )
    for column, label in enumerate(headers, start=1):
        cell = sheet.cell(4, column, label)
        cell.font = Font(name="Aptos", size=9, bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="476271")
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
    sheet.row_dimensions[4].height = 34
    for row_index, record in enumerate(records, start=5):
        values = [
            record.production_date, record.item, record.buyer, record.design, float(record.temperature), float(record.speed),
            float(record.quantity_meters), record.order_number, record.shift, record.operator_name,
            record.operator_identifier,
            ("ĐÃ HOÀN THÀNH" if record.order_progress == "COMPLETED" else "ĐANG XỬ LÝ")
            if is_vi else ("COMPLETED" if record.order_progress == "COMPLETED" else "IN PROGRESS"),
        ]
        for column, value in enumerate(values, start=1):
            cell = sheet.cell(row_index, column, value)
            cell.font = Font(name="Aptos", size=9, color="243B4A")
            cell.alignment = Alignment(vertical="center", wrap_text=column in (2, 3, 4))
            if column == 1:
                cell.number_format = "dd/mm/yyyy"
            elif column in (5, 6, 7):
                cell.number_format = "#,##0.###"
            if row_index % 2 == 0:
                cell.fill = PatternFill("solid", fgColor="F3F7F9")
    widths = [14, 30, 22, 20, 16, 18, 18, 22, 14, 22, 18, 20]
    for column, width in enumerate(widths, start=1):
        sheet.column_dimensions[chr(64 + column)].width = width
    sheet.freeze_panes = "A5"
    if records:
        sheet.auto_filter.ref = f"A4:L{4 + len(records)}"
    output = BytesIO()
    workbook.save(output)
    output.seek(0)
    date_suffix = production_date.isoformat() if production_date else "all"
    filename = f"ht-transfer-daily-report-{date_suffix}.xlsx"
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
