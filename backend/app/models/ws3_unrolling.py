from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class WS3UnrollingRollEvent(Base):
    """Append-only collection and production handoff events keyed to stable MES identifiers."""

    __tablename__ = "ws3_unrolling_roll_events"
    __table_args__ = (
        Index("ix_ws3_unrolling_event_roll_id", "roll_id"),
        CheckConstraint(
            "event_type IN ('COLLECTED', 'COLLECTION_UNDONE', 'TRANSFERRED_TO_PRODUCTION', 'TRANSFER_UNDONE')",
            name="ck_ws3_unrolling_event_type",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    pk_no: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    roll_id: Mapped[str] = mapped_column(String(160), nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    actor_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    actor_label: Mapped[str] = mapped_column(String(160), nullable=False)
    worker_name: Mapped[str | None] = mapped_column(String(160))
    worker_id: Mapped[str | None] = mapped_column(String(80))
    worker_shift: Mapped[str | None] = mapped_column(String(80))
