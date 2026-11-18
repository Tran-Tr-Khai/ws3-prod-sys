"""Authorization rules shared by machine-facing API routes.

Keep machine access checks out of individual route implementations so a new
route cannot accidentally expose production data without the same guard.
"""

from collections.abc import Collection

from fastapi import HTTPException, status

from app.models.user import User
from app.security.auth import role_codes


MANAGER_ROLES = frozenset({"ADMIN", "SUPERVISOR", "PRODUCTION_MANAGER"})
MACHINE_IDS = frozenset({"BU-01", "SC-01", "TE-01", "TE-02", "TR-01", "PR-01"})


def normalize_machine_id(machine_id: str) -> str:
    """
    Convert a user-supplied machine ID to its canonical form.

    Args:
        machine_id: Machine identifier from a route, query parameter or payload.

    Returns:
        Trimmed, uppercase machine identifier.
    """
    return machine_id.strip().upper()


def require_machine_access(
    user: User,
    machine_id: str,
    *,
    supported_machines: Collection[str] = MACHINE_IDS,
    not_found_detail: str = "Machine was not found",
    not_found_status: int = status.HTTP_404_NOT_FOUND,
) -> str:
    """
    Authorize access to one production machine.

    Managers can access every machine enabled by the feature. Other users are
    limited to the machine identifiers assigned on their account.

    Args:
        user: Authenticated MES user.
        machine_id: Requested machine identifier.
        supported_machines: Machines enabled by the calling feature.
        not_found_detail: Safe message used for an unsupported machine.
        not_found_status: HTTP status used when the machine is unsupported.

    Returns:
        Canonical uppercase machine identifier.

    Raises:
        HTTPException: `not_found_status` when the feature does not support
            the machine, or 403 when the user is not assigned to it.
    """
    normalized_machine = normalize_machine_id(machine_id)
    if normalized_machine not in supported_machines:
        raise HTTPException(status_code=not_found_status, detail=not_found_detail)
    if role_codes(user).intersection(MANAGER_ROLES):
        return normalized_machine
    assigned_machines = {normalize_machine_id(value) for value in (user.machine_ids or [])}
    if normalized_machine in assigned_machines:
        return normalized_machine
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=f"{normalized_machine} access is required")
