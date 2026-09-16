from collections.abc import Sequence
from typing import Protocol

from app.schemas.simulator import MachineSnapshot


class MachineDataSource(Protocol):
    def get_machines(self) -> Sequence[MachineSnapshot]:
        """Return the latest snapshot for every configured machine."""

    def get_machine(self, machine_id: str) -> MachineSnapshot | None:
        """Return the latest snapshot for one machine, if it exists."""
