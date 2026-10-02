from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import delete, desc, select
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.support import SupportMessage, SupportTicket, SupportTicketRead
from app.models.user import User
from app.schemas.support import SupportMachineNoticeResponse, SupportMessageCreate, SupportMessageResponse, SupportStatusUpdate, SupportTicketCreate, SupportTicketResponse
from app.security.auth import get_current_user, role_codes
from app.support_groups import MACHINE_GROUP_CODES, machine_group_for_id, user_machine_groups

router = APIRouter(prefix="/support", tags=["support"])
RECIPIENT_ROLES = {"ADMIN", "SUPERVISOR", "ALL"}
MACHINE_RECIPIENT = "MACHINE"


def frontend_role(user: User) -> str:
    codes = role_codes(user)
    return "ADMIN" if "ADMIN" in codes else "SUPERVISOR" if "SUPERVISOR" in codes or "PRODUCTION_MANAGER" in codes else "OPERATOR"


def can_manage(user: User) -> bool:
    return frontend_role(user) in {"ADMIN", "SUPERVISOR"}


def can_view_ticket(ticket: SupportTicket, user: User) -> bool:
    role = frontend_role(user)
    if role == "ADMIN":
        return True
    if role == "SUPERVISOR":
        return ticket.created_by == user.username or ticket.recipient_role in {"SUPERVISOR", "ALL", MACHINE_RECIPIENT}
    ticket_group = ticket.recipient_group or machine_group_for_id(ticket.machine_id)
    return ticket.created_by == user.username or (
        ticket.recipient_role == "ALL"
        or (ticket.recipient_role == MACHINE_RECIPIENT and ticket_group in user_machine_groups(user.machine_ids))
    )


def unread_count(ticket: SupportTicket, user: User, db: Session) -> int:
    read = db.get(SupportTicketRead, {"user_id": user.id, "ticket_id": ticket.id})
    statement = select(SupportMessage).where(SupportMessage.ticket_id == ticket.id)
    if read is not None:
        statement = statement.where(SupportMessage.sent_at > read.read_at)
    messages = list(db.scalars(statement).all())
    return sum(item.sender.casefold() != user.username.casefold() for item in messages)


def display_name(username: str, db: Session) -> str:
    return db.scalar(select(User.full_name).where(User.username == username)) or username


def ticket_response(ticket: SupportTicket, user: User, db: Session) -> SupportTicketResponse:
    latest = db.scalar(
        select(SupportMessage)
        .where(SupportMessage.ticket_id == ticket.id)
        .order_by(desc(SupportMessage.sent_at), desc(SupportMessage.id))
        .limit(1)
    )
    return SupportTicketResponse.model_validate(ticket).model_copy(update={
        "created_by_name": display_name(ticket.created_by, db),
        "last_message_sender_name": display_name(latest.sender, db) if latest else "",
        "last_message": latest.message if latest else "",
        "unread_count": unread_count(ticket, user, db),
    })


