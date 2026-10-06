"""Real PostgreSQL migration regression tests; never use the application DB.

Set MIGRATION_TEST_ADMIN_URL to a disposable PostgreSQL instance. Each test
creates a randomly named ws3_migration_test_* database and drops only that DB.
Without explicit opt-in these integration tests are skipped.
"""
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import sys
import unittest
from uuid import uuid4

import sqlalchemy as sa
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy.orm import Session

from app.db.base import Base
from app import models  # noqa: F401
from app.models.ws3_production import WS3ProductionOrder, WS3ProductionPlan, WS3MachineWS2Record, WS3WorkerRecord
from app.models.ws3_unrolling import WS3UnrollingRollEvent

BACKEND = Path(__file__).resolve().parents[1]
ADMIN_URL = os.environ.get("MIGRATION_TEST_ADMIN_URL")


@unittest.skipUnless(ADMIN_URL, "Set MIGRATION_TEST_ADMIN_URL to a disposable PostgreSQL instance")
class MigrationTests(unittest.TestCase):
    def setUp(self):
        self.admin = sa.create_engine(ADMIN_URL, isolation_level="AUTOCOMMIT")
        self.database = "ws3_migration_test_" + uuid4().hex
        with self.admin.connect() as connection:
            connection.exec_driver_sql(f'CREATE DATABASE "{self.database}"')
        self.url = sa.engine.make_url(ADMIN_URL).set(database=self.database)
        self.engine = sa.create_engine(self.url)
        self.addCleanup(self.cleanup_database)

    def cleanup_database(self):
        self.engine.dispose()
        # The name is generated internally, never supplied by the caller.
        with self.admin.connect() as connection:
            connection.exec_driver_sql(f'DROP DATABASE "{self.database}" WITH (FORCE)')
        self.admin.dispose()

    def migrate(self, revision="head", operation=command.upgrade):
        config = Config(str(BACKEND / "alembic.ini"))
        config.set_section_option("logger_alembic", "level", "WARN")
        with self.engine.connect() as connection:
            config.attributes["connection"] = connection
            operation(config, revision)

    def execute(self, sql):
        with self.engine.begin() as connection:
            return connection.execute(sa.text(sql))

    def assert_head(self):
        with self.engine.connect() as connection:
            current = MigrationContext.configure(connection).get_current_revision()
            head = ScriptDirectory.from_config(Config(str(BACKEND / "alembic.ini"))).get_current_head()
            self.assertEqual(current, head)
            differences = compare_metadata(MigrationContext.configure(connection), Base.metadata)
            self.assertEqual(differences, [], repr(differences))

    def seed_snapshots(self):
        with Session(self.engine) as session:
            session.add_all([
                WS3ProductionOrder(pk_no="KEEP-ORDER", lot_no="KEEP-LOT"),
                WS3ProductionPlan(sop_no="KEEP-PLAN"),
                WS3MachineWS2Record(roll_id="KEEP-ROLL"),
                WS3WorkerRecord(worker="KEEP-WORKER"),
                WS3UnrollingRollEvent(
                    pk_no="KEEP-ORDER", roll_id="KEEP-ROLL",
                    event_type="COLLECTION_UNDONE", actor_label="KEEP-ACTOR",
                ),
            ])
            session.commit()
        self.snapshot_rows = {
            table: self.execute(f"SELECT * FROM {table} ORDER BY id").mappings().all()
            for table in (
                "ws3_production_orders", "ws3_production_plans",
                "ws3_machine_ws2_records", "ws3_worker_records",
                "ws3_unrolling_roll_events",
            )
        }

    def assert_snapshots_retained(self):
        for table, rows in self.snapshot_rows.items():
            self.assertEqual(self.execute(f"SELECT * FROM {table} ORDER BY id").mappings().all(), rows)
        for table, column, value in (
            ("ws3_production_orders", "pk_no", "KEEP-ORDER"),
            ("ws3_production_plans", "sop_no", "KEEP-PLAN"),
            ("ws3_machine_ws2_records", "roll_id", "KEEP-ROLL"),
            ("ws3_worker_records", "worker", "KEEP-WORKER"),
            ("ws3_unrolling_roll_events", "actor_label", "KEEP-ACTOR"),
        ):
            self.assertEqual(self.execute(f"SELECT {column} FROM {table}").scalar_one(), value)

    def bootstrap_old_models(self):
        Base.metadata.create_all(self.engine)
        # Reproduce schema differences in the former model-based initial revision.
        for table in ("ws3_production_orders", "ws3_machine_ws2_records"):
            self.execute(f"ALTER TABLE {table} ALTER COLUMN lot_no TYPE VARCHAR(120)")
        for index in (
            "ix_ws3_production_plans_po_no", "ix_ws3_production_orders_item_code",
            "ix_ws3_production_orders_lot_no", "ix_ws3_machine_ws2_records_item_code",
            "ix_ws3_unrolling_event_roll_id", "uq_ws3_order_rolls_source_key",
        ):
            self.execute(f"DROP INDEX {index}")
        self.execute("CREATE INDEX ix_ws3_order_rolls_source_key ON ws3_order_rolls (source_key)")
        self.seed_snapshots()

    def test_fresh_install_and_repeat_upgrade(self):
        self.migrate()
        self.assert_head()
        self.seed_snapshots()
        self.migrate()
        self.assert_head()
        self.assert_snapshots_retained()

    def test_initial_revision_does_not_create_future_tables(self):
        self.migrate("20260916_0001")
        inspector = sa.inspect(self.engine)
        self.assertFalse(inspector.has_table("ws3_production_orders"))
        self.assertFalse(inspector.has_table("buffing_checks"))
        self.assertNotIn("machine_ids", {c["name"] for c in inspector.get_columns("users")})
        self.execute(
            "INSERT INTO users (username, full_name, password_hash, is_active) "
            "VALUES ('keep-user', 'KEEP-USER', 'not-a-real-password', true)"
        )
        self.migrate()
        self.assert_head()
        self.assertEqual(self.execute("SELECT full_name FROM users").scalar_one(), "KEEP-USER")
        self.assertEqual(self.execute("SELECT machine_ids FROM users").scalar_one(), [])

    def test_every_historical_revision_then_head(self):
        script = ScriptDirectory.from_config(Config(str(BACKEND / "alembic.ini")))
        for revision in reversed(list(script.walk_revisions())):
            with self.subTest(revision=revision.revision):
                self.migrate(revision.revision)
        self.assert_head()

    def test_old_unversioned_model_bootstrap_preserves_data(self):
        self.bootstrap_old_models()
        self.migrate()
        self.assert_head()
        self.assert_snapshots_retained()

    def test_old_bootstrap_stamped_0022_preserves_data(self):
        self.bootstrap_old_models()
        self.migrate("20261001_0022", command.stamp)
        self.migrate()
        self.assert_head()
        self.assert_snapshots_retained()

    def test_existing_head_receives_forward_repair(self):
        self.bootstrap_old_models()
        self.migrate("20261005_0034", command.stamp)
        self.migrate()
        self.assert_head()
        self.assert_snapshots_retained()

    def test_populated_interim_schema_stops_without_deletion(self):
        self.migrate("20261001_0023")
        self.execute(
            "INSERT INTO ws3_import_sessions (plan_filename, order_filename, machine_filename) "
            "VALUES ('KEEP', 'KEEP', 'KEEP')"
        )
        self.execute(
            "INSERT INTO ws3_production_plans (session_id, sop_no) VALUES (1, 'KEEP-INTERIM')"
        )
        with self.assertRaisesRegex(RuntimeError, "populated interim table"):
            self.migrate()
        self.assertEqual(self.execute("SELECT sop_no FROM ws3_production_plans").scalar_one(), "KEEP-INTERIM")
        self.assertEqual(self.execute("SELECT version_num FROM alembic_version").scalar_one(), "20261001_0023")

    def test_mixed_snapshot_schema_fails_safely(self):
        self.migrate("20261001_0022")
        self.execute("CREATE TABLE ws3_production_plans (id SERIAL PRIMARY KEY, plan_date VARCHAR(40))")
        with self.assertRaisesRegex(RuntimeError, "Mixed interim/snapshot"):
            self.migrate()
        self.assertEqual(self.execute("SELECT version_num FROM alembic_version").scalar_one(), "20261001_0022")

    def test_0022_upgrade_preserves_buffing_and_scouring_history(self):
        self.migrate("20261001_0022")
        self.execute(
            "INSERT INTO buffing_checks (machine_id, check_date, checked_at, operator_name, check_1) "
            "VALUES ('BU-01', CURRENT_DATE, now(), 'KEEP-BUFFING', true)"
        )
        self.execute(
            "INSERT INTO scouring_records (machine_id, recorded_at, operator_name, naoh, soap, "
            "desizer, h2o2, chelate, speed, temperature, cylinder_temperature) "
            "VALUES ('SC-01', now(), 'KEEP-SCOURING', 1, 2, 3, 4, 5, 6, 7, 8)"
        )
        original = {
            table: dict(self.execute(f"SELECT * FROM {table}").mappings().one())
            for table in ("buffing_checks", "scouring_records")
        }
        self.migrate()
        self.assert_head()
        for table, row in original.items():
            upgraded = dict(self.execute(f"SELECT * FROM {table}").mappings().one())
            self.assertEqual({key: upgraded[key] for key in row}, row)
        self.assertIsNone(self.execute("SELECT order_progress FROM buffing_checks").scalar_one())

    def test_existing_table_missing_foreign_key_fails_safely(self):
        self.bootstrap_old_models()
        self.migrate("20261002_0026", command.stamp)
        self.execute(
            "ALTER TABLE ws3_unrolling_roll_events "
            "DROP CONSTRAINT ws3_unrolling_roll_events_actor_user_id_fkey"
        )
        with self.assertRaisesRegex(RuntimeError, "expected foreign key"):
            self.migrate()
        self.assert_snapshots_retained()

    def test_wrong_unique_index_predicate_is_rejected(self):
        self.bootstrap_old_models()
        self.migrate("20261005_0034", command.stamp)
        self.execute(
            "CREATE UNIQUE INDEX uq_ws3_order_rolls_source_key ON ws3_order_rolls "
            "(source_key) WHERE source_key IS NULL"
        )
        with self.assertRaisesRegex(RuntimeError, "unexpected predicate"):
            self.migrate()
        self.assert_snapshots_retained()

    def test_unrolling_downgrade_preserves_reversal_history(self):
        self.migrate("20261003_0028")
        self.execute(
            "INSERT INTO ws3_unrolling_roll_events (pk_no, roll_id, event_type, actor_label) "
            "VALUES ('P', 'R', 'COLLECTION_UNDONE', 'KEEP')"
        )
        with self.assertRaisesRegex(RuntimeError, "reversal history"):
            self.migrate("20261003_0027", command.downgrade)
        self.assertEqual(self.execute("SELECT actor_label FROM ws3_unrolling_roll_events").scalar_one(), "KEEP")

    def test_legacy_unrolling_unique_constraint_is_removed(self):
        self.migrate("20261003_0027")
        self.execute(
            "ALTER TABLE ws3_unrolling_roll_events ADD CONSTRAINT uq_ws3_unrolling_roll_event "
            "UNIQUE (pk_no, roll_id, event_type)"
        )
        self.migrate()
        self.assert_head()
        for _ in range(2):
            self.execute(
                "INSERT INTO ws3_unrolling_roll_events (pk_no, roll_id, event_type, actor_label) "
                "VALUES ('P', 'R', 'COLLECTED', 'worker')"
            )

    def test_recent_downgrade_reupgrade_preserves_checklist(self):
        self.migrate()
        self.execute(
            "INSERT INTO buffing_checks (machine_id, check_date, checked_at, operator_name) "
            "VALUES ('BU-01', CURRENT_DATE, now(), 'KEEP-WORKER')"
        )
        self.migrate("20261003_0030", command.downgrade)
        self.migrate()
        self.assert_head()
        self.assertEqual(self.execute("SELECT operator_name FROM buffing_checks").scalar_one(), "KEEP-WORKER")

    def test_snapshot_downgrade_is_explicitly_blocked(self):
        self.migrate("20261001_0024")
        self.execute("INSERT INTO ws3_production_orders (pk_no) VALUES ('KEEP')")
        with self.assertRaisesRegex(RuntimeError, "irreversible"):
            self.migrate("20261001_0023", command.downgrade)
        self.assertEqual(self.execute("SELECT pk_no FROM ws3_production_orders").scalar_one(), "KEEP")

    def test_incompatible_existing_column_fails_without_stamp(self):
        self.migrate("20261003_0029")
        self.execute("ALTER TABLE buffing_checks ADD COLUMN order_number INTEGER")
        with self.assertRaisesRegex(RuntimeError, "Schema mismatch"):
            self.migrate()
        self.assertEqual(self.execute("SELECT version_num FROM alembic_version").scalar_one(), "20261003_0029")
        # The earlier additions in the failed transaction were rolled back too.
        self.assertNotIn("shift", {c["name"] for c in sa.inspect(self.engine).get_columns("buffing_checks")})

    def test_concurrent_startup_serializes_migrations(self):
        env = {**os.environ, "DATABASE_URL": self.url.render_as_string(hide_password=False)}
        args = [sys.executable, "-m", "alembic", "-c", str(BACKEND / "alembic.ini"), "upgrade", "head"]
        def run_upgrade():
            return subprocess.run(
                args, env=env, capture_output=True, text=True, timeout=60,
            )
        # Drain both subprocess outputs concurrently; a full pipe must not
        # stall the process holding the migration advisory lock.
        with ThreadPoolExecutor(max_workers=2) as pool:
            results = list(pool.map(lambda _: run_upgrade(), range(2)))
        for result in results:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assert_head()
