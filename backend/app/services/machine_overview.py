"""Small Home snapshots. Core reads never wait for MES or load history relationships."""
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import Session, raiseload

from app.models.buffing import BuffingCheck
from app.models.machine_order_state import MachineOrderState
from app.models.scouring import ScouringRecord
from app.models.tentering import TenteringOrder, TenteringRollEntry
from app.services.machine_order_progress import ORDER_RECORDS
from app.services.ws3_order_codes import resolve_ws3_order_code


def _source(machine_id):
    model, sop = ORDER_RECORDS[machine_id]
    timestamp = model.checked_at if model is BuffingCheck else model.updated_at if model is TenteringOrder else model.recorded_at
    return model, getattr(model, sop), timestamp


def get_overview(db: Session, machine_id: str):
    model, sop, timestamp = _source(machine_id)
    # Canonical state takes precedence over a legacy row's copied progress.
    state = select(MachineOrderState.order_progress).where(
        MachineOrderState.machine_id == machine_id,
        MachineOrderState.order_number == func.upper(func.trim(sop)),
    ).scalar_subquery()
    progress = func.coalesce(state, model.order_progress)
    query = select(model, progress).where(model.machine_id == machine_id).options(raiseload('*'))
    query = query.order_by(timestamp.desc(), model.id.desc())
    row = db.execute(query.where(progress == 'IN_PROGRESS').limit(1)).first()
    if row is None:
        row = db.execute(query.limit(1)).first()
    if row is None:
        return None
    record, current_progress = row
    result = {
        'id': record.id, 'machine_id': machine_id, 'sop': getattr(record, sop.key),
        'progress': current_progress, 'shift': record.shift,
        'operator': record.operator_name, 'employee': record.operator_identifier,
        'recorded': getattr(record, timestamp.key),
        'started': record.created_at if model is TenteringOrder else None,
        'item': getattr(record, 'item', getattr(record, 'item_description', None)),
        'lot': getattr(record, 'lot_number', None), 'output': None,
        'speed': getattr(record, 'speed', None), 'temperature': getattr(record, 'temperature', None),
        'inspection': None,
    }
    if model is ScouringRecord:
        result['output'] = record.production_quantity_meters if record.production_quantity_meters is not None else record.output_fabric_meters
        complete = all(getattr(record, name) is not None for name in ('naoh', 'soap', 'desizer', 'h2o2', 'chelate', 'speed', 'temperature', 'cylinder_temperature'))
        result['inspection'] = 'PASS' if complete and 40 <= record.speed <= 50 and 90 <= record.temperature <= 98 else 'WARNING'
    elif model is not BuffingCheck and model is not TenteringOrder:
        result['output'] = record.quantity_meters
    return result


def get_overview_details(db: Session, machine_id: str, record_id: int):
    model, sop, timestamp = _source(machine_id)
    record = db.scalar(select(model).where(model.machine_id == machine_id, model.id == record_id).options(raiseload('*')))
    if record is None:
        return None
    if model is TenteringOrder:
        count, output = db.execute(select(func.count(TenteringRollEntry.id), func.sum(TenteringRollEntry.actual_quantity)).where(TenteringRollEntry.order_id == record_id)).one()
        return {'started': record.created_at, 'rolls': count, 'output': output}
    order_number = getattr(record, sop.key)
    if order_number:
        _, aliases = resolve_ws3_order_code(db, order_number)
        predicate = func.upper(func.trim(sop)).in_(aliases or {order_number.strip().upper()})
    else:
        predicate = model.id == record_id
    filters = (model.machine_id == machine_id, predicate)
    if model is BuffingCheck:
        failed = or_(*(getattr(model, f'check_{i}').is_(False) for i in range(1, 6)))
        started, total, errors = db.execute(select(func.min(timestamp), func.count(model.id), func.sum(case((failed, 1), else_=0))).where(*filters)).one()
        return {'started': started, 'checks': total, 'failed_checks': errors or 0, 'inspection': 'WARNING' if errors else 'PASS'}
    return {'started': db.scalar(select(func.min(timestamp)).where(*filters))}
