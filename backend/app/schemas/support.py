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
    sender_name: str = ""
    sender_role: str
    sent_at: datetime


class SupportTicketCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    machine_id: str = Field(min_length=1, max_length=50)
    recipient_role: str = Field(default="SUPERVISOR", max_length=20)
    recipient_group: str | None = Field(default=None, max_length=50)
    subject: str = Field(min_length=1, max_length=160)
    priority: str = Field(default="NORMAL", max_length=20)
    message: str = Field(min_length=1, max_length=2000)


class SupportTicketResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: str
    created_by: str
    created_by_name: str = ""
    creator_role: str
    recipient_role: str
    recipient_group: str | None = None
    subject: str
    priority: str
    status: str
    created_at: datetime
    updated_at: datetime
    last_message_sender_name: str = ""
    last_message: str = ""
    unread_count: int = 0


class SupportMachineNoticeResponse(BaseModel):
    recipient_group: str
    subject: str
    message: str
    sender_name: str
    sent_at: datetime
    priority: str


class SupportOperationalNoticeResponse(BaseModel):
    id: int
    ticket_id: int
    recipient_group: str
    sender: str
    sender_role: str
    subject: str
    message: str
    sender_name: str
    sent_at: datetime
    priority: str


class SupportStatusUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str = Field(min_length=1, max_length=20)
