"""SQLAlchemy model registry."""

from app.models.machine import Machine, MachineParameter, ParameterDefinition
from app.models.operations import Alarm, AuditLog, OperatorLog
from app.models.production import Batch, ParameterValue, Process, ProductionRecord
from app.models.scouring import ScouringRecord
from app.models.scouring_inspection import ScouringPhInspection
from app.models.buffing import BuffingCheck, BuffingCheckImage
from app.models.machine_order_state import MachineOrderState
from app.models.user import Role, User, UserSession
from app.models.support import SupportMessage, SupportTicket, SupportTicketRead
from app.models.ws3_order import WS3ImportBatch, WS3ImportRow, WS3Order, WS3OrderRoll
from app.models.ws3_production import WS3MachineWS2Record, WS3ProductionOrder, WS3ProductionPlan, WS3WorkerRecord
from app.models.ws3_unrolling import WS3UnrollingRollEvent

__all__ = [
    "Alarm",
    "AuditLog",
    "Batch",
    "Machine",
    "MachineParameter",
    "OperatorLog",
    "ParameterDefinition",
    "ParameterValue",
    "Process",
    "ProductionRecord",
    "ScouringRecord",
    "ScouringPhInspection",
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
]
