import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from app.schemas.simulator import MachineSnapshot


@dataclass(frozen=True)
class MachineDefinition:
    machine_id: str
    process: str
    status: str
    batch: str
    base_speed: float
    base_temperature: float
    base_production_today: float
    operator: str
    start_time: datetime


class MockMachineSimulator:
    """Deterministic in-memory machine source for development and UI integration."""

    def __init__(self) -> None:
        now = datetime.now(timezone.utc)
        self._machines = (
            MachineDefinition(
                machine_id="SC-01",
                process="SCOURING",
                status="RUNNING",
                batch="B-SC-260916-01",
                base_speed=42.5,
                base_temperature=93.8,
                base_production_today=852.0,
                operator="Nguyen Van An",
                start_time=now - timedelta(hours=2, minutes=18),
            ),
            MachineDefinition(
                machine_id="SC-02",
                process="SCOURING",
                status="RUNNING",
                batch="B-SC-260916-02",
                base_speed=38.2,
                base_temperature=91.6,
                base_production_today=694.0,
                operator="Tran Thi Binh",
                start_time=now - timedelta(hours=1, minutes=42),
            ),
            MachineDefinition(
                machine_id="TN-01",
                process="TENTER",
                status="WARNING",
                batch="B-TN-260916-01",
                base_speed=27.8,
                base_temperature=168.4,
                base_production_today=518.0,
                operator="Le Van Cuong",
                start_time=now - timedelta(minutes=56),
            ),
            MachineDefinition(
                machine_id="DY-01",
                process="DYEING",
                status="STOPPED",
                batch="B-DY-260916-01",
                base_speed=0.0,
                base_temperature=27.0,
                base_production_today=0.0,
                operator="Pham Thi Dung",
                start_time=now - timedelta(hours=4, minutes=5),
            ),
        )

    def get_machines(self) -> tuple[MachineSnapshot, ...]:
        return tuple(self._snapshot(machine) for machine in self._machines)

    def get_machine(self, machine_id: str) -> MachineSnapshot | None:
        normalized_id = machine_id.upper()
        machine = next(
            (item for item in self._machines if item.machine_id == normalized_id),
            None,
        )
        return self._snapshot(machine) if machine else None

    @staticmethod
    def _snapshot(machine: MachineDefinition) -> MachineSnapshot:
        elapsed_seconds = datetime.now(timezone.utc).timestamp()
        phase = elapsed_seconds / 7.0 + sum(ord(char) for char in machine.machine_id)
        variation = math.sin(phase) * 0.7
        speed_variation = math.sin(phase / 1.8) * 0.4

        return MachineSnapshot(
            machine_id=machine.machine_id,
            process=machine.process,
            status=machine.status,
            batch=machine.batch,
            speed=round(max(0.0, machine.base_speed + speed_variation), 1),
            temperature=round(machine.base_temperature + variation, 1),
            production_today=round(
                max(0.0, machine.base_production_today + math.sin(phase / 2.5) * 3.0),
                1,
            ),
            operator=machine.operator,
            start_time=machine.start_time,
            updated_at=datetime.now(timezone.utc),
        )
