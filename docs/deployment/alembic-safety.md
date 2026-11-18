# Alembic baseline and schema changes

The repository begins at revision `20261118_0001`, a clean baseline for the
active WS3 MES features: authentication, support, MES snapshots/orders,
Unrolling, Buffing and Tentering. It does not include retired machine schemas.

## Fresh installation

Run the following against an empty PostgreSQL database:

```bash
alembic upgrade head
alembic current
alembic check
```

The application container performs `alembic upgrade head` before starting the
API. Seed roles and create users only after the baseline has completed.

## Existing pre-baseline databases

Do not run `alembic upgrade head` directly against a database stamped with the
retired `2026...` revision history: those revision files are intentionally no
longer in this repository, so Alembic cannot construct its revision graph.

For a database with information worth preserving, choose exactly one path:

1. **Adopt the baseline once** only after a verified backup and a schema
   comparison prove that every active baseline table already exists. Record the
   old revision and update the single `alembic_version` row to
   `20261118_0001` in a reviewed maintenance procedure. This metadata change
   does not create, alter, or delete application tables.
2. **Migrate into a fresh database** when the old schema does not match the
   active baseline. Export only business data belonging to active features,
   apply the baseline to the new database, then import through a separately
   tested script.

Never use `alembic stamp head` as a shortcut. It still needs the old revision
graph and can make an incompatible database appear healthy. Keep the backup,
the previous revision, schema comparison, and approval with the release record.

## Development contract

- Migration files are immutable once shared with the team or deployed.
- Add one forward Alembic revision for every PostgreSQL schema change.
- Keep revision DDL explicit; do not import live ORM models from a migration.
- Run the optional integration test with a disposable PostgreSQL administrator
  URL in `MIGRATION_TEST_ADMIN_URL`. The test creates and drops only databases
  named `ws3_migration_test_*`.
- Restore a backup to roll back a deployed schema. The baseline deliberately
  blocks destructive downgrade operations.
