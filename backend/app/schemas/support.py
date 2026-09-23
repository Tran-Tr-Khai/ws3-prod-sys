from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class SupportMessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: str = Field(min_length=1, max_length=2000)


class SupportMessageResponse(SupportMessageCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    ticket_id: int
    sender: str
    sender_role: str
    sent_at: datetime


class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: str = Field(min_length=1, max_length=50)
    subject: str = Field(min_length=1, max_length=160)
    priority: str = Field(default="NORMAL", max_length=20)
    message: str = Field(min_length=1, max_length=2000)


class SupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: str
    created_by: str
    creator_role: str
    subject: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    unread_count: int = 0


class SupportStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(min_length=1, max_length=20)
