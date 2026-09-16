# WS3 Backend

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

Mock machine simulator:

```text
GET http://localhost:8000/simulator/machines
GET http://localhost:8000/simulator/machines/SC-01
```

The simulator is exposed through the `MachineDataSource` interface, so a PLC,
Modbus TCP, OPC-UA, or MQTT adapter can replace it without changing the API
contract.
