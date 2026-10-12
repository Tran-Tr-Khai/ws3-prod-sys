from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _finite_nonnegative(value: float | None) -> float | None:
    if value is not None and (value != value or value in (float("inf"), float("-inf")) or value < 0):
        raise ValueError("must be a finite non-negative number")
    return value


class TenteringRollEntryInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    roll_number: int = Field(ge=1, le=500)
    roll_id: str | None = Field(default=None, max_length=160)
    tenter_date: date | None = None
    weaving_date: date | None = None
    planned_quantity: float | None = None
    actual_quantity: float | None = None
    note: str | None = Field(default=None, max_length=1000)

    _validate_planned = field_validator("planned_quantity")(_finite_nonnegative)
    _validate_actual = field_validator("actual_quantity")(_finite_nonnegative)


class TenteringOrderInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    operator_name: str | None = Field(default=None, max_length=160)
    operator_identifier: str | None = Field(default=None, max_length=80)
    shift: str | None = Field(default=None, max_length=40)
    order_progress: Literal["IN_PROGRESS", "COMPLETED"] = "IN_PROGRESS"
    customer: str | None = Field(default=None, max_length=160)
    item_description: str | None = Field(default=None, max_length=300)
    warp_yarn: str | None = Field(default=None, max_length=160)
    weft_yarn: str | None = Field(default=None, max_length=160)
    greige_density_pick: float | None = Field(default=None, ge=0)
    finish_density_pick: float | None = Field(default=None, ge=0)
    shrink_percent: float | None = Field(default=None, ge=0)
    greige_width_inch: float | None = Field(default=None, ge=0)
    finish_width_inch: float | None = Field(default=None, ge=0)
    fabric_received_date: date | None = None
    entries: list[TenteringRollEntryInput] = Field(default_factory=list, max_length=500)

    @field_validator("greige_density_pick", "finish_density_pick", "shrink_percent", "greige_width_inch", "finish_width_inch")
    @classmethod
    def validate_finite(cls, value: float | None) -> float | None:
        return _finite_nonnegative(value)

    @field_validator("entries")
    @classmethod
    def validate_unique_roll_numbers(cls, entries: list[TenteringRollEntryInput]) -> list[TenteringRollEntryInput]:
        numbers = [entry.roll_number for entry in entries]
        if len(numbers) != len(set(numbers)):
            raise ValueError("roll_number values must be unique")
        return entries


class TenteringRollEntryResponse(TenteringRollEntryInput):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    recorded_by_name: str | None
    created_at: datetime
    updated_at: datetime


class TenteringOrderResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    machine_id: str
    sop_no: str
    operator_name: str | None
    operator_identifier: str | None
    shift: str | None
    order_progress: Literal["IN_PROGRESS", "COMPLETED"]
    customer: str | None
    item_description: str | None
    warp_yarn: str | None
    weft_yarn: str | None
    greige_density_pick: float | None
    finish_density_pick: float | None
    shrink_percent: float | None
    greige_width_inch: float | None
    finish_width_inch: float | None
    fabric_received_date: date | None
    created_at: datetime
    updated_at: datetime
    entries: list[TenteringRollEntryResponse]
