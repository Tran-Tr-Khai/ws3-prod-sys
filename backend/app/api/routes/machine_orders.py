from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.buffing import BuffingCheck
from app.models.machine_order_state import MachineOrderState
from app.models.scouring import ScouringRecord
from app.models.tentering import TenteringOrder
from app.models.transfer import TransferRecord
from app.models.user import User
from app.security.auth import get_current_user, role_codes
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, is_pkp_order_code, resolve_ws3_order_code, resolve_ws3_sop_code


router = APIRouter(prefix="/machine-orders", tags=["machine-orders"])
MANAGER_ROLES = {"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}
MACHINES = {"BU-01", "SC-01", "TE-01", "TE-02", "HT-01"}


class OrderProgressUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: Literal["BU-01", "SC-01", "TE-01", "TE-02", "HT-01"]
    order_number: str = Field(min_length=1, max_length=160)
    order_progress: Literal["IN_PROGRESS", "COMPLETED"]


def _authorize_machine(user: User, machine_id: str) -> None:
    if machine_id not in MACHINES:
        raise HTTPException(status_code=400, detail="Unsupported machine")
    if not role_codes(user).intersection(MANAGER_ROLES) and machine_id not in (user.machine_ids or []):
        raise HTTPException(status_code=403, detail=f"{machine_id} access is required")


def set_order_progress(db: Session, machine_id: str, order_number: str, progress: str) -> MachineOrderState:
    normalized = order_number.strip().upper()
    state = db.scalar(
        select(MachineOrderState).where(
            MachineOrderState.machine_id == machine_id,
            MachineOrderState.order_number == normalized,
        )
    )
    if state is None:
        state = MachineOrderState(machine_id=machine_id, order_number=normalized, order_progress=progress)
        db.add(state)
    else:
        state.order_progress = progress
    return state


def state_response(state: MachineOrderState) -> dict[str, str | int]:
    return {
        "id": state.id,
        "machine_id": state.machine_id,
        "order_number": state.order_number,
        "order_progress": state.order_progress,
        "updated_at": state.updated_at.isoformat(),
    }


@router.get("/progress")
def get_order_progress(
    machine_id: str = Query(min_length=1, max_length=50),
    order_number: str = Query(min_length=1, max_length=160),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str | int] | None:
    _authorize_machine(user, machine_id)
    normalized = order_number.strip().upper()
    if not normalized:
        raise HTTPException(status_code=422, detail="Order number is required")
    state = db.scalar(
        select(MachineOrderState).where(
            MachineOrderState.machine_id == machine_id,
            MachineOrderState.order_number == normalized,
        )
    )
    if state is None:
        try:
            _rows, aliases = resolve_ws3_order_code(db, normalized)
        except AmbiguousWS3OrderCode as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if aliases:
            state = db.scalar(
                select(MachineOrderState)
                .where(MachineOrderState.machine_id == machine_id, func.upper(MachineOrderState.order_number).in_(aliases))
                .order_by(MachineOrderState.updated_at.desc())
            )
        if state is None and machine_id in {"TE-01", "TE-02"}:
            order_query = select(TenteringOrder).where(TenteringOrder.machine_id == machine_id)
            if aliases:
                order_query = order_query.where(func.upper(TenteringOrder.sop_no).in_(aliases))
            else:
                order_query = order_query.where(func.upper(func.trim(TenteringOrder.sop_no)) == normalized)
            order = db.scalar(order_query)
            if order is not None:
                return {"id": order.id, "machine_id": order.machine_id, "order_number": order.sop_no, "order_progress": order.order_progress, "updated_at": order.updated_at.isoformat()}
    return state_response(state) if state else None


@router.put("/progress")
def update_order_progress(
    payload: OrderProgressUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, str | int]:
    _authorize_machine(user, payload.machine_id)
    normalized = payload.order_number.strip().upper()
    if not normalized:
        raise HTTPException(status_code=422, detail="Order number is required")
    if is_pkp_order_code(normalized):
        raise HTTPException(status_code=422, detail="Vui lòng nhập mã SOP, không nhập mã PKP.")
    try:
        order_rows, _aliases = resolve_ws3_sop_code(db, normalized)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not order_rows:
        raise HTTPException(status_code=422, detail="Không tìm thấy mã SOP trong dữ liệu MES.")

    try:
        state = set_order_progress(db, payload.machine_id, normalized, payload.order_progress)
        try:
            _rows, aliases = resolve_ws3_order_code(db, normalized)
        except AmbiguousWS3OrderCode as exc:
            raise HTTPException(status_code=409, detail=str(exc)) from exc
        if aliases:
            db.execute(
                update(MachineOrderState)
                .where(MachineOrderState.machine_id == payload.machine_id, func.upper(MachineOrderState.order_number).in_(aliases))
                .values(order_progress=payload.order_progress)
            )
        if payload.machine_id == "BU-01":
            db.execute(
                update(BuffingCheck)
                .where(BuffingCheck.machine_id == payload.machine_id, func.upper(func.trim(BuffingCheck.order_number)).in_(aliases or {normalized}))
                .values(order_progress=payload.order_progress)
            )
        elif payload.machine_id == "SC-01":
            db.execute(
                update(ScouringRecord)
                .where(ScouringRecord.machine_id == payload.machine_id, func.upper(func.trim(ScouringRecord.order_number)).in_(aliases or {normalized}))
                .values(order_progress=payload.order_progress)
            )
        elif payload.machine_id in {"TE-01", "TE-02"}:
            db.execute(
                update(TenteringOrder)
                .where(
                    TenteringOrder.machine_id == payload.machine_id,
                    func.upper(func.trim(TenteringOrder.sop_no)).in_(aliases or {normalized}),
                )
                .values(order_progress=payload.order_progress)
            )
        else:
            db.execute(
                update(TransferRecord)
                .where(TransferRecord.machine_id == payload.machine_id, TransferRecord.order_number.in_(aliases or {normalized}))
                .values(order_progress=payload.order_progress)
            )
        db.commit()
        db.refresh(state)
    except Exception:
        db.rollback()
        raise
    return state_response(state)
