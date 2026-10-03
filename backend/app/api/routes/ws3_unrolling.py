from collections import defaultdict
from datetime import date
import re
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3WorkerRecord
from app.models.ws3_unrolling import WS3UnrollingRollEvent
from app.schemas.ws3_unrolling import (
    WS3UnrollingActionResponse,
    WS3UnrollingOrderResponse,
    WS3UnrollingOrdersResponse,
    WS3UnrollingRollAction,
    WS3UnrollingRollResponse,
)
from app.security.auth import get_current_user, role_codes
from app.services.snapshot_report import build_report


router = APIRouter(prefix="/ws3/unrolling", tags=["ws3-unrolling"])
MANAGER_ROLES = {"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"}
UNROLLING_PREFIX = "UN-"


def _is_unrolling_operator(user: User) -> bool:
    return "OPERATOR" in role_codes(user) and any(
        str(machine_id).strip().upper().startswith(UNROLLING_PREFIX)
        for machine_id in (user.machine_ids or [])
    )


def _stable_code(value: str) -> str:
    return value.strip().upper()


def _require_unrolling_read(user: User) -> None:
    if MANAGER_ROLES.intersection(role_codes(user)) or _is_unrolling_operator(user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unrolling access is required")


def _require_unrolling_write(user: User) -> None:
    if _is_unrolling_operator(user):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only assigned Unrolling workers can record roll movement")


def _events_by_roll(db: Session, pk_numbers: list[str]) -> dict[tuple[str, str], dict[str, WS3UnrollingRollEvent]]:
    if not pk_numbers:
        return {}
    stable_pk_numbers = {_stable_code(pk_no) for pk_no in pk_numbers}
    events = db.scalars(
        select(WS3UnrollingRollEvent)
        .where(func.upper(WS3UnrollingRollEvent.pk_no).in_(stable_pk_numbers))
        .order_by(WS3UnrollingRollEvent.id)
    ).all()
    indexed: dict[tuple[str, str], dict[str, WS3UnrollingRollEvent]] = defaultdict(dict)
    for event in events:
        if _stable_code(event.pk_no) not in stable_pk_numbers:
            continue
        state = indexed[(_stable_code(event.pk_no), _stable_code(event.roll_id))]
        if event.event_type == "COLLECTED":
            state["COLLECTED"] = event
        elif event.event_type == "COLLECTION_UNDONE":
            state.pop("COLLECTED", None)
        elif event.event_type == "TRANSFERRED_TO_PRODUCTION":
            state["TRANSFERRED_TO_PRODUCTION"] = event
        elif event.event_type == "TRANSFER_UNDONE":
            state.pop("TRANSFERRED_TO_PRODUCTION", None)
    return indexed


def _serialize_report_order(
    report_order: dict[str, object],
    events: dict[tuple[str, str], dict[str, WS3UnrollingRollEvent]],
) -> WS3UnrollingOrderResponse:
    pk_no = str(report_order["pk_no"])
    rolls: list[WS3UnrollingRollResponse] = []
    for report_roll in report_order["rolls"]:  # type: ignore[union-attr]
        roll_id = str(report_roll.get("roll_id") or "").strip()
        if not roll_id:
            continue
        state_events = events.get((_stable_code(pk_no), _stable_code(roll_id)), {})
        collected = state_events.get("COLLECTED")
        transferred = state_events.get("TRANSFERRED_TO_PRODUCTION")
        rolls.append(WS3UnrollingRollResponse(
            roll_id=roll_id,
            machine_no=report_roll.get("machine_no"),
            length_meters=report_roll.get("length_meters"),
            collection_status="TRANSFERRED" if transferred else "COLLECTED" if collected else "WAITING",
            collected_at=collected.occurred_at if collected else transferred.occurred_at if transferred else None,
            collected_by=(collected.worker_name or collected.actor_label) if collected else transferred.actor_label if transferred else None,
            collected_worker_id=collected.worker_id if collected else None,
            collected_shift=collected.worker_shift if collected else None,
            transferred_at=transferred.occurred_at if transferred else None,
            transferred_by=transferred.actor_label if transferred else None,
        ))
    collected_rolls = sum(roll.collection_status in {"COLLECTED", "TRANSFERRED"} for roll in rolls)
    transferred_rolls = sum(roll.collection_status == "TRANSFERRED" for roll in rolls)
    return WS3UnrollingOrderResponse(
        pk_no=pk_no,
        production_date=str(report_order["production_date"]),
        item_code=report_order.get("item_code"),
        item_name=report_order.get("item_name"),
        lot_no=report_order.get("lot_no"),
        expected_rolls=int(report_order["expected_rolls"]),
        matched_rolls=len(rolls),
        collected_rolls=collected_rolls,
        transferred_rolls=transferred_rolls,
        collection_complete=bool(rolls) and collected_rolls == len(rolls) == int(report_order["expected_rolls"]),
        status=report_order["status"],  # type: ignore[arg-type]
        warnings=report_order["warnings"],  # type: ignore[arg-type]
        rolls=rolls,
    )


def _current_report_order(db: Session, pk_no: str) -> dict[str, object]:
    order_lines = db.scalars(
        select(WS3ProductionOrder).where(WS3ProductionOrder.pk_no == pk_no)
    ).all()
    if not order_lines:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Production order was not found in the current snapshot")
    dates = {line.production_date for line in order_lines if line.production_date}
    machines = db.scalars(select(WS3MachineWS2Record)).all()
    workers = db.scalars(select(WS3WorkerRecord)).all()
    for production_date in sorted(dates):
        report = build_report(
            [line for line in order_lines if line.production_date == production_date],
            machines,
            workers,
            production_date,
        )
        match = next((order for order in report["orders"] if order["pk_no"] == pk_no), None)
        if match:
            return match
    raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="The order has no current roll data to process")


