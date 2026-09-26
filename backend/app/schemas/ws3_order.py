from datetime import datetime

from pydantic import BaseModel, Field


class WS3OrderImport(BaseModel):
    source_filename: str | None = Field(default=None, max_length=255)
    source_format: str = Field(default="PASTE", max_length=30)
    columns: list[str] = Field(min_length=1)
    rows: list[dict[str, str]] = Field(min_length=1)
    mapping: dict[str, str] = Field(default_factory=dict)
    selected_row_indexes: list[int] | None = None
    import_batch_id: int | None = None


class WS3ImportBatchCreate(WS3OrderImport):
    pass


class WS3ImportBatchResponse(BaseModel):
    id: int
    source_filename: str | None
    source_format: str
    created_at: datetime
    row_count: int
    available_count: int
    duplicate_count: int = 0
    incomplete_key_count: int = 0


class WS3OrderRollResponse(BaseModel):
    id: int
    source_row_index: int
    source_key: str | None
    raw_data: dict[str, str]
    roll_id: str | None
    item_code: str | None
    item_name: str | None
    lot_no: str | None
    machine_no: str | None
    length_meters: float | None
    shift: str | None
    worker: str | None
    remarks: str | None
    status: str


class WS3OrderResponse(BaseModel):
    id: int
    order_no: str
    source_filename: str | None
    source_format: str
    columns: list[str]
    mapping: dict[str, str]
    status: str
    created_at: datetime
    confirmed_at: datetime | None
    rolls: list[WS3OrderRollResponse]
    duplicate_count: int = 0
    new_count: int = 0
    incomplete_key_count: int = 0


class WS3OrderStatusUpdate(BaseModel):
    status: str = Field(pattern="^(CONFIRMED|CANCELLED)$")
