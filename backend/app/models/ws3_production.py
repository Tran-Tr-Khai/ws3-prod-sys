from sqlalchemy import Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class WS3ProductionPlan(TimestampMixin, Base):
    __tablename__ = "ws3_production_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_date: Mapped[str | None] = mapped_column(String(40), index=True)
    sop_no: Mapped[str | None] = mapped_column(String(120), index=True)
    machine_no: Mapped[str | None] = mapped_column(String(120), index=True)
    roll_required: Mapped[str | None] = mapped_column(String(40))
    item_code: Mapped[str | None] = mapped_column(String(160), index=True)
    item_name: Mapped[str | None] = mapped_column(String(500))
    po_no: Mapped[str | None] = mapped_column(String(160))
    source_order_no: Mapped[str | None] = mapped_column(String(160), index=True)
    dyeing_request_sop: Mapped[str | None] = mapped_column(String(160), index=True)
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")

class WS3ProductionOrder(TimestampMixin, Base):
    """One source row from ORDEROFWS3. PK# groups become reported production orders."""
    __tablename__ = "ws3_production_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    production_date: Mapped[str | None] = mapped_column(String(40), index=True)
    pk_no: Mapped[str | None] = mapped_column(String(160), index=True)
    out_no: Mapped[str | None] = mapped_column(String(160), index=True)
    po_no: Mapped[str | None] = mapped_column(String(160), index=True)
    source_order_no: Mapped[str | None] = mapped_column(String(160), index=True)
    item_code: Mapped[str | None] = mapped_column(String(160))
    item_name: Mapped[str | None] = mapped_column(String(500))
    lot_no: Mapped[str | None] = mapped_column(String(120))
    invoice_no: Mapped[str | None] = mapped_column(String(160), index=True)
    quantity: Mapped[str | None] = mapped_column(String(80))
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")


class WS3MachineWS2Record(TimestampMixin, Base):
    __tablename__ = "ws3_machine_ws2_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    out_dyeing_sop: Mapped[str | None] = mapped_column(String(160), index=True)
    weaving_date: Mapped[str | None] = mapped_column(String(40), index=True)
    roll_id: Mapped[str | None] = mapped_column(String(160), index=True)
    machine_no: Mapped[str | None] = mapped_column(String(120), index=True)
    sop_no: Mapped[str | None] = mapped_column(String(120), index=True)
    po_no: Mapped[str | None] = mapped_column(String(160), index=True)
    source_order_no: Mapped[str | None] = mapped_column(String(160), index=True)
    item_code: Mapped[str | None] = mapped_column(String(160))
    item_name: Mapped[str | None] = mapped_column(String(500))
    lot_no: Mapped[str | None] = mapped_column(String(120))
    length_meters: Mapped[float | None] = mapped_column(Numeric(14, 3))
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")


class WS3WorkerRecord(TimestampMixin, Base):
    __tablename__ = "ws3_worker_records"

    id: Mapped[int] = mapped_column(primary_key=True)
    weaving_date: Mapped[str | None] = mapped_column(String(40), index=True)
    shift: Mapped[str | None] = mapped_column(String(80))
    worker: Mapped[str | None] = mapped_column(String(160))
    customer: Mapped[str | None] = mapped_column(String(160))
    po_no: Mapped[str | None] = mapped_column(String(160), index=True)
    source_order_no: Mapped[str | None] = mapped_column(String(160), index=True)
    item_code: Mapped[str | None] = mapped_column(String(160), index=True)
    item_name: Mapped[str | None] = mapped_column(String(500))
    sop_no: Mapped[str | None] = mapped_column(String(120), index=True)
    lot_no: Mapped[str | None] = mapped_column(String(160), index=True)
    machine_no: Mapped[str | None] = mapped_column(String(120), index=True)
    quantity: Mapped[str | None] = mapped_column(String(80))
    length_meters: Mapped[float | None] = mapped_column(Numeric(14, 3))
    raw_data_json: Mapped[str] = mapped_column(Text, default="{}")
