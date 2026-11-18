"""SQLAlchemy model registry."""

from app.models.buffing import BuffingCheck, BuffingCheckImage
from app.models.machine_order_state import MachineOrderState
from app.models.user import Role, User, UserSession
from app.models.support import SupportMessage, SupportTicket, SupportTicketRead
from app.models.ws3_order import WS3ImportBatch, WS3ImportRow, WS3Order, WS3OrderRoll
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3ProductionPlan, WS3WorkerRecord
from app.models.ws3_unrolling import WS3UnrollingRollEvent
from app.models.tentering import TenteringOrder, TenteringRollEntry

__all__ = [
    "BuffingCheck",
    "BuffingCheckImage",
    "MachineOrderState",
    "Role",
    "User",
    "UserSession",
    "SupportMessage",
    "SupportTicket",
    "SupportTicketRead",
    "WS3Order",
    "WS3OrderRoll",
    "WS3ImportBatch",
    "WS3ImportRow",
    "WS3ProductionPlan",
    "WS3ProductionOrder",
    "WS3MachineWS2Record",
    "WS3WorkerRecord",
    "WS3UnrollingRollEvent",
    "TenteringOrder",
    "TenteringRollEntry",
]
