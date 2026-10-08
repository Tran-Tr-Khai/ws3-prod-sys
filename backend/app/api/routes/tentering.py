from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.db.session import get_db
from app.models.tentering import TenteringOrder, TenteringRollEntry
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.schemas.tentering import TenteringOrderInput, TenteringOrderResponse
from app.security.auth import get_current_user, role_codes
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_order_code
from app.services.snapshot_report import build_report


router = APIRouter(prefix="/tentering", tags=["tentering"])
MANAGER_ROLES = {"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}


SUPPORTED_MACHINES = {"TE-01", "TE-02"}


def _authorize(user: User, machine_id: str) -> None:
    normalized_machine = machine_id.strip().upper()
    if normalized_machine not in SUPPORTED_MACHINES:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tentering machine was not found")
    if MANAGER_ROLES.intersection(role_codes(user)):
        return
    if "OPERATOR" in role_codes(user) and normalized_machine in (user.machine_ids or []):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tentering access is required")


def _order_query():
    return select(TenteringOrder).options(selectinload(TenteringOrder.entries))


def _single_value(values: list[str | None]) -> str | None:
    distinct = {value.strip().casefold(): value.strip() for value in values if value and value.strip()}
    return next(iter(distinct.values())) if len(distinct) == 1 else None


@router.get("/orders/{sop_no}/source")
def get_tentering_order_source(
    sop_no: str,
    machine_id: str = Query(default="TE-01", max_length=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict[str, object] | None:
    """Look up safe, unambiguous order fields from the existing production snapshot."""
    _authorize(user, machine_id)
    normalized_sop = sop_no.strip().upper()
    if not normalized_sop:
        return None
    try:
        source_rows, _aliases = resolve_ws3_order_code(db, normalized_sop)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    if not source_rows:
        return None

    exact_sop_rows = [row for row in source_rows if (row.invoice_no or "").strip().upper() == normalized_sop]
    rows = exact_sop_rows or source_rows
    worker_rows = db.scalars(
        select(WS3WorkerRecord).where(func.upper(func.trim(WS3WorkerRecord.sop_no)) == normalized_sop)
    ).all()
    machines = db.scalars(select(WS3MachineWS2Record)).all()
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
            # Tentering should display the MES 7462 DATE column, not a date
            # inferred from the date-like segment embedded in the roll ID.
            {"roll_number": index + 1, "roll_id": roll.get("roll_id"), "weaving_date": roll.get("source_date")}
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
    _authorize(user, machine_id)
    statement = _order_query().where(TenteringOrder.machine_id == machine_id.strip().upper())
    if q.strip():
        statement = statement.where(func.upper(TenteringOrder.sop_no).contains(q.strip().upper()))
    statement = statement.order_by(TenteringOrder.updated_at.desc(), TenteringOrder.id.desc()).limit(limit)
    return list(db.scalars(statement).all())


@router.get("/orders/{sop_no}", response_model=TenteringOrderResponse)
def get_tentering_order(
    sop_no: str,
    machine_id: str = Query(default="TE-01", max_length=20),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> TenteringOrder:
    _authorize(user, machine_id)
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
    _authorize(user, machine_id)
    normalized_sop = sop_no.strip().upper()
    normalized_machine = machine_id.strip().upper()
    if not normalized_sop:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="SOP number is required")

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

        for field, value in payload.model_dump(exclude={"entries"}).items():
            setattr(order, field, value)

        for entry_data in payload.entries:
            entry = db.scalar(
                select(TenteringRollEntry).where(
                    TenteringRollEntry.order_id == order.id,
                    TenteringRollEntry.roll_number == entry_data.roll_number,
                )
            )
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

        db.commit()
        return db.scalar(_order_query().where(TenteringOrder.id == order.id))
    except Exception:
        db.rollback()
        raise