@router.get("/orders", response_model=WS3UnrollingOrdersResponse)
def list_unrolling_orders(
    q: Annotated[str, Query(max_length=160)] = "",
    limit: Annotated[int, Query(ge=1, le=500)] = 200,
    order_date: date | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WS3UnrollingOrdersResponse:
    _require_unrolling_read(user)
    statement = select(WS3ProductionOrder).where(
        WS3ProductionOrder.pk_no.is_not(None), WS3ProductionOrder.pk_no != "",
        WS3ProductionOrder.production_date.is_not(None),
    )
    if q.strip():
        statement = statement.where(WS3ProductionOrder.pk_no.icontains(q.strip(), autoescape=True))
    if order_date is not None:
        statement = statement.where(WS3ProductionOrder.production_date == order_date.isoformat())
    source_orders = db.scalars(statement).all()
    if not source_orders:
        return WS3UnrollingOrdersResponse(orders=[])
    machines = db.scalars(select(WS3MachineWS2Record)).all()
    workers = db.scalars(select(WS3WorkerRecord)).all()
    # Index each snapshot once, not once per historical production day.
    report_orders = build_report(source_orders, machines, workers, None)["orders"]
    events = _events_by_roll(db, [str(order["pk_no"]) for order in report_orders])
    orders = [_serialize_report_order(order, events) for order in report_orders]
    orders = [order for order in orders if order.matched_rolls]
    def order_sort_key(order: WS3UnrollingOrderResponse) -> tuple[bool, int, tuple[tuple[int, object], ...]]:
        # Pending orders first; within a date, PKP sequence increases naturally.
        date_ordinal = date.fromisoformat(order.production_date).toordinal()
        pk_parts = tuple(
            (1, int(part)) if part.isdigit() else (0, part.casefold())
            for part in re.split(r"(\d+)", order.pk_no)
        )
        return order.collection_complete, -date_ordinal, pk_parts

    orders.sort(key=order_sort_key)
    return WS3UnrollingOrdersResponse(orders=orders[:limit])


@router.post("/roll-actions", response_model=WS3UnrollingActionResponse)
def record_unrolling_roll_action(
    payload: WS3UnrollingRollAction,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> WS3UnrollingActionResponse:
    _require_unrolling_write(user)
    worker_name = (payload.worker_name or "").strip()
    worker_id = (payload.worker_id or "").strip()
    worker_shift = (payload.worker_shift or "").strip()
    if not worker_name or not worker_id or not worker_shift:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Worker name, employee ID, and shift are required before recording a roll action",
        )
    report_order = _current_report_order(db, payload.pk_no)
    current_roll_ids = {
        _stable_code(str(roll.get("roll_id") or ""))
        for roll in report_order["rolls"]  # type: ignore[union-attr]
        if str(roll.get("roll_id") or "").strip()
    }
    stable_pk_no = _stable_code(payload.pk_no)
    stable_roll_id = _stable_code(payload.roll_id)
    if stable_roll_id not in current_roll_ids:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roll is not part of this order in the current snapshot")

    history = db.scalars(select(WS3UnrollingRollEvent).where(
        WS3UnrollingRollEvent.pk_no == stable_pk_no,
        WS3UnrollingRollEvent.roll_id == stable_roll_id,
    ).order_by(WS3UnrollingRollEvent.id)).all()
    collected_event = None
    transferred_event = None
    for event in history:
        if event.event_type == "COLLECTED":
            collected_event = event
        elif event.event_type == "COLLECTION_UNDONE":
            collected_event = None
        elif event.event_type == "TRANSFERRED_TO_PRODUCTION":
            transferred_event = event
        elif event.event_type == "TRANSFER_UNDONE":
            transferred_event = None

    if payload.action == "UNDO_COLLECTION":
        if transferred_event:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Undo the production handoff first")
        if not collected_event:
            return WS3UnrollingActionResponse(pk_no=payload.pk_no, roll_id=payload.roll_id, collection_status="WAITING", changed=False)
        event_type = "COLLECTION_UNDONE"
        response_status = "WAITING"
    elif payload.action == "TRANSFER_TO_PRODUCTION":
        if transferred_event:
            return WS3UnrollingActionResponse(pk_no=payload.pk_no, roll_id=payload.roll_id, collection_status="TRANSFERRED", changed=False)
        if not collected_event:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Collect the roll before transferring it to production")
        event_type = "TRANSFERRED_TO_PRODUCTION"
        response_status = "TRANSFERRED"
    elif payload.action == "COLLECT":
        if collected_event or transferred_event:
            return WS3UnrollingActionResponse(
                pk_no=payload.pk_no,
                roll_id=payload.roll_id,
                collection_status="TRANSFERRED" if transferred_event else "COLLECTED",
                changed=False,
            )
        event_type = "COLLECTED"
        response_status = "COLLECTED"
    else:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Unsupported roll action")

    event = WS3UnrollingRollEvent(
        pk_no=stable_pk_no,
        roll_id=stable_roll_id,
        event_type=event_type,
        actor_user_id=user.id,
        actor_label=(user.full_name or user.username)[:160],
        worker_name=worker_name[:160],
        worker_id=worker_id[:80],
        worker_shift=worker_shift[:80],
    )
    db.add(event)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        # The unique event key makes concurrent scans safe; let the client reload
        # when another worker wins the race rather than risking a duplicate count.
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This roll was updated by another worker. Refresh the order and try again.") from exc

    return WS3UnrollingActionResponse(
        pk_no=payload.pk_no,
        roll_id=payload.roll_id,
        collection_status=response_status,  # type: ignore[arg-type]
        changed=True,
    )
