"""Integration checks for the active MES Alembic baseline.

Set ``MIGRATION_TEST_ADMIN_URL`` to a disposable PostgreSQL administrative
connection. Tests create and delete their own random database; they never use
the application's configured database.
"""
import os
from pathlib import Path
import unittest
from uuid import uuid4

import sqlalchemy as sa
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory

from app import models  # noqa: F401 - register current ORM metadata
from app.db.base import Base


BACKEND = Path(__file__).resolve().parents[1]
ADMIN_URL = os.environ.get("MIGRATION_TEST_ADMIN_URL")


@unittest.skipUnless(ADMIN_URL, "Set MIGRATION_TEST_ADMIN_URL to a disposable PostgreSQL instance")
class MigrationBaselineTests(unittest.TestCase):
    """Verify a fresh database exactly matches the active application models."""

    def setUp(self) -> None:
        self.admin = sa.create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
        self.database = "ws3_migration_test_" + uuid4().hex
        with self.admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{self.database}"')
        self.url = sa.engine.make_url(ADMIN_URL).set(database=self.database)
        self.engine = sa.create_engine(self.url)
        self.addCleanup(self._cleanup_database)

    def _cleanup_database(self) -> None:
        self.engine.dispose()
        with self.admin.connect() as connection:
            connection.exec_driver_sql(f'DROP DATABASE "{self.database}" WITH (FORCE)')
        self.admin.dispose()

    def _upgrade(self) -> None:
        config = Config(str(BACKEND / "alembic.ini"))
        config.set_section_option("logger_alembic", "level", "WARN")
        with self.engine.connect() as connection:
            config.attributes["connection"] = connection
            command.upgrade(config, "head")

    def test_fresh_install_matches_models_and_is_repeatable(self) -> None:
        """Apply the clean baseline twice without schema drift or data loss."""
        self._upgrade()
        with self.engine.begin() as connection:
            connection.execute(sa.text(
                "INSERT INTO roles (code, name) VALUES ('ADMIN', 'Administrator')"
            ))
        self._upgrade()

        with self.engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
            differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
            role_count = connection.execute(sa.text("SELECT count(*) FROM roles")).scalar_one()

        script = ScriptDirectory.from_config(Config(str(BACKEND / "alembic.ini")))
        self.assertEqual(current, script.get_current_head())
        self.assertEqual(differences, [], repr(differences))
        self.assertEqual(role_count, 1)
