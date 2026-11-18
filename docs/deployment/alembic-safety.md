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

Do not run this branch directly against a database stamped with the old
`2026...` revision history. This repository reset is intended for a new local
or new deployment database.

If an old database contains information worth preserving:

1. Back it up with `pg_dump`.
2. Restore it into an isolated environment if data needs review.
3. Export only business data that belongs to the active features.
4. Create a new database and apply this baseline.
5. Import reviewed data using a separately tested script.

The old migration history and retired schemas are preserved on the Git branch
`archive/pre-baseline-alembic` for reference. Do not use `alembic stamp head`
to make an old database appear compatible with this baseline.

## Development contract

- Migration files are immutable once shared with the team or deployed.
- Add one forward Alembic revision for every PostgreSQL schema change.
- Keep revision DDL explicit; do not import live ORM models from a migration.
- Run the optional integration test with a disposable PostgreSQL administrator
  URL in `MIGRATION_TEST_ADMIN_URL`. The test creates and drops only databases
  named `ws3_migration_test_*`.
- Restore a backup to roll back a deployed schema. The baseline deliberately
  blocks destructive downgrade operations.
