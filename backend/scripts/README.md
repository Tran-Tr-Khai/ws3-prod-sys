# Backend maintenance scripts

The `scripts` package contains small, explicit maintenance commands that are
run by an operator or developer. It is not part of the HTTP API or business
logic layer.

## Current scripts

### `seed.py`

Creates the baseline application roles in the configured database. It is
idempotent and safe to run after a fresh migration.

Run it from the repository root with:

```powershell
uv run --directory backend python -m scripts.seed
```

User creation remains in `app.db.create_user` because it is an application
CLI that owns user/password validation. Add future one-off operational scripts
here only when they do not belong in the API, service, or database modules.
