from sqlalchemy import String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class MachineOrderState(TimestampMixin, Base):
    __tablename__ = "machine_order_states"
    __table_args__ = (UniqueConstraint("machine_id", "order_number", name="uq_machine_order_states_machine_order"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    order_number: Mapped[str] = mapped_column(String(160), nullable=False)
    order_progress: Mapped[str] = mapped_column(String(20), nullable=False)
