from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Process(TimestampMixin, Base):
    __tablename__ = "processes"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False)


class Batch(TimestampMixin, Base):
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_no: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    process_id: Mapped[int | None] = mapped_column(ForeignKey("processes.id"))
    machine_id: Mapped[int | None] = mapped_column(ForeignKey("machines.id"))
    status: Mapped[str] = mapped_column(String(30), default="PLANNED")
    planned_quantity: Mapped[float | None] = mapped_column(Numeric(14, 3))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    process: Mapped[Process | None] = relationship()


class ParameterValue(Base):
    __tablename__ = "parameter_values"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_parameter_id: Mapped[int] = mapped_column(
        ForeignKey("machine_parameters.id", ondelete="CASCADE")
    )
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id", ondelete="SET NULL"))
    value_numeric: Mapped[float | None]
    value_text: Mapped[str | None] = mapped_column(Text)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    source: Mapped[str] = mapped_column(String(30), default="SIMULATOR")
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))


class ProductionRecord(TimestampMixin, Base):
    __tablename__ = "production_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id"))
    process_id: Mapped[int | None] = mapped_column(ForeignKey("processes.id"))
    batch_id: Mapped[int | None] = mapped_column(ForeignKey("batches.id", ondelete="SET NULL"))
    operator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    record_type: Mapped[str] = mapped_column(String(50))
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 3))
    unit: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(String(30), default="RECORDED")
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
