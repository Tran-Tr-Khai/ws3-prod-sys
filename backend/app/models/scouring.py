from datetime import datetime

from sqlalchemy import DateTime, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ScouringRecord(TimestampMixin, Base):
    """Server-side snapshot of one operator-entered Scouring record."""

    __tablename__ = "scouring_records"
    __table_args__ = (
        Index("ix_scouring_records_recorded_at", "recorded_at"),
        Index("ix_scouring_records_machine_id_recorded_at", "machine_id", "recorded_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[str] = mapped_column(String(50), index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    batch_identifier: Mapped[str | None] = mapped_column(String(80))
    operator_name: Mapped[str | None] = mapped_column(String(160))
    operator_identifier: Mapped[str | None] = mapped_column(String(80))

    naoh: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    soap: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    desizer: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    h2o2: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    chelate: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    speed: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    temperature: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
    cylinder_temperature: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)

    input_fabric_meters: Mapped[float | None] = mapped_column(Numeric(14, 3))
    output_fabric_meters: Mapped[float | None] = mapped_column(Numeric(14, 3))
