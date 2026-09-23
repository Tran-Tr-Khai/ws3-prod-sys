from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

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
    images: Mapped[list["BuffingCheckImage"]] = relationship(back_populates="check", cascade="all, delete-orphan", order_by="BuffingCheckImage.sort_order")


class BuffingCheckImage(Base):
    __tablename__ = "buffing_check_images"
    __table_args__ = (Index("ix_buffing_check_images_check_id", "buffing_check_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    buffing_check_id: Mapped[int] = mapped_column(ForeignKey("buffing_checks.id", ondelete="CASCADE"), nullable=False)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default="now()", nullable=False)
    check: Mapped[BuffingCheck] = relationship(back_populates="images")