@router.get("/tickets", response_model=list[SupportTicketResponse])
def list_tickets(
    viewer: str | None = Query(default=None),
    role: str | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[SupportTicketResponse]:
    statement = select(SupportTicket).order_by(desc(SupportTicket.updated_at), desc(SupportTicket.id))
    groups = user_machine_groups(user.machine_ids)
    if frontend_role(user) == "OPERATOR":
        statement = statement.where(
            (SupportTicket.created_by == user.username)
            | (SupportTicket.recipient_role == "ALL")
            | (
                (SupportTicket.recipient_role == MACHINE_RECIPIENT)
                & (
                    SupportTicket.recipient_group.in_(groups or {"__no_machine_group__"})
                    | SupportTicket.machine_id.in_(user.machine_ids or ["__no_machine__"])
                )
            )
        )
    elif frontend_role(user) == "SUPERVISOR":
        statement = statement.where(
            (SupportTicket.created_by == user.username)
            | (SupportTicket.recipient_role.in_({"SUPERVISOR", "ALL", MACHINE_RECIPIENT}))
        )
    return [ticket_response(ticket, user, db) for ticket in db.scalars(statement).all()]


@router.get("/machine-notices", response_model=list[SupportMachineNoticeResponse])
def list_machine_notices(db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[SupportMachineNoticeResponse]:
    groups = MACHINE_GROUP_CODES if can_manage(user) else user_machine_groups(user.machine_ids)
    if not groups:
        return []
    tickets = db.scalars(
        select(SupportTicket).where(
            SupportTicket.recipient_role == MACHINE_RECIPIENT,
            SupportTicket.recipient_group.in_(groups),
        )
    ).all()
    latest_by_group: dict[str, tuple[SupportTicket, SupportMessage]] = {}
    for ticket in tickets:
        latest_notice = db.scalar(
            select(SupportMessage)
            .where(
                SupportMessage.ticket_id == ticket.id,
                SupportMessage.sender_role.in_({"ADMIN", "SUPERVISOR"}),
            )
            .order_by(desc(SupportMessage.sent_at), desc(SupportMessage.id))
            .limit(1)
        )
        if latest_notice is None:
            continue
        group = ticket.recipient_group or machine_group_for_id(ticket.machine_id)
        current = latest_by_group.get(group) if group else None
        if group and (current is None or latest_notice.sent_at > current[1].sent_at):
            latest_by_group[group] = (ticket, latest_notice)
    result = []
    for group, (ticket, message) in latest_by_group.items():
        result.append(SupportMachineNoticeResponse(
            recipient_group=group,
            subject=ticket.subject,
            message=message.message,
            sender_name=display_name(message.sender, db),
            sent_at=message.sent_at,
            priority=ticket.priority,
        ))
    return sorted(result, key=lambda item: (item.recipient_group, item.sent_at), reverse=False)


@router.post("/tickets", response_model=SupportTicketResponse, status_code=201)
def create_ticket(payload: SupportTicketCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SupportTicketResponse:
    if frontend_role(user) == "OPERATOR" and payload.machine_id not in (user.machine_ids or []):
        raise HTTPException(status_code=403, detail="Machine access denied")
    role = frontend_role(user)
    recipient_role = payload.recipient_role.strip().upper()
    recipient_group = payload.recipient_group.strip().upper() if payload.recipient_group else None
    if role == "OPERATOR":
        recipient_role = "SUPERVISOR"
    elif recipient_role not in RECIPIENT_ROLES | {MACHINE_RECIPIENT}:
        raise HTTPException(status_code=422, detail="Invalid support recipient")
    if recipient_role == MACHINE_RECIPIENT:
        if recipient_group not in MACHINE_GROUP_CODES:
            raise HTTPException(status_code=422, detail="Invalid machine group recipient")
    else:
        recipient_group = None
    ticket = None
    if recipient_role == MACHINE_RECIPIENT:
        ticket = db.scalar(
            select(SupportTicket)
            .where(
                SupportTicket.recipient_role == MACHINE_RECIPIENT,
                SupportTicket.recipient_group == recipient_group,
            )
            .order_by(desc(SupportTicket.updated_at), desc(SupportTicket.id))
            .limit(1)
        )
    if ticket is None:
        ticket = SupportTicket(machine_id=payload.machine_id, created_by=user.username, creator_role=role, recipient_role=recipient_role, recipient_group=recipient_group, subject=payload.subject, priority=payload.priority, status="NEW")
        db.add(ticket)
    else:
        ticket.subject = payload.subject
        ticket.priority = payload.priority
        ticket.status = "NEW"
    ticket.messages.append(SupportMessage(sender=user.username, sender_role=role, message=payload.message))
    db.commit()
    db.refresh(ticket)
    return ticket_response(ticket, user, db)


def get_ticket_or_404(ticket_id: int, user: User, db: Session) -> SupportTicket:
    ticket = db.get(SupportTicket, ticket_id)
    if ticket is None or not can_view_ticket(ticket, user):
        raise HTTPException(status_code=404, detail="Support ticket not found")
    return ticket


@router.get("/tickets/{ticket_id}/messages", response_model=list[SupportMessageResponse])
def list_messages(ticket_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> list[SupportMessageResponse]:
    get_ticket_or_404(ticket_id, user, db)
    messages = list(db.scalars(select(SupportMessage).where(SupportMessage.ticket_id == ticket_id).order_by(SupportMessage.sent_at, SupportMessage.id)).all())
    return [SupportMessageResponse.model_validate(item).model_copy(update={"sender_name": display_name(item.sender, db)}) for item in messages]


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
def create_message(ticket_id: int, payload: SupportMessageCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)) -> SupportMessageResponse:
    ticket = get_ticket_or_404(ticket_id, user, db)
    role = frontend_role(user)
    message = SupportMessage(ticket_id=ticket_id, sender=user.username, sender_role=role, message=payload.message)
    ticket.status = "IN_PROGRESS" if role == "OPERATOR" else ticket.status
    db.add(message)
    db.commit()
    db.refresh(message)
    return SupportMessageResponse.model_validate(message).model_copy(update={"sender_name": display_name(message.sender, db)})


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
