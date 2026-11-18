# Clear server test data and keep logins

This runbook deletes application data from the WS3 PostgreSQL database while
preserving the login accounts, role assignments, active sessions, and Alembic
revision. It matches the cleanup script used for the server database.

## What is preserved and removed

Preserved tables:

- `users`: login accounts and passwords
- `roles` and `user_roles`: authorization roles and account assignments
- `user_sessions`: existing login sessions
- `alembic_version`: database migration revision

Every other ordinary table in the current PostgreSQL schema is truncated,
including production snapshots, MES orders, machine records, support messages,
checklists, and event history. `RESTART IDENTITY CASCADE` resets their owned
sequences and clears dependent rows.

This is a permanent data deletion. Keep and verify a database backup first.
This operation does not remove uploaded image files from the separate media
volume; those files need a separately scoped cleanup if test uploads exist.

## Target the server database

Run on the Ubuntu server from the project directory. Use the Compose project
that owns the live website; for the current `ws3` project:

```bash
cd ~/project/ws3-prod-sys

dc() {
  docker compose -p ws3 --env-file .env.production \
    -f docker-compose.production.yml -f docker-compose.https.yml "$@"
}

dc ps
```

Confirm the Compose project and its `postgres` service before continuing. Do
not choose a similarly named test project's database by mistake.

## Back up

```bash
backup_file="/tmp/ws3-before-cleanup-$(date +%Y%m%d-%H%M%S).dump"
dc exec -T postgres sh -c \
  'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > "$backup_file"
test -s "$backup_file"
dc exec -T postgres pg_restore --list < "$backup_file"
printf 'Backup: %s\n' "$backup_file"
```

Keep the archive in the approved backup location after verifying the dump.
The file under `/tmp` is only a temporary server-local copy.

## Clear application rows

Open `psql` through the Compose service:

```bash
dc exec postgres sh -c 'exec psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

Confirm the prompt is connected to `ws3`:

```sql
SELECT current_database(), current_schema();
```

Then run:

```sql
DO $$
DECLARE
    tables_to_clear text;
BEGIN
    SELECT string_agg(
        format('%I.%I', schemaname, tablename),
        ', ' ORDER BY tablename
    )
    INTO tables_to_clear
    FROM pg_tables
    WHERE schemaname = current_schema()
      AND tablename NOT IN (
          'users',
          'roles',
          'user_roles',
          'user_sessions',
          'alembic_version'
      );

    IF tables_to_clear IS NOT NULL THEN
        EXECUTE 'TRUNCATE TABLE ' || tables_to_clear || ' RESTART IDENTITY CASCADE';
    END IF;
END $$;
```

The PostgreSQL `DO` command is transactional. If it completes with `DO` and no
error, autocommit has committed the cleanup. A following `COMMIT` may report
`there is no transaction in progress` if no explicit `BEGIN` was issued; that
warning does not undo the successful `DO`. To inspect before committing instead,
issue `BEGIN;` first, run the `DO`, perform the checks below, then enter
`COMMIT;`. Use `ROLLBACK;` if the target or result is wrong.

## Verify

```sql
SELECT version_num FROM alembic_version;

SELECT
  (SELECT count(*) FROM users) AS users,
  (SELECT count(*) FROM roles) AS roles,
  (SELECT count(*) FROM user_roles) AS user_roles,
  (SELECT count(*) FROM user_sessions) AS user_sessions;

SELECT
  (SELECT count(*) FROM buffing_checks) AS buffing,
  (SELECT count(*) FROM tentering_orders) AS tentering,
  (SELECT count(*) FROM ws3_production_orders) AS mes_orders,
  (SELECT count(*) FROM ws3_worker_records) AS workers,
  (SELECT count(*) FROM ws3_unrolling_roll_events) AS unrolling_events;
```

Expected: the Alembic revision is unchanged, login rows remain, and the cleared
application tables report zero. Exit `psql` with `\q`, then refresh the site.
