# Scouring MVP Status

## Completed features

- Read-only Scouring Overview at `/machine/scouring`.
- Operator Record Entry at `/machine/scouring/record`.
- Review state with complete entered values, context, warnings, and blocking errors.
- Confirm flow with loading state, double-submit protection, backend error feedback, and post-success navigation.
- PostgreSQL-backed Scouring record API integration.
- Backend-backed History at `/machine/scouring/history`.
- History table with recorded time, machine, batch, operator, process values, production meters, and status.
- Record detail view with chemicals, process conditions, production quantities, context, and warnings.
- Loading, empty, retry, and backend error states.
- Speed expected range: `40–50 m/min`.
- Temperature expected range: `90–98 °C`.
- Amber is used for data/process warnings; red is reserved for blocking, save, or backend errors.
- Scouring production records are not read from browser localStorage.

## Backend endpoints

- `POST /api/scouring/records`
- `GET /api/scouring/records`
- `GET /api/scouring/records/{id}`
- `GET /api/scouring/records/latest`

Records are stored in the PostgreSQL `scouring_records` table through the existing FastAPI, SQLAlchemy, and Alembic architecture.

## QA results

| Check | Result |
| --- | --- |
| Overview → Enter Record | Passed in browser |
| Valid numeric entry → Review | Passed |
| Missing required field blocks Review | Passed |
| Speed outside expected range | Passed; warning remains visible and does not block confirmation |
| Temperature outside expected range | Passed; warning remains visible and does not block confirmation |
| Optional input/output meters empty | Supported; fields remain nullable |
| Invalid numeric input | Native numeric controls plus validation prevent a valid review payload from being produced |
| Confirm loading / double-click protection | Implemented; `SAVING...` disables confirmation while the request is pending |
| Backend unavailable | Passed; Overview, History, and Confirm show understandable error states |
| No records | Implemented empty state |
| Browser refresh | API-backed screens reload from PostgreSQL; no production record is restored from localStorage |
| HMI-sized viewport | Checked with compact viewport behavior and no document overflow |
| Large viewport | Checked; Scouring frame is constrained instead of stretching indefinitely |
| PostgreSQL POST → GET | Passed after applying the existing Alembic migration; QA record ID 1 was retrieved successfully |
| Simulator separation | Preserved; simulator machine pages were not changed by the Scouring data flow |

## Known limitations

- The PostgreSQL container must be healthy and the existing Alembic migrations must be applied before starting the backend. The QA environment initially had the container running but the `scouring_records` table was not yet migrated; running `alembic upgrade head` resolved this.
- Authentication and operator identity management are not implemented.
- PLC, sensor, realtime telemetry, machine control, and alarm integration are intentionally not implemented.
- The legacy Scouring warning/event log remains a separate manual/local event utility and is not the source of Scouring production records.
- History and Overview currently load the backend record list on page entry; advanced analytics, export, pagination, and complex search are not included.

## Provisional fields needing factory confirmation

- Chemical units currently displayed as `L` are preserved from the existing UI/configuration and still require factory confirmation.
- Fabric Input and Fabric Output meters are provisional nullable fields.
- No waste, shrinkage, loss, efficiency, or yield is calculated from meter values.
- Batch and operator values are currently contextual/manual values; their authoritative source requires future factory workflow confirmation.

## Screenshots and routes to demonstrate

- `/machine/scouring` — latest stored data, status, recent records, and actions.
- `/machine/scouring/record` — entry, review, confirm, loading, and error states.
- `/machine/scouring/history` — backend history table and selected-record detail.

## Remaining future work

- Start PostgreSQL in the development/runtime environment and perform a real POST/GET persistence smoke test.
- Connect authenticated operator identity and authoritative batch context.
- Confirm chemical units and production-field semantics with the factory.
- Replace the legacy local warning/event utility when a server-side validation-event contract is defined.
- Add automated frontend/backend integration tests around the persistence workflow.
