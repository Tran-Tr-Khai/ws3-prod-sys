# Alembic: repair, verification, and deployment

## Root cause and repair

The former revision 0001 imported current ORM models and called
`Base.metadata.create_all()`. As models evolved, a fresh install created future
tables and columns before their migrations. This caused duplicate objects and
made revision 0024 capable of deleting already-current snapshot data.

Revision 0001 now contains a fixed schema reconstructed from commit 7bed5e8.
Historical compatibility guards handle databases created by the old bootstrap;
they do not depend on application models. Revision IDs and ancestry are unchanged.
Revision 0035 also repairs known model/schema differences for databases already
at 0034 (those databases do not rerun historical migrations).

The repair:

- Preserves final snapshot tables and validates their required structure.
- Refuses to replace populated 0023 interim tables. Their format has no agreed
  lossless business mapping; a separate reviewed conversion is required.
- Handles both versions of the Unrolling unique constraint in 0028.
- Widens the known lot-number columns from 120 to 160 characters, never truncates.
- Aligns indexes with ORM metadata, including the unique MES source-key index.
- Serializes PostgreSQL migration runners with a transaction advisory lock.
  Failed upgrades roll back the migration transaction and release the lock.

This does not repair arbitrary manual schema changes or restore previously
deleted data. Unexpected column/index definitions cause an explicit failure.

## Automated verification

Use a disposable PostgreSQL 16 instance, not a production database. Set
`MIGRATION_TEST_ADMIN_URL` to that instance with a role allowed to create databases:

```bash
export PYTHONPATH=backend
export MIGRATION_TEST_ADMIN_URL='postgresql+psycopg://postgres:migration_test_only@127.0.0.1:55439/migration_audit'
python -m unittest discover -s backend/tests -v
```

Each migration test creates and removes only its own randomly named
`ws3_migration_test_*` database. Without the environment variable, migration
integration tests are skipped. The MES sample-file test additionally requires
its external fixtures; see that test's configuration.

Coverage includes empty installation, each historical revision in sequence,
old model-bootstrap schemas, upgrades from 0022 and 0034, preserved snapshot
rows and operational history, repeat upgrades, recent downgrade/re-upgrade,
concurrent startup, invalid-schema rollback, and destructive-transition guards.
Schema comparison checks tables, columns/types, indexes and foreign keys;
it is not an exhaustive comparison of every server default or check expression.

The GitHub workflow runs the backend suite on Linux/Python 3.12/PostgreSQL 16.
Future model changes must include a migration and pass these tests.

### Verification recorded for this repair

On 2026-10-06 the full suite passed on Windows/Python 3.10 and in the production
Dockerfile's Linux/Python 3.12 image against disposable PostgreSQL 16:
44 passed, 1 skipped (external MES sample files absent), including 17 migration
tests. The production startup sequence reached revision 0035, schema comparison
reported no new operations, and the isolated backend returned HTTP 200 with
`{"status":"ok"}` from `/health`. No Ubuntu server database was changed or verified.

## Ubuntu rollout: ws3-lan-test only

The existing `ws3` stack is separate. Do not stop it, remove its volumes, or
change its database. These commands target only `ws3-lan-test`. Run from
`~/project/ws3-prod-sys` in Bash. Stop if any command fails.

```bash
git status --short
git pull --ff-only
git log -1 --oneline

dc() {
  docker compose -p ws3-lan-test --env-file .env.production \
    -f docker-compose.production.yml -f docker-compose.https.yml "$@"
}

dc ps
dc build backend
dc stop backend

# Backup the exact database belonging to this project, not a different stack.
backup_dir=$(mktemp -d /tmp/ws3-lan-test-backup.XXXXXX)
dc exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$backup_dir/database.dump"
test -s "$backup_dir/database.dump"
dc exec -T postgres pg_restore --list < "$backup_dir/database.dump"
printf 'Backup retained at: %s\n' "$backup_dir/database.dump"

# Run migration separately: a failure stays visible instead of restart-looping.
dc run --rm --no-deps backend alembic current
dc run --rm --no-deps backend alembic upgrade head
dc run --rm --no-deps backend alembic current
dc run --rm --no-deps backend alembic check

dc up -d --no-deps backend
dc ps
dc logs --tail=100 backend
dc exec -T backend python -c "from urllib.request import urlopen; print(urlopen('http://127.0.0.1:8000/health').read().decode())"
```

Expected revision for this repair: `20261006_0035 (head)`, no schema diff,
and backend healthy after its healthcheck interval. Keep the backup outside
ephemeral storage according to company retention policy; a successful archive
listing is not a substitute for a restore rehearsal.

Do not start the test web container on ports 80/443 while production `ws3-web-1`
already owns those ports. This repair requires only the backend image.

Before applying to the production `ws3` database, restore its backup into an
isolated staging database and repeat the upgrade and application checks there.
Local tests do not verify the actual state of the Ubuntu server.

## Failure and rollback rules

- Never use `docker compose down -v`, drop the database, or `alembic stamp head`
  to conceal a migration failure.
- For a populated interim-table error, retain the database and backup. Review
  an explicit data conversion before retrying; do not empty the tables.
- Revision 0024 downgrade is intentionally blocked: dropping final snapshots
  cannot reconstruct the old source format. Use a verified pre-upgrade backup
  in a separate database and the matching application image for such a rollback.
- Revision 0035 downgrade retains its backward-compatible repairs; it does not
  shrink columns or recreate redundant indexes.
- Other historical downgrades can remove columns/tables. Do not downgrade a
  live database simply to roll back application code.
- Capture the full traceback, `alembic current`, `alembic heads`, image ID, and
  Git commit before further diagnosis. Avoid publishing credentials or dumps.

## Maintenance contract

Do not import live ORM models into revision files. Use explicit Alembic DDL,
make data transformations explicit, and add a forward migration for deployed
schemas. The changes to old revisions here are a documented bootstrap repair,
not a general policy of rewriting applied migrations.

`migration_support.py` is a frozen compatibility API for this historical
repair; do not repurpose its behavior for new features. New revisions should
normally use standard Alembic operations. Offline SQL generation is explicitly
unsupported because this history depends on database introspection.
