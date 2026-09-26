import json
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class WS3Order(TimestampMixin, Base):
    __tablename__ = "ws3_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_no: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    source_filename: Mapped[str | None] = mapped_column(String(255))
    source_format: Mapped[str] = mapped_column(String(30), default="PASTE")
    source_columns_json: Mapped[str] = mapped_column(Text, default="[]")
    selected_mapping_json: Mapped[str] = mapped_column(Text, default="{}")
    source_rows_json: Mapped[str] = mapped_column(Text, default="[]")
    status: Mapped[str] = mapped_column(String(30), default="DRAFT", index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    rolls: Mapped[list["WS3OrderRoll"]] = relationship(back_populates="order", cascade="all, delete-orphan")

    @property
    def source_columns(self) -> list[str]:
        return json.loads(self.source_columns_json or "[]")

    @property
    def selected_mapping(self) -> dict[str, str]:
        return json.loads(self.selected_mapping_json or "{}")


class WS3ImportBatch(TimestampMixin, Base):
    __tablename__ = "ws3_import_batches"

    id: Mapped[int] = mapped_column(primary_key=True)
    source_filename: Mapped[str | None] = mapped_column(String(255))
    source_format: Mapped[str] = mapped_column(String(30), default="PASTE")
    source_columns_json: Mapped[str] = mapped_column(Text, default="[]")
    selected_mapping_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(30), default="READY", index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

    rows: Mapped[list["WS3ImportRow"]] = relationship(back_populates="batch", cascade="all, delete-orphan")

    @property
    def source_columns(self) -> list[str]:
        return json.loads(self.source_columns_json or "[]")

    @property
    def selected_mapping(self) -> dict[str, str]:
        return json.loads(self.selected_mapping_json or "{}")


class WS3ImportRow(TimestampMixin, Base):
    __tablename__ = "ws3_import_rows"

    id: Mapped[int] = mapped_column(primary_key=True)
    batch_id: Mapped[int] = mapped_column(ForeignKey("ws3_import_batches.id", ondelete="CASCADE"), index=True)
    source_row_index: Mapped[int] = mapped_column(Integer)
    source_key: Mapped[str | None] = mapped_column(String(500), index=True)
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")
    status: Mapped[str] = mapped_column(String(30), default="AVAILABLE", index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("ws3_orders.id", ondelete="SET NULL"), index=True)

    batch: Mapped[WS3ImportBatch] = relationship(back_populates="rows")


class WS3OrderRoll(TimestampMixin, Base):
    __tablename__ = "ws3_order_rolls"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("ws3_orders.id", ondelete="CASCADE"), index=True)
    source_row_index: Mapped[int] = mapped_column(Integer)
    source_key: Mapped[str | None] = mapped_column(String(500), index=True)
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")
    roll_id: Mapped[str | None] = mapped_column(String(160), index=True)
    item_code: Mapped[str | None] = mapped_column(String(160))
    item_name: Mapped[str | None] = mapped_column(String(500))
    lot_no: Mapped[str | None] = mapped_column(String(160))
    machine_no: Mapped[str | None] = mapped_column(String(160))
    length_meters: Mapped[float | None] = mapped_column(Numeric(14, 3))
    shift: Mapped[str | None] = mapped_column(String(80))
    worker: Mapped[str | None] = mapped_column(String(160))
    remarks: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="WAITING", index=True)

    order: Mapped[WS3Order] = relationship(back_populates="rolls")
