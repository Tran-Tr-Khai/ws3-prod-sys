from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

from app.config.settings import get_settings
from app.db.base import Base
from app import models  # noqa: F401 - register all model metadata

config = context.config
settings = get_settings()

if config.config_file_name is not None:
    fileConfig(config.file_config)

config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    raise RuntimeError(
        "This migration history inspects existing schema and requires an online "
        "database connection. Validate on an isolated PostgreSQL database first."
    )


def migrate_connection(connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        if connection.dialect.name == "postgresql":
            # Serialize migration runners in this database, including first boot.
            # Transaction scope releases the lock on both success and failure.
            connection.execute(text("SELECT pg_advisory_xact_lock(8733, 1)"))
        context.run_migrations()


def run_migrations_online() -> None:
    supplied_connection = config.attributes.get("connection")
    if supplied_connection is not None:
        migrate_connection(supplied_connection)
        return
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        migrate_connection(connection)
    connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
