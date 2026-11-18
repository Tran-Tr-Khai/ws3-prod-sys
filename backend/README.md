# WS3 Backend

See the repository [documentation index](../docs/README.md) for system
architecture, production workflows, local development and deployment. This
file retains the backend-focused quick start.

## Setup with uv

From the repository root:

```powershell
uv sync --project backend --group dev
Copy-Item backend\.env.example backend\.env
docker compose up -d postgres
uv run --project backend alembic -c backend\alembic.ini upgrade head
```

## Run the API

```powershell
cd backend
uv run python run.py
```

Seed initial roles:

```powershell
uv run --directory backend python -m scripts.seed
```

Health check:

```text
GET http://localhost:8000/health
```
