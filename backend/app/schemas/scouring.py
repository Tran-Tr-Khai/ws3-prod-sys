from datetime import datetime, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator


def _finite_number(value: float) -> float:
    if value != value or value in (float("inf"), float("-inf")):
        raise ValueError("must be a finite number")
    return value


class ScouringRecordCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: str = Field(min_length=1, max_length=50)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    batch_identifier: str | None = Field(default=None, max_length=80)
    order_number: str | None = Field(default=None, max_length=80)
    item: str | None = Field(default=None, max_length=120)
    lot_yarn: str | None = Field(default=None, max_length=80)
    lot_number: str | None = Field(default=None, max_length=80)
    operator_name: str | None = Field(default=None, max_length=160)
    operator_identifier: str | None = Field(default=None, max_length=80)

    naoh: float
    soap: float
    desizer: float
    h2o2: float
    chelate: float
    speed: float = Field(ge=0)
    temperature: float
    cylinder_temperature: float
    input_fabric_meters: float | None = Field(default=None, ge=0)
    output_fabric_meters: float | None = Field(default=None, ge=0)
    production_quantity_meters: float | None = Field(default=None, ge=0)

    _validate_naoh = field_validator("naoh")(_finite_number)
    _validate_soap = field_validator("soap")(_finite_number)
    _validate_desizer = field_validator("desizer")(_finite_number)
    _validate_h2o2 = field_validator("h2o2")(_finite_number)
    _validate_chelate = field_validator("chelate")(_finite_number)
    _validate_speed = field_validator("speed")(_finite_number)
    _validate_temperature = field_validator("temperature")(_finite_number)
    _validate_cylinder_temperature = field_validator("cylinder_temperature")(_finite_number)
    _validate_input_fabric_meters = field_validator("input_fabric_meters")(_finite_number)
    _validate_output_fabric_meters = field_validator("output_fabric_meters")(_finite_number)


class ScouringRecordResponse(ScouringRecordCreate):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    created_at: datetime


class ScouringPhInspectionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    scouring_record_id: int = Field(gt=0)
    inspected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    operator_name: str | None = Field(default=None, max_length=160)
    tank_0_ph: float | None = None
    tank_1_ph: float | None = None
    tank_2_ph: float | None = None
    tank_3_ph: float | None = None
    tank_4_ph: float | None = None
    tank_5_ph: float | None = None
    tank_6_ph: float | None = None
    tank_7_ph: float | None = None
    note: str | None = Field(default=None, max_length=500)

    @field_validator(
        "tank_0_ph", "tank_1_ph", "tank_2_ph", "tank_3_ph",
        "tank_4_ph", "tank_5_ph", "tank_6_ph", "tank_7_ph",
    )
    @classmethod
    def validate_ph(cls, value: float | None) -> float | None:
        if value is not None:
            _finite_number(value)
        return value

class ScouringPhInspectionResponse(ScouringPhInspectionCreate):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    created_at: datetime
