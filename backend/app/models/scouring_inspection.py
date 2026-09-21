from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class ScouringPhInspection(TimestampMixin, Base):
    """Manual pH inspection linked to one Scouring operation record."""

    __tablename__ = "scouring_ph_inspections"
    __table_args__ = (
        Index("ix_scouring_ph_inspections_record_id_inspected_at", "scouring_record_id", "inspected_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    scouring_record_id: Mapped[int] = mapped_column(ForeignKey("scouring_records.id", ondelete="CASCADE"), nullable=False, index=True)
    inspected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    operator_name: Mapped[str | None] = mapped_column(String(160))
    tank_0_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_1_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_2_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_3_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_4_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_5_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_6_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    tank_7_ph: Mapped[float | None] = mapped_column(Numeric(14, 3))
    note: Mapped[str | None] = mapped_column(String(500))
