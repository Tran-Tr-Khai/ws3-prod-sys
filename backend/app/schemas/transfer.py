from datetime import date, datetime, timezone
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _finite_nonnegative(value: float) -> float:
    if value != value or value in (float("inf"), float("-inf")) or value < 0:
        raise ValueError("must be a finite nonnegative number")
    return value


class TransferRecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: Literal["HT-01"] = "HT-01"
    production_date: date
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    order_number: str = Field(min_length=1, max_length=160)
    operator_name: str = Field(min_length=1, max_length=160)
    operator_identifier: str = Field(min_length=1, max_length=80)
    shift: str = Field(min_length=1, max_length=80)
    order_progress: Literal["IN_PROGRESS", "COMPLETED"] = "IN_PROGRESS"
    item: str = Field(min_length=1, max_length=300)
    buyer: str = Field(min_length=1, max_length=160)
    design: str = Field(min_length=1, max_length=160)
    temperature: float = Field(ge=0)
    speed: float = Field(ge=0)
    quantity_meters: float = Field(ge=0)

    _validate_temperature = field_validator("temperature")(_finite_nonnegative)
    _validate_speed = field_validator("speed")(_finite_nonnegative)
    _validate_quantity = field_validator("quantity_meters")(_finite_nonnegative)


class TransferRecordResponse(TransferRecordCreate):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    created_at: datetime
