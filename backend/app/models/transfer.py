from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class TransferRecord(TimestampMixin, Base):
    """One Transfer production entry from the daily operator report."""

    __tablename__ = "transfer_records"
    __table_args__ = (Index("ix_transfer_records_machine_date", "machine_id", "production_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    production_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    order_number: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    operator_name: Mapped[str] = mapped_column(String(160), nullable=False)
    operator_identifier: Mapped[str] = mapped_column(String(80), nullable=False)
    shift: Mapped[str] = mapped_column(String(80), nullable=False)
    order_progress: Mapped[str] = mapped_column(String(20), nullable=False, default="IN_PROGRESS")
    item: Mapped[str] = mapped_column(String(300), nullable=False)
    buyer: Mapped[str] = mapped_column(String(160), nullable=False)
    design: Mapped[str] = mapped_column(String(160), nullable=False)
    temperature: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    speed: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    quantity_meters: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False)
