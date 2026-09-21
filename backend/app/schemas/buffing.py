from datetime import date, datetime, timezone

from pydantic import BaseModel, ConfigDict, Field


class BuffingCheckCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: str = Field(default="BU-01", min_length=1, max_length=50)
    check_date: date
    checked_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    operator_name: str = Field(min_length=1, max_length=160)
    check_1: bool = False
    check_2: bool = False
    check_3: bool = False
    check_4: bool = False
    check_5: bool = False
    remark: str | None = Field(default=None, max_length=500)


class BuffingCheckResponse(BuffingCheckCreate):
    model_config = ConfigDict(from_attributes=True, extra="forbid")

    id: int
    created_at: datetime
    # Legacy checks may predate the required-operator rule.
    # New records remain protected by BuffingCheckCreate above.
    operator_name: str | None = None
