"""Compatibility operations for the historical metadata-based bootstrap.

Keep this module independent of application models. Existing objects must match
the migration definition; never hide schema drift with a blanket exception.
New migrations should normally use Alembic operations directly.
"""
import sqlalchemy as sa
from alembic import op


def _validate_column(table: str, expected: sa.Column, actual: dict) -> None:
    dialect = op.get_bind().dialect
    expected_type = expected.type.compile(dialect=dialect)
    actual_type = actual["type"].compile(dialect=dialect)
    if expected_type != actual_type or expected.nullable != actual["nullable"]:
        raise RuntimeError(
            f"Schema mismatch: {table}.{expected.name}: expected "
            f"{expected_type} nullable={expected.nullable}, found "
            f"{actual_type} nullable={actual['nullable']}. "
            "Inspect the database before migrating; no data was discarded."
        )


def create_table_if_missing(name: str, *elements) -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table(name):
        op.create_table(name, *elements)
        return
    columns = {column["name"]: column for column in inspector.get_columns(name)}
    for element in elements:
        if not isinstance(element, sa.Column):
            continue
        if element.name not in columns:
            raise RuntimeError(f"Schema mismatch: existing {name} lacks {element.name}.")
        _validate_column(name, element, columns[element.name])
    definition = sa.Table(name, sa.MetaData(), *elements)
    expected_pk = [column.name for column in definition.primary_key.columns]
    if inspector.get_pk_constraint(name)["constrained_columns"] != expected_pk:
        raise RuntimeError(f"Schema mismatch: {name} has an unexpected primary key.")
    unique_columns = {
        tuple(item["column_names"]) for item in inspector.get_unique_constraints(name)
    }
    foreign_keys = {
        (tuple(item["constrained_columns"]), item["referred_table"],
         tuple(item["referred_columns"]), item["options"].get("ondelete"))
        for item in inspector.get_foreign_keys(name)
    }
    for constraint in definition.constraints:
        if isinstance(constraint, sa.UniqueConstraint):
            if tuple(column.name for column in constraint.columns) not in unique_columns:
                raise RuntimeError(f"Schema mismatch: {name} lacks unique constraint {constraint.name}.")
        if isinstance(constraint, sa.ForeignKeyConstraint):
            targets = [element.target_fullname.split(".") for element in constraint.elements]
            expected = (
                tuple(column.name for column in constraint.columns),
                targets[0][-2], tuple(target[-1] for target in targets), constraint.ondelete,
            )
            if expected not in foreign_keys:
                raise RuntimeError(f"Schema mismatch: {name} lacks the expected foreign key {expected}.")


def add_column_if_missing(table: str, column: sa.Column) -> None:
    columns = {item["name"]: item for item in sa.inspect(op.get_bind()).get_columns(table)}
    if column.name not in columns:
        op.add_column(table, column)
    else:
        _validate_column(table, column, columns[column.name])


def create_index_if_missing(name: str, table: str, columns: list[str], **kwargs) -> None:
    indexes = {item["name"]: item for item in sa.inspect(op.get_bind()).get_indexes(table)}
    if name not in indexes:
        op.create_index(name, table, columns, **kwargs)
    elif (
        indexes[name]["column_names"] != columns
        or bool(indexes[name]["unique"]) != bool(kwargs.get("unique", False))
    ):
        raise RuntimeError(f"Schema mismatch: index {name} has an unexpected definition.")
    elif "postgresql_where" in kwargs:
        def normalize(expression) -> str:
            return "".join(str(expression).lower().split()).replace("(", "").replace(")", "")

        actual = indexes[name].get("dialect_options", {}).get("postgresql_where", "")
        if normalize(actual) != normalize(kwargs["postgresql_where"]):
            raise RuntimeError(f"Schema mismatch: index {name} has an unexpected predicate.")


def has_snapshot_schema() -> bool:
    """Recognize 0024+ tables created ahead of time by the old revision 0001."""
    inspector = sa.inspect(op.get_bind())
    markers = []
    for table, marker in (
        ("ws3_production_plans", "plan_date"),
        ("ws3_production_orders", "pk_no"),
    ):
        columns = (
            {item["name"] for item in inspector.get_columns(table)}
            if inspector.has_table(table) else set()
        )
        markers.append(marker in columns and "session_id" not in columns)
    if any(markers) and not all(markers):
        raise RuntimeError("Mixed interim/snapshot WS3 schema; inspect before migrating.")
    return all(markers)


def widen_legacy_lot_columns() -> None:
    """Repair the known 120/160 model/bootstrap drift without truncating values."""
    inspector = sa.inspect(op.get_bind())
    for table in ("ws3_production_orders", "ws3_machine_ws2_records"):
        if not inspector.has_table(table):
            continue
        column = next((item for item in inspector.get_columns(table) if item["name"] == "lot_no"), None)
        if column is None or not isinstance(column["type"], sa.String) or column["type"].length not in (120, 160):
            raise RuntimeError(f"Schema mismatch: expected {table}.lot_no to be VARCHAR(120) or VARCHAR(160).")
        if isinstance(column["type"], sa.String) and column["type"].length == 120:
            op.alter_column(
                table, "lot_no", existing_type=sa.String(120),
                type_=sa.String(160), existing_nullable=True,
            )
