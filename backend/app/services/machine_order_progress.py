from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.models.buffing import BuffingCheck
from app.models.machine_order_state import MachineOrderState
from app.models.scouring import ScouringRecord
from app.models.tentering import TenteringOrder
from app.models.transfer import TransferRecord
from app.models.print import PrintRecord
from app.services.ws3_order_codes import AmbiguousWS3OrderCode, resolve_ws3_order_code


ORDER_RECORDS = {
    "BU-01": (BuffingCheck, "order_number"),
    "SC-01": (ScouringRecord, "order_number"),
    "TE-01": (TenteringOrder, "sop_no"),
    "TE-02": (TenteringOrder, "sop_no"),
    "TR-01": (TransferRecord, "order_number"),
    "PR-01": (PrintRecord, "order_number"),
}


def _aliases_for_order(db: Session, order_number: str) -> set[str]:
    """Return every known PKP/SOP alias for one persisted order identifier."""
    try:
        _rows, aliases = resolve_ws3_order_code(db, order_number)
    except AmbiguousWS3OrderCode:
        aliases = set()
    return aliases or {order_number.strip().upper()}


def set_order_progress(db: Session, machine_id: str, order_number: str, progress: str) -> MachineOrderState:
    """
    Create or update the canonical progress state of one machine order.

    Args:
        db: Database session used to persist the machine state.
        machine_id: Machine owning the production order.
        order_number: Canonical order or SOP identifier.
        progress: Target progress code.

    Returns:
        Created or updated machine-order state.
    """
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


def activate_machine_order(
    db: Session,
    machine_id: str,
    order_number: str,
    current_aliases: set[str] | None = None,
    progress: str = "IN_PROGRESS",
) -> MachineOrderState:
    """Make an order current on one machine and complete its previous active order(s)."""
    normalized_machine = machine_id.strip().upper()
    normalized_order = order_number.strip().upper()
    current_aliases = current_aliases or _aliases_for_order(db, normalized_order)
    model_and_field = ORDER_RECORDS.get(normalized_machine)

    active_states = db.scalars(
        select(MachineOrderState).where(
            MachineOrderState.machine_id == normalized_machine,
            MachineOrderState.order_progress == "IN_PROGRESS",
        )
    ).all()
    for state in active_states:
        previous_aliases = _aliases_for_order(db, state.order_number)
        if previous_aliases.intersection(current_aliases):
            continue
        state.order_progress = "COMPLETED"
        if model_and_field is not None:
            model, order_field = model_and_field
            order_column = getattr(model, order_field)
            db.execute(
                update(model)
                .where(
                    model.machine_id == normalized_machine,
                    func.upper(func.trim(order_column)).in_(previous_aliases),
                )
                .values(order_progress="COMPLETED")
            )

    state = set_order_progress(db, normalized_machine, normalized_order, progress)
    if model_and_field is not None:
        model, order_field = model_and_field
        order_column = getattr(model, order_field)
        db.execute(
            update(model)
            .where(
                model.machine_id == normalized_machine,
                func.upper(func.trim(order_column)).in_(current_aliases),
            )
            .values(order_progress=progress)
        )
    return state
