from datetime import date, datetime

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class TenteringOrder(TimestampMixin, Base):
    __tablename__ = "tentering_orders"
    __table_args__ = (UniqueConstraint("machine_id", "sop_no", name="uq_tentering_machine_sop"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[str] = mapped_column(String(20), nullable=False, default="TE-01")
    sop_no: Mapped[str] = mapped_column(String(160), index=True)
    order_progress: Mapped[str] = mapped_column(String(20), nullable=False, default="IN_PROGRESS")
    operator_name: Mapped[str | None] = mapped_column(String(160))
    operator_identifier: Mapped[str | None] = mapped_column(String(80))
    shift: Mapped[str | None] = mapped_column(String(40))
    customer: Mapped[str | None] = mapped_column(String(160))
    item_description: Mapped[str | None] = mapped_column(String(300))
    warp_yarn: Mapped[str | None] = mapped_column(String(160))
    weft_yarn: Mapped[str | None] = mapped_column(String(160))
    greige_density_pick: Mapped[float | None] = mapped_column(Numeric(14, 3))
    finish_density_pick: Mapped[float | None] = mapped_column(Numeric(14, 3))
    shrink_percent: Mapped[float | None] = mapped_column(Numeric(8, 3))
    greige_width_inch: Mapped[float | None] = mapped_column(Numeric(10, 3))
    finish_width_inch: Mapped[float | None] = mapped_column(Numeric(10, 3))
    fabric_received_date: Mapped[date | None] = mapped_column(Date)
    entries: Mapped[list["TenteringRollEntry"]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="TenteringRollEntry.roll_number"
    )


class TenteringRollEntry(TimestampMixin, Base):
    __tablename__ = "tentering_roll_entries"
    __table_args__ = (
        UniqueConstraint("order_id", "roll_number", name="uq_tentering_roll_order_number"),
        CheckConstraint("roll_number BETWEEN 1 AND 9", name="ck_tentering_roll_number_1_9"),
        CheckConstraint("planned_quantity IS NULL OR planned_quantity >= 0", name="ck_tentering_planned_qty_nonnegative"),
        CheckConstraint("actual_quantity IS NULL OR actual_quantity >= 0", name="ck_tentering_actual_qty_nonnegative"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("tentering_orders.id", ondelete="CASCADE"), index=True)
    roll_number: Mapped[int] = mapped_column(SmallInteger)
    roll_id: Mapped[str | None] = mapped_column(String(160))
    tenter_date: Mapped[date | None] = mapped_column(Date)
    weaving_date: Mapped[date | None] = mapped_column(Date)
    planned_quantity: Mapped[float | None] = mapped_column(Numeric(14, 3))
    actual_quantity: Mapped[float | None] = mapped_column(Numeric(14, 3))
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), index=True)
    recorded_by_name: Mapped[str | None] = mapped_column(String(160))
    order: Mapped[TenteringOrder] = relationship(back_populates="entries")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
