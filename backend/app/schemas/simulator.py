from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


def to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class MachineSnapshot(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )

    machine_id: str
    process: str
    status: Literal["RUNNING", "WARNING", "ALARM", "STOPPED", "MAINTENANCE", "OFFLINE"]
    batch: str | None
    speed: float
    temperature: float
    production_today: float
    operator: str | None
    start_time: datetime
    updated_at: datetime
