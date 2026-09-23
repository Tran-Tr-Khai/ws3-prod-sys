from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.support import SupportMessage, SupportTicket, SupportTicketRead
from app.models.user import User
from app.schemas.support import SupportMessageCreate, SupportMessageResponse, SupportStatusUpdate, SupportTicketCreate, SupportTicketResponse
from app.security.auth import get_current_user, role_codes

router = APIRouter(prefix="/support", tags=["support"])


def frontend_role(user: User) -> str:
    codes = role_codes(user)
    return "ADMIN" if "ADMIN" in codes else "SUPERVISOR" if "SUPERVISOR" in codes or "PRODUCTION_MANAGER" in codes else "OPERATOR"


def can_manage(user: User) -> bool:
    return frontend_role(user) in {"ADMIN", "SUPERVISOR"}


def can_view_ticket(ticket: SupportTicket, user: User) -> bool:
    return can_manage(user) or ticket.created_by == user.username


def unread_count(ticket: SupportTicket, user: User, db: Session) -> int:
    read = db.get(SupportTicketRead, {"user_id": user.id, "ticket_id": ticket.id})
    statement = select(SupportMessage).where(SupportMessage.ticket_id == ticket.id)
    if read is not None:
        statement = statement.where(SupportMessage.sent_at > read.read_at)
    messages = list(db.scalars(statement).all())
    if can_manage(user):
        return sum(item.sender_role not in {"ADMIN", "SUPERVISOR"} for item in messages)
    return sum(item.sender_role in {"ADMIN", "SUPERVISOR"} for item in messages)


def ticket_response(ticket: SupportTicket, user: User, db: Session) -> SupportTicketResponse:
    return SupportTicketResponse.model_validate(ticket).model_copy(update={"unread_count": unread_count(ticket, user, db)})


@router.get("/tickets", response_model=list[SupportTicketResponse])
def list_tickets(
    viewer: str | None = Query(default=None),
    role: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SupportTicketResponse]:
    statement = select(SupportTicket).order_by(desc(SupportTicket.updated_at), desc(SupportTicket.id))
    if not can_manage(user):
        statement = statement.where(SupportTicket.created_by == user.username)
    return [ticket_response(ticket, user, db) for ticket in db.scalars(statement).all()]


@router.post("/tickets", response_model=SupportTicketResponse, status_code=201)
def create_ticket(payload: SupportTicketCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SupportTicketResponse:
    if frontend_role(user) == "OPERATOR" and payload.machine_id not in (user.machine_ids or []):
        raise HTTPException(status_code=403, detail="Machine access denied")
    role = frontend_role(user)
    ticket = SupportTicket(machine_id=payload.machine_id, created_by=user.username, creator_role=role, subject=payload.subject, priority=payload.priority, status="NEW")
    ticket.messages.append(SupportMessage(sender=user.username, sender_role=role, message=payload.message))
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket_response(ticket, user, db)


def get_ticket_or_404(ticket_id: int, user: User, db: Session) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None or not can_view_ticket(ticket, user):
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return ticket


@router.get("/tickets/{ticket_id}/messages", response_model=list[SupportMessageResponse])
def list_messages(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[SupportMessage]:
    get_ticket_or_404(ticket_id, user, db)
    return list(db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == ticket_id).order_by(SupportMessage.sent_at, SupportMessage.id)).all())


@router.post("/tickets/{ticket_id}/read", status_code=204)
def mark_ticket_read(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    get_ticket_or_404(ticket_id, user, db)
    read = db.get(SupportTicketRead, {"user_id": user.id, "ticket_id": ticket_id})
    now = datetime.now(timezone.utc)
    if read is None:
        db.add(SupportTicketRead(user_id=user.id, ticket_id=ticket_id, read_at=now))
    else:
        read.read_at = now
    db.commit()
    return Response(status_code=204)


@router.post("/tickets/{ticket_id}/messages", response_model=SupportMessageResponse, status_code=201)
def create_message(ticket_id: int, payload: SupportMessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SupportMessage:
    ticket = get_ticket_or_404(ticket_id, user, db)
    role = frontend_role(user)
    message = SupportMessage(ticket_id=ticket_id, sender=user.username, sender_role=role, message=payload.message)
    ticket.status = "IN_PROGRESS" if role == "OPERATOR" else ticket.status
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.patch("/tickets/{ticket_id}", response_model=SupportTicketResponse)
def update_ticket(ticket_id: int, payload: SupportStatusUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SupportTicketResponse:
    if not can_manage(user):
        raise HTTPException(status_code=403, detail="Support management access required")
    ticket = get_ticket_or_404(ticket_id, user, db)
    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)
    return ticket_response(ticket, user, db)


@router.delete("/tickets/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> Response:
    if "ADMIN" not in role_codes(user):
        raise HTTPException(status_code=403, detail="Only administrators can delete support tickets")
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None:
        raise HTTPException(status_code=404, detail="Support ticket not found")
    db.delete(ticket)
    db.commit()
    return Response(status_code=204)
