from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class WS3UnrollingRollAction(BaseModel):
    pk_no: str = Field(min_length=1, max_length=160)
    roll_id: str = Field(min_length=1, max_length=160)
    action: Literal["COLLECT", "UNDO_COLLECTION", "TRANSFER_TO_PRODUCTION"]
    worker_name: str | None = Field(default=None, min_length=1, max_length=160)
    worker_id: str | None = Field(default=None, min_length=1, max_length=80)
    worker_shift: str | None = Field(default=None, min_length=1, max_length=80)


class WS3UnrollingRollResponse(BaseModel):
    roll_id: str
    machine_no: str | None
    length_meters: float | None
    collection_status: Literal["WAITING", "COLLECTED", "TRANSFERRED"]
    collected_at: datetime | None
    collected_by: str | None
    collected_worker_id: str | None
    collected_shift: str | None
    transferred_at: datetime | None
    transferred_by: str | None


class WS3UnrollingOrderResponse(BaseModel):
    pk_no: str
    production_date: str
    item_code: str | None
    item_name: str | None
    lot_no: str | None
    expected_rolls: int
    matched_rolls: int
    collected_rolls: int
    transferred_rolls: int
    collection_complete: bool
    status: Literal["READY", "CHECK"]
    warnings: list[str]
    rolls: list[WS3UnrollingRollResponse]


class WS3UnrollingOrdersResponse(BaseModel):
    orders: list[WS3UnrollingOrderResponse]


class WS3UnrollingActionResponse(BaseModel):
    pk_no: str
    roll_id: str
    collection_status: Literal["WAITING", "COLLECTED", "TRANSFERRED"]
    changed: bool


