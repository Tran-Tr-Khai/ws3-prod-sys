"""Machine-group definitions used by machine-targeted notifications."""

from __future__ import annotations


MACHINE_GROUPS: tuple[tuple[str, str], ...] = (
    ("UNROLLING", "UN"),
    ("BUFFING", "BU"),
    ("SCOURING", "SC"),
    ("DYEING", "DY"),
    ("WASHING", "WA"),
    ("SKACHAR", "SK"),
    ("TENTERING", "TE"),
    ("CALENDARING", "CA"),
    ("RAISING", "RA"),
    ("SUEDING", "SU"),
)

MACHINE_GROUP_CODES = frozenset(group for group, _ in MACHINE_GROUPS)
MACHINE_GROUP_PREFIXES = {prefix: group for group, prefix in MACHINE_GROUPS}


def machine_group_for_id(machine_id: str) -> str | None:
    """Resolve a physical machine id such as UN-02 to its machine group."""

    prefix = machine_id.strip().upper().split("-", 1)[0]
    return MACHINE_GROUP_PREFIXES.get(prefix)


def user_machine_groups(machine_ids: list[str] | None) -> set[str]:
    return {group for machine_id in machine_ids or [] if (group := machine_group_for_id(machine_id))}
