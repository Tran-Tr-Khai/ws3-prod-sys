from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.routes.machine_orders import _authorize_machine
from app.db.session import get_db
from app.models.user import User
from app.models.ws3_production import WS3MachineWS2Record
from app.security.auth import get_current_user
from app.services.machine_overview import get_overview, get_overview_details
from app.services.snapshot_report import build_report
from app.services.snapshot_sources import key
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_order_code

router = APIRouter(prefix='/machine-overview', tags=['machine-overview'])


@router.get('/{machine_id}')
def overview(machine_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _authorize_machine(user, machine_id)
    return get_overview(db, machine_id)


@router.get('/{machine_id}/details')
def details(machine_id: str, record_id: int = Query(gt=0), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _authorize_machine(user, machine_id)
    try:
        result = get_overview_details(db, machine_id, record_id)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if result is None:
        raise HTTPException(status_code=404, detail='Record no longer exists')
    return result


@router.get('/{machine_id}/mes')
def mes(machine_id: str, sop: str = Query(min_length=1, max_length=160), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _authorize_machine(user, machine_id)
    try:
        orders, _aliases = resolve_ws3_order_code(db, sop)
    except AmbiguousWS3OrderCode as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if not orders:
        return None
    # A PKP can group several SOPs. A Home card represents the selected SOP,
    # while legacy records saved as PKP still use the full linked order.
    exact_orders = [order for order in orders if (order.invoice_no or '').strip().upper() == sop.strip().upper()]
    orders = exact_orders or orders
    # Reuse the established roll matching rules. Worker attribution is not needed
    # for Home: it comes from the saved machine record, not the MES snapshot.
    invoices = {key(order.invoice_no) for order in orders if key(order.invoice_no)}
    # Match exactly the existing whitespace-insensitive snapshot keys without
    # materializing every roll and its raw JSON for each Home card.
    ids = [row.id for row in db.execute(select(WS3MachineWS2Record.id, WS3MachineWS2Record.out_dyeing_sop))
           if key(row.out_dyeing_sop) in invoices]
    machines = db.scalars(select(WS3MachineWS2Record).where(WS3MachineWS2Record.id.in_(ids))).all() if ids else []
    report = build_report(orders, machines, [], None)['orders'][0]
    rolls = report['rolls']
    complete = bool(rolls) and all(roll['length_meters'] is not None for roll in rolls)
    return {
        'item': report['item_name'] or report['item_code'], 'lot': report['lot_no'],
        'rolls': report['matched_rolls'],
        'input': sum(roll['length_meters'] for roll in rolls) if complete else None,
    }
