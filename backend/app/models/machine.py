from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin


class Machine(TimestampMixin, Base):
    __tablename__ = "machines"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    machine_type: Mapped[str] = mapped_column(String(80))
    location: Mapped[str | None] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(30), default="OFFLINE")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    parameters: Mapped[list["MachineParameter"]] = relationship(back_populates="machine")


class ParameterDefinition(TimestampMixin, Base):
    __tablename__ = "parameter_definitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(80), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    unit: Mapped[str | None] = mapped_column(String(40))
    data_type: Mapped[str] = mapped_column(String(30), default="number")
    category: Mapped[str | None] = mapped_column(String(80))
    min_value: Mapped[float | None]
    max_value: Mapped[float | None]
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    machine_parameters: Mapped[list["MachineParameter"]] = relationship(
        back_populates="definition"
    )


class MachineParameter(TimestampMixin, Base):
    __tablename__ = "machine_parameters"
    __table_args__ = (UniqueConstraint("machine_id", "parameter_definition_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    machine_id: Mapped[int] = mapped_column(ForeignKey("machines.id", ondelete="CASCADE"))
    parameter_definition_id: Mapped[int] = mapped_column(
        ForeignKey("parameter_definitions.id", ondelete="CASCADE")
    )
    default_value: Mapped[float | None]
    min_value: Mapped[float | None]
    max_value: Mapped[float | None]
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    machine: Mapped[Machine] = relationship(back_populates="parameters")
    definition: Mapped[ParameterDefinition] = relationship(back_populates="machine_parameters")
