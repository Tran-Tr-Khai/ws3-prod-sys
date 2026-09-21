from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class BuffingCheck(TimestampMixin, Base):
    __tablename__ = "buffing_checks"
    __table_args__ = (
        Index("ix_buffing_checks_check_date", "check_date"),
        Index("ix_buffing_checks_machine_date", "machine_id", "check_date"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    check_date: Mapped[date] = mapped_column(Date, nullable=False)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    # Legacy rows may be missing an operator; new rows are required by the API schema.
    operator_name: Mapped[str | None] = mapped_column(String(160))
    check_1: Mapped[bool] = mapped_column(nullable=False, default=False)
    check_2: Mapped[bool] = mapped_column(nullable=False, default=False)
    check_3: Mapped[bool] = mapped_column(nullable=False, default=False)
    check_4: Mapped[bool] = mapped_column(nullable=False, default=False)
    check_5: Mapped[bool] = mapped_column(nullable=False, default=False)
    remark: Mapped[str | None] = mapped_column(String(500))
