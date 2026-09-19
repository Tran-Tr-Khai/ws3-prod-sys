# CURRENT WS3 SYSTEM AUDIT

Audit basis: repository contents inspected on 2026-09-18. This report describes only behavior and structures present in the current code. It does not treat model definitions, labels, or intended future behavior as implemented functionality.

## 1. PROJECT STRUCTURE

| Area | Path | Purpose |
|---|---|---|
| Frontend app | `frontend/src/app`, `frontend/src/main.tsx` | React entry point, router, and route composition. |
| Frontend HMI components | `frontend/src/components/hmi` | Reusable headers, buttons, status lamps, parameters, panels, and charts. |
| Machine feature | `frontend/src/features/machines` | Machine list, generic machine HMI, Scouring HMI, Scouring history/alarm views, browser storage helpers. |
| Production feature | `frontend/src/features/production` | Production overview derived from machine simulator snapshots. |
| Frontend styling | `frontend/src/styles`, `frontend/tailwind.config.js` | Tailwind configuration and global HMI scale/layout CSS. |
| Backend API | `backend/app/api` | FastAPI router with health and simulator endpoints only. |
| Backend simulator | `backend/app/simulator` | Deterministic in-memory machine data source with time-varying values. |
| Backend schemas | `backend/app/schemas` | Pydantic response schemas for health and simulator snapshots. |
| Backend database layer | `backend/app/db`, `backend/app/models`, `backend/alembic` | SQLAlchemy engine/session, model registry, seed roles, and initial schema migration. |
| Runtime/config | `backend/app/config`, `docker-compose.yml` | CORS, environment settings, and PostgreSQL container definition. |

`node_modules`, generated output, caches, and lock/runtime support files are excluded from the functional structure summary.

## 2. CURRENT APPLICATION ROUTES / SCREENS

Routes are defined in `frontend/src/app/App.tsx`.

| Route | Screen/Page | Purpose | Main Components | Current Status |
|---|---|---|---|---|
| `/` | Redirect | Redirects to `/setup`. | `Navigate` | implemented redirect |
| `/setup` | `DesignSystemDemo` | Component/HMI design preview. | HMI header, panels, demo values, buttons, F-key bar | mock/static demo only |
| `/machines` | `MachineListPage` | Filterable machine table, polling `/simulator/machines`, opens generic machine HMI. | `HMIHeader`, `StatusLamp`, `FunctionKeyBar` | partial; backend simulator connected if URL matches |
| `/dashboard` | `ProductionOverviewPage` | Summary cards and compact machine overview from simulator data. | `HMIHeader`, `StatusLamp`, `FunctionKeyBar` | partial; simulator-backed, not production records |
| `/machine/scouring` | `ScouringHMIPage` | Manual Scouring parameter entry, validation, local record/event logging. | `ParameterSetpoint`, `HMIButton`, `StatusLamp`, custom trend | partial; browser-local only |
| `/machine/scouring/history` | `ScouringHistoryPage` | Filters and displays browser-saved Scouring records. | tables, filters, `FunctionKeyBar` | implemented locally; no backend persistence |
| `/machine/scouring/alarm` | `ScouringAlarmPage` | Filters and displays browser-saved Scouring events/alarms. | active alarm list, tables, filters | implemented locally; no backend persistence |
| `/machine/:machineId` | `MachineHMIPage` | Generic live machine snapshot page with temperature polling trend. | `ProcessPanel`, `ValueDisplay`, `TrendChart` | partial; read-only simulator view |
| `*` | Redirect | Unknown routes redirect to `/setup`. | `Navigate` | implemented redirect |

`PlaceholderPage` exists but is not imported by the router and is therefore unused/dead page code.

## 3. CURRENT NAVIGATION MODEL

| Navigation Item | Destination | Implementation | Notes |
|---|---|---|---|
| Root URL | `/setup` | React redirect | Application start lands on design-system preview, not Scouring. |
| Machine table row | `/machine/{machineId}` | `navigate()` in `MachineListPage` | SC-01 opens generic `MachineHMIPage`, not `/machine/scouring`. |
| Production machine tile | `/machine/{machineId}` | `navigate()` in `ProductionOverviewPage` | Same generic-page behavior. |
| Scouring F4 History | `/machine/scouring/history` | `navigate()` | Functional route change. |
| Scouring F5 Alarm | `/machine/scouring/alarm` | `navigate()` | Functional route change. |
| History/Alarm F-key bars | No destination for most keys | Items have no `onClick` | Labels are present but inert. |
| Machine-list F1/F2/F4 | No destination/action | No handlers | Visual labels only. |
| Dashboard F1/F2/F4 | No destination/action | No handlers | Visual labels only. |
| Setup F1-F4 | No destination/action | No handlers | Preview-only controls. |
| STOP/START on Scouring | Same screen; toggles local state | React `useState` | Logs a local event; does not control a machine. |
| Machine selection filters | Same `/machines` screen | Local component state | Filters currently loaded simulator snapshots. |
| Keyboard/F-key physical shortcuts | None found | No key listeners or hotkey library | F-key labels do not implement keyboard navigation. |
| Sidebar/top-level app navigation | None | No sidebar or global menu component found | Navigation is route/direct-link driven. |

Actual flow from normal application start: `/` -> `/setup`. There is no implemented setup control that reaches Scouring. Scouring is reachable by directly entering `/machine/scouring`, and its History/Alarm pages are reachable from the Scouring F4/F5 buttons. `/machines` and `/dashboard` are also direct URLs; their machine rows lead to the generic machine page.

## 4. SCOURING SCREEN — COMPLETE UI INVENTORY

Primary source: `frontend/src/features/machines/ScouringHMIPage.tsx`; shared rendering is in `frontend/src/components/hmi`.

| Section | UI Element | Displayed Data | Editable? | Data Source | User Action | Notes |
|---|---|---|---|---|---|---|
| Header | Title | `WS3 / Scouring HMI` | No | hardcoded | None | Machine HMI variant. |
| Header | Process/batch/operator subtitle | `Scouring / 정련기`, `SC-260917-01`, `N. Tran` | No | hardcoded | None | Not linked to backend batch/operator. |
| Header | Machine code | `SC-01` | No | hardcoded | None | Status indicator hidden via `showStatus={false}`. |
| Header | Clock | Current local time | No | derived browser time | None | Re-render timing is not explicitly scheduled. |
| Machine status | Primary state | `RUNNING` or `STOPPED` | No | frontend state `running`, initially `true` | STOP/START toggles state | No external machine state. |
| Machine status | Machine/process label | `SC-01 · Scouring line` | No | hardcoded | None | Static label. |
| Machine status | STOP/START button | STOP while running, START while stopped | No | frontend state | Toggles local state and logs event | Does not call backend/PLC. |
| Batch | Batch | `SC-260917-01` | No | hardcoded | None | No batch selector. |
| Batch | Recipe | `Cotton / Standard` | No | hardcoded | None | No recipe model in Scouring UI. |
| Batch | Operator | `N. Tran` | No | hardcoded | None | No login/operator selection. |
| Alarm/status | Alarms count | Number of out-of-range parameters | No | derived from local parameter state | None | Labeled as WS3 validation/manual readings. |
| Alarm/status | Warning count | Number at exact min/max | No | derived from local parameter state | None | Only Speed and Temperature have limits. |
| Alarm/status | Alarm count | Number below min/above max | No | derived from local parameter state | None | Application validation, not machine alarm. |
| Alarm/status | Acknowledge button | `ACKNOWLEDGE ALARM` / `ACKNOWLEDGED` | No | local state and localStorage events | Acknowledges active local alarm events | Writes browser storage only. |
| Alarm/status | Confirm button | `CONFIRM RECORD` / `RECORD SAVED` | No | local state | Saves current snapshot when allowed | Writes browser storage only. |
| Parameters | NaOH quantity | Actual 50 L; set 50 L | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | Soap quantity | Actual 18 L; set 20 L | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | Desizer quantity | Actual 12 L; set 12 L | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | H2O2 quantity | Actual 8 L; set 8 L | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | Chelate quantity | Actual 5 L; set 5 L | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | Speed | Actual 45 m/min; set 45; range 40–50 | Yes | hardcoded initial value + frontend state | Number input edits actual | Below/above range = alarm; exact boundary = warning. |
| Parameters | Temperature | Actual 94 °C; set 95; range 90–98 | Yes | hardcoded initial value + frontend state | Number input edits actual | Initial value is inside range; initial `status: warning` is overwritten by validation. |
| Parameters | Cylinder temperature | Actual 115 °C; set 120 °C | Yes | hardcoded initial value + frontend state | Number input edits actual | No min/max rule. |
| Parameters | Manual input marker | `MANUAL INPUT` | No | hardcoded label | None | Explicitly indicates frontend manual readings. |
| Trends | Speed trend | Current value plus up to five saved Speed readings | No | localStorage records + current local state | None | Custom inline SVG; not real-time. |
| Trends | Temperature trend | Current value plus up to five saved Temperature readings | No | localStorage records + current local state | None | Custom inline SVG; not real-time. |
| Trends | Trend state label | `HISTORY` or `NO SAVED HISTORY` | No | derived from local record count | None | History means browser-local confirmed records. |
| Bottom navigation | F1 Overview | Label only | No | hardcoded | None | No handler. |
| Bottom navigation | F2 Parameters | Active label | No | hardcoded | None | No handler. |
| Bottom navigation | F3 Batch | Label only | No | hardcoded | None | No handler. |
| Bottom navigation | F4 History | Label | No | hardcoded | Navigates to history | Functional. |
| Bottom navigation | F5 Alarm | Label | No | hardcoded | Navigates to alarm log | Functional. |
| Bottom navigation | F6 Menu | Label only | No | hardcoded | None | No handler. |

## 5. CURRENT SCOURING DATA MODEL

| Business Field | Frontend Field | API Field | Backend Field | DB Column | Unit | Required? |
|---|---|---|---|---|---|---|
| Machine | `machine` / hardcoded `SC-01` | None for Scouring record | `Machine.code` exists in schema | `machines.code` | — | Scouring local record: yes; DB model: yes |
| Process | `process` / `Scouring / 정련기` | None for Scouring record | `Process.code/name` exists | `processes.code`, `processes.name` | — | Local record: yes; DB nullable relation in Batch/ProductionRecord |
| Batch | `batch` / `SC-260917-01` | None for Scouring record | `Batch.batch_no` | `batches.batch_no` | — | Local record: yes; DB field required |
| Recipe | `recipe` / `Cotton / Standard` | None | No recipe field in backend models | None | — | Local record: yes |
| Operator | `operator` / `N. Tran` | None | `User.full_name`; operator IDs in records/logs | `users.full_name`, FK columns | — | Local record: yes; DB relationships vary |
| Record state | `recordStatus: 'CONFIRMED'` | None | `ProductionRecord.status` exists | `production_records.status` | — | Local record: yes; no API mapping |
| Record timestamp | `timestamp` | None | Timestamp fields exist on several DB models | `captured_at`, `started_at`, `ended_at`, timestamps | ISO datetime | Local record: yes |
| Parameter name | `parameters[].name` | None | `ParameterDefinition.name/code` exists | `parameter_definitions.name/code` | — | Local record: yes |
| Actual reading | `parameters[].actual` | None | `ParameterValue.value_numeric` exists | `parameter_values.value_numeric` | parameter-specific | Local record: yes |
| Setpoint | `parameters[].set` | None | No setpoint record field; machine defaults/ranges exist | `machine_parameters.default_value` | parameter-specific | Local record: yes |
| Validation | `parameters[].validationStatus` | None | No equivalent used by API | None | — | Local record: yes |
| Unit | `parameters[].unit` | None | `ParameterDefinition.unit` exists | `parameter_definitions.unit` | L, m/min, °C | Local record: yes |
| Alarm/event | `ScouringEvent` fields | None | `Alarm`, `OperatorLog`, `AuditLog` models exist | corresponding tables | — | Local event fields vary |

The frontend Scouring model is not sent to the backend. Backend database models are structural only in the current application because no route imports `get_db()` or performs model CRUD.

## 6. CURRENT INPUT / EDITING BEHAVIOR

| Field/Action | How User Interacts | Validation | Save Mechanism | Backend Connected? |
|---|---|---|---|---|
| All eight actual parameters | `type=number` input rendered by `ParameterSetpoint` | Empty input logs invalid-input event; finite numeric text updates state. HTML `min`/`max` attributes are set only where ranges exist, but code does not reject out-of-range values. | React state until Confirm Record | No |
| Speed | Number input | 40–50 displayed and used by `validationStatus`; exact endpoints warning, outside alarm | Included in local record after confirmation | No |
| Temperature | Number input | 90–98 displayed and used by `validationStatus`; exact endpoints warning, outside alarm | Included in local record after confirmation | No |
| NaOH, Soap, Desizer, H2O2, Chelate, Cylinder temperature | Number input | Numeric/finite only; no min/max | Included in local record after confirmation | No |
| Invalid input attempt | Empty/non-finite input event | Does not update value; logs `INVALID_INPUT_ATTEMPT` locally | `localStorage` event log | No |
| Out-of-range edit | Numeric input accepted | Sets alarm status and logs a parameter event on status transition | Local state plus localStorage event | No |
| Acknowledge alarm | Button enabled for local alarm count and not already acknowledged | No backend validation | Updates matching local events and appends acknowledgement events | No |
| Confirm record | Button disabled while an alarm exists and has not been acknowledged | No required-field validation beyond current numeric state; alarms must be acknowledged | Appends complete Scouring snapshot to localStorage | No |
| Filters on History/Alarm | Date/select/text inputs | Local string matching and date prefix matching | Component state only | No |

There is no setpoint editing control. The displayed setpoint is a hardcoded value in the module parameter array.

## 7. RECORD / CONFIRM WORKFLOW

The actual path is entirely frontend/browser-local:

```text
Operator edits actual values
        ↓
React state recalculates parameter statuses
        ↓
If alarm exists, operator must click ACKNOWLEDGE ALARM
        ↓
CONFIRM RECORD calls confirmRecord()
        ↓
Builds ScouringDigitalRecord from hardcoded context + current values
        ↓
appendScouringRecord() writes ws3.scouring.records to localStorage
        ↓
appendScouringEvent() writes DIGITAL_RECORD_SAVED to ws3.scouring.events
        ↓
savedRecord state changes button text to RECORD SAVED
```

Specifically:

1. Clicking Confirm invokes `confirmRecord`.
2. It exits immediately when `alarmCount > 0 && !alarmAcknowledged`.
3. It collects machine, process, batch, recipe, operator, timestamp, `CONFIRMED`, and all eight parameter snapshots.
4. It does not call `fetch`, an API route, or database session.
5. It writes JSON to browser `localStorage`.
6. It appends a local event with `DIGITAL_RECORD_SAVED`.
7. It updates in-memory state so the button displays `RECORD SAVED`.
8. No success toast, server response, retry, or server failure path exists.

The backend database is not part of this code path.

## 8. MACHINE STATUS / RUNNING / STOP

There are two separate status implementations:

* Generic `/machines`, `/dashboard`, and `/machine/:machineId` status comes from the FastAPI simulator endpoint. `MockMachineSimulator` returns fixed machine definitions and mathematically varying speed, temperature, and production values. The frontend polls every 3 seconds on list/overview and every 2 seconds on generic HMI. This is explicitly mock simulator data.
* Scouring `/machine/scouring` status is a local `running` boolean initialized to `true`. STOP/START only toggles that React state and appends a local event.

STOP does not control a PLC, sensor, drive, or backend machine record. No PLC, MQTT, OPC-UA, Modbus, or other external machine connection is present in the searched repository. No WebSocket client/server implementation is used by the routes. Scouring running state is not persisted and resets when the page is reloaded. Generic simulator machine status is also not changed by frontend controls.

## 9. ALARM / WARNING SYSTEM

| Alarm/Warning Feature | Trigger | Frontend Only? | Backend? | Persisted? | Status |
|---|---|---:|---:|---:|---|
| Scouring warning | Actual equals configured min or max for Speed/Temperature | Yes | No | Event in localStorage if transition occurs | partially implemented local validation |
| Scouring alarm | Actual below min or above max for Speed/Temperature | Yes | No | Event in localStorage; active/unacknowledged flags are local | partially implemented local validation |
| Invalid input event | Empty/non-finite numeric input | Yes | No | localStorage event | implemented locally |
| Acknowledge alarm | Local parameter alarm event has `UNACKNOWLEDGED` status | Yes | No | Local event mutation plus acknowledgement event | implemented locally |
| Generic simulator WARNING/ALARM | Backend mock machine definition status | No, source is backend simulator | Simulator endpoint only; no alarm persistence | No | read-only simulated status |
| DB `Alarm` model | Schema capability only | No route/use found | Model exists | Not used by current application | unused/dead backend capability |

Warnings and alarms on the Scouring page are application validation of manually entered values, not real machine alarms. Acknowledgement is not persisted to the backend and has no user identity. The alarm page retains local historical events but there is no server alarm lifecycle.

## 10. PROCESS TREND / HISTORY

Scouring Speed Trend and Temperature Trend are custom inline SVG polylines in `ScouringHMIPage.tsx`. They use the last five matching values from browser-local confirmed records plus the current local value. They are not realtime machine trends, do not poll an endpoint, and do not use database readings. Before a second saved point exists, the UI displays `NO SAVED HISTORY` and a dashed placeholder line.

The generic machine HMI has a separate `TrendChart` component. It appends each polled simulator temperature snapshot to React state, keeps the last 24 points, and renders a temperature SVG. It is a short-lived frontend trend, not stored history.

`ScouringHistoryPage` is an actual local history screen. It reads `ws3.scouring.records`, filters records, and shows immutable-looking snapshots. It is not backed by the backend. `ScouringAlarmPage` similarly reads `ws3.scouring.events`.

## 11. BATCH MODEL

### Actual frontend batch fields

| Field | Current value/source | Relationship |
|---|---|---|
| `batch` | `SC-260917-01` in Scouring; simulator has `B-SC-260916-01`, etc. | Stored inside each local Scouring record/event; not a selected backend Batch. |
| `recipe` | `Cotton / Standard` in Scouring local record | Stored in local record; no backend recipe field. |
| `operator` | `N. Tran` in Scouring; simulator has names per machine | Stored in local record/event or simulator snapshot; no authenticated operator flow. |
| `machine` | `SC-01` in Scouring local context | Stored as string in local record/event. |
| `process` | `Scouring / 정련기` in local context | Stored as string in local record/event. |
| `timestamp` | Confirmation/event ISO time | Stored in local record/event. |

### Actual backend Batch fields

`Batch` in `backend/app/models/production.py` has `id`, `batch_no`, nullable `process_id`, nullable `machine_id`, `status`, nullable `planned_quantity`, `started_at`, `ended_at`, and created/updated timestamps. It has a relationship to `Process`; no relationship from `Batch` to `ParameterValue` or `ProductionRecord` is declared in the ORM, although those tables have nullable/foreign-key batch IDs.

The frontend Scouring implementation creates one local snapshot per Confirm Record. A batch can therefore have multiple browser-local records if Confirm is clicked repeatedly, but no batch aggregate or record-count lifecycle is implemented. The relationship is implied by repeated batch strings, not managed by an API/database workflow.

## 12. EXISTING PRODUCTION INPUT / OUTPUT DATA

The backend contains generic `ProductionRecord.quantity`, `ProductionRecord.unit`, and `planned_quantity` fields, and the simulator exposes `productionToday` in kilograms. These are not input/output fabric-meter workflows.

No Scouring UI field or local record field exists for input meters, output meters, fabric length, fabric meters, metres, mts, input fabric, or output fabric. The repository does not implement a production input/output fabric-meter capture flow.

**Production Input/Output fabric meters are not currently implemented.**

## 13. OTHER MACHINES / PROCESSES

| Process | Frontend | Backend | DB | Current Status | Notes |
|---|---|---|---|---|---|
| Scouring | Dedicated HMI, history, alarm pages | Simulator includes SC-01/SC-02; no Scouring CRUD | Generic process/machine/parameter schema | partial/local | Dedicated Scouring route is manual/local; simulator and Scouring data use different IDs/values. |
| Tenter | No dedicated page found | Simulator has TN-01 with `TENTER` and WARNING | Generic schema only | simulator-only | Generic machine routes can display its snapshot. |
| Dyeing | No dedicated page found | Simulator has DY-01 with `DYEING` | Generic schema only | simulator-only | Generic machine routes can display its snapshot. |
| Suction | No implementation found | No simulator definition found | No process-specific implementation found | absent | No dedicated route/model/data. |
| Calendar / Calender | No implementation found | No simulator definition found | No process-specific implementation found | absent | No dedicated route/model/data. |
| Rapid | No implementation found | No simulator definition found | No process-specific implementation found | absent | No dedicated route/model/data. |

## 14. BACKEND API INVENTORY

`backend/app/main.py` includes the router with `settings.api_prefix`, default `/api`.

| Method | Endpoint (default prefix) | Purpose | Request | Response | Used By Frontend? |
|---|---|---|---|---|---|
| GET | `/api/health` | Health check | None | `{status, service, timestamp}` | Not found in frontend |
| GET | `/api/simulator/machines` | List simulated machine snapshots | None | Array of camelCase `MachineSnapshot` objects | Intended by `/machines` and `/dashboard`, but frontend default URL omits `/api` |
| GET | `/api/simulator/machines/{machine_id}` | Get one simulated machine snapshot | Path machine ID | One camelCase `MachineSnapshot` | Intended by generic `MachineHMIPage`, but frontend default URL omits `/api` |

Frontend `machineApi.ts` defaults to `http://localhost:8000` and requests `/simulator/...`; `vite.config.ts` defines no proxy and no API prefix rewrite. Unless `API_PREFIX` is configured empty or an external route rewrites the path, the frontend default requests do not match the backend default `/api` routes.

No POST/PUT/PATCH/DELETE endpoint exists for Scouring records, alarms, batches, parameters, users, machine commands, or confirmations.

## 15. DATABASE INVENTORY

The SQLAlchemy models are registered in `backend/app/models/__init__.py`; the initial Alembic migration calls `Base.metadata.create_all()`.

| Table | Purpose | Important Columns | Relationships | Currently Used? |
|---|---|---|---|---|
| `machines` | Machine master | `code`, `name`, `machine_type`, `location`, `status`, `is_active` | Machine parameters; FKs from other tables | Schema only |
| `parameter_definitions` | Parameter definitions/ranges | `code`, `name`, `unit`, `data_type`, `category`, `min_value`, `max_value`, `is_active` | Machine parameters | Schema only |
| `machine_parameters` | Machine-specific parameter defaults/ranges | machine/definition FKs, `default_value`, min/max, enabled | Unique machine + definition | Schema only |
| `processes` | Process master | `code`, `name`, `description`, `is_active` | Batch/production process FKs | Schema only |
| `batches` | Batch master | `batch_no`, process/machine FKs, status, planned quantity, start/end | Process relationship; referenced by readings/alarms/logs/records | Schema only |
| `parameter_values` | Captured parameter readings | machine parameter FK, batch FK, numeric/text value, captured time, source, recorder | Reading to machine parameter/batch/user by FK | Schema only |
| `production_records` | Production quantities/records | machine/process/batch/operator FKs, record type, quantity/unit/status, start/end, notes | FKs to master entities | Schema only |
| `alarms` | Alarm lifecycle | code, severity, message, status, occurred/ack/resolved fields | Machine/batch/user FKs | Schema only |
| `operator_logs` | Operator actions | operator/machine/batch FKs, action/message, logged time | FKs to users/machine/batch | Schema only |
| `audit_logs` | Auditable changes | user, action, entity, before/after JSON, IP, created time | User FK | Schema only |
| `users` | Operators/users | username, full name, email, password hash, active | Roles and foreign keys from logs/records | Seeded roles only; users not used |
| `roles` | Roles | code, name | `user_roles` many-to-many | Seeded roles only |
| `user_roles` | User-role join | user/role IDs | Many-to-many | Schema only |

The app creates a SQLAlchemy engine/session and has role seed data, but no current route depends on `get_db()` and no database writes are in the current API request paths. The Docker compose file starts PostgreSQL only; it does not start the backend/frontend and does not run migrations.

Therefore, operators, machines, batches, parameter readings, history, alarms, confirmations, and timestamps are not currently stored by the live application in PostgreSQL. Timestamps exist in localStorage records/events and in simulator responses; database timestamp columns are schema capability only.

## 16. MOCK / STATIC / HARDCODED DATA

| Value | Location | Purpose | Should Be Considered Real Data? |
|---|---|---|---|
| `SC-01` | `ScouringHMIPage.tsx` | Scouring machine context | No; hardcoded UI/local record context |
| `SC-260917-01` | `ScouringHMIPage.tsx` | Scouring batch | No; hardcoded demo/local context |
| `N. Tran` | `ScouringHMIPage.tsx` | Scouring operator | No; hardcoded demo/local context |
| `Scouring / 정련기` | `ScouringHMIPage.tsx` | Process label | No; hardcoded context |
| `Cotton / Standard` | `ScouringHMIPage.tsx` | Recipe label | No; hardcoded context |
| 50 L, 18 L, 12 L, 8 L, 5 L | `ScouringHMIPage.tsx` | Initial chemical actual/setpoint values | No; initial demo values |
| 45 m/min, 94 °C, 115 °C | `ScouringHMIPage.tsx` | Initial process actual values | No; initial demo values |
| Speed 40–50; Temperature 90–98 | `ScouringHMIPage.tsx` | Local validation limits | No; hardcoded frontend rules |
| `SC-01`, `SC-02`, `TN-01`, `DY-01` | `backend/app/simulator/mock.py` | Simulator machine definitions | No; deterministic development data |
| `B-SC-260916-01` etc. | `backend/app/simulator/mock.py` | Simulator batch labels | No; simulator data |
| Nguyen Van An, Tran Thi Binh, Le Van Cuong, Pham Thi Dung | `backend/app/simulator/mock.py` | Simulator operator labels | No; simulator data |
| Speed, temperature, productionToday values | `backend/app/simulator/mock.py` | Base values with sine-wave variation | No; generated mock data |
| `42.5`, `86.2`, `1,248`, `2.40`, `78`, `120` | `DesignSystemDemo.tsx` | Design-system preview values | No; static component demo |
| `DEMO MACHINE 01/02`, `M-001/002` | `DesignSystemDemo.tsx` | Design-system preview labels | No; static component demo |
| `14:06:40` | `HMIHeader.tsx` default prop | Default clock fallback | No; placeholder default |

## 17. CURRENT VISUAL SYSTEM

The UI uses React with Tailwind CSS utility classes. There are no CSS modules. Global CSS is in `frontend/src/styles/index.css`; colors are extended in `frontend/tailwind.config.js`.

* Base font: `"Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif`; tabular numeric styling is enabled globally.
* Primary surfaces: navy token `#c4cdd1`, panel `#f7f9f9`, muted surface `#d9e2e6`, HMI console `#ccd6da`, rail `#aebbc2`.
* Industrial colors: `#4b6475` and dark `#394e5d`.
* Borders: line `#9aa8af`; global variables also define strong `#6f828d` and subtle `#9aa8af`.
* State colors: success `#2f7d52`, warning `#a46b00`, alarm `#b03535`, info `#54788a`.
* Buttons: squared (`rounded-none`), 2px borders, primary/secondary/danger/ghost variants, compact/normal/large sizes, inset highlights and active pressed styling.
* Status lamps: 3px/12px circular dots with success/warning/alarm/gray/info tokens.
* Typography: frequent uppercase tracking, monospace/tabular numbers for readings, many explicit 8–13px labels and 16–31px values on Scouring parameter cards.
* Layout conventions: borders and section headers in dark industrial colors, dense instrument-panel presentation, tables with sticky headers, flex/grid layout.
* Global HMI scaling: `--hmi-scale: 1.25`; `#root` width/height are divided by that scale then the root is transformed to 125%.
* No custom spacing scale or component variant system beyond Tailwind utilities and the shared HMI components.
* No documented fixed header/sidebar/bottom-nav dimensions. Header uses `min-h-12`; FunctionKeyBar buttons use `min-h-[52px]`; Scouring uses a 278px large-screen sidebar column.

## 18. RESPONSIVE / SCREEN SIZE BEHAVIOR

The root layout is intentionally authored for an effective 80% viewport and then scaled up:

```css
#root {
  width: calc(100vw / var(--hmi-scale));
  height: calc(100vh / var(--hmi-scale));
  min-height: calc(600px / var(--hmi-scale));
  transform: scale(var(--hmi-scale));
  transform-origin: top left;
  overflow: hidden;
}
```

This global transform is the main reason the Scouring UI looks compact in a smaller browser viewport but becomes stretched/fullscreen-looking at larger sizes: the content is laid out against a viewport reduced to 80%, then every pixel is visually enlarged by 1.25. The Scouring layout also uses a fixed `lg:grid-cols-[278px_minmax(0,1fr)]` sidebar, dense fixed-ish control widths (`88px` STOP button column and parameter input widths), and `overflow-hidden` on the main/root containers.

Responsive behavior is primarily Tailwind breakpoints: `lg` switches Scouring from stacked to a 278px sidebar plus main column; FunctionKeyBar changes from 2 to 4 to 6 columns; history/alarm pages switch to two-column layouts at `lg`; machine/dashboard pages use `max-w-[1280px]`, grids, and overflow-x scrolling for wide tables. No viewport-proportional scaling beyond the global root transform is implemented.

## 19. COMPONENT INVENTORY

| Component | Path | Used Where | Responsibility | Reusable? |
|---|---|---|---|---|
| `HMIHeader` | `frontend/src/components/hmi/HMIHeader.tsx` | All major screens | Industrial/default or machine header, time, machine/status display | Yes |
| `FunctionKeyBar` | `.../FunctionKeyBar.tsx` | All major screens | Bottom F-key visual bar | Yes, but actions supplied by callers |
| `HMIButton` | `.../HMIButton.tsx` | Screens and dialogs/actions | Button variants and sizes | Yes |
| `StatusLamp` | `.../StatusLamp.tsx` | Headers, statuses, alarms, tables | Colored state dot/label | Yes |
| `AlarmIndicator` | `.../AlarmIndicator.tsx` | Design demo and generic HMI | Alarm count presentation | Yes |
| `MachineStatus` | `.../MachineStatus.tsx` | Design demo | Machine name/code/status row | Yes |
| `ParameterCard` | `.../ParameterCard.tsx` | Design demo/generic HMI | Bordered titled panel | Yes |
| `ProcessPanel` | `.../ProcessPanel.tsx` | Design demo/generic HMI | Titled panel with status | Yes |
| `ParameterDisplay` | `.../ParameterDisplay.tsx` | Design demo | Read-only parameter row | Yes |
| `ParameterSetpoint` | `.../ParameterSetpoint.tsx` | Scouring HMI | Actual/setpoint/range display and optional actual input | Yes |
| `SetpointDisplay` | `.../SetpointDisplay.tsx` | Design demo | Current vs setpoint display | Yes |
| `LimitDisplay` | `.../LimitDisplay.tsx` | Design demo | Value with low/high limits | Yes; demo use |
| `ValueDisplay` | `.../ValueDisplay.tsx` | Design demo/generic machine HMI | Numeric value panel | Yes |
| `TrendChart` | `.../TrendChart.tsx` | Generic machine HMI | Inline SVG line chart | Yes |
| `DesignSystemDemo` | `frontend/src/components/DesignSystemDemo.tsx` | `/setup` | Static component preview | Page-level demo |
| `MachineListPage` | `.../MachineListPage.tsx` | `/machines` | API polling, filters, table navigation | Page-specific |
| `ProductionOverviewPage` | `.../ProductionOverviewPage.tsx` | `/dashboard` | API polling and aggregate summary | Page-specific |
| `MachineHMIPage` | `.../MachineHMIPage.tsx` | `/machine/:machineId` | Generic simulator HMI | Page-specific |
| `ScouringHMIPage` | `.../ScouringHMIPage.tsx` | `/machine/scouring` | Manual Scouring HMI and local workflow | Page-specific |
| `ScouringHistoryPage` | `.../ScouringHistoryPage.tsx` | Scouring history | Local records table/detail | Page-specific |
| `ScouringAlarmPage` | `.../ScouringAlarmPage.tsx` | Scouring alarm log | Local event table/detail | Page-specific |

`PlaceholderPage` is defined but not used. `LimitDisplay`, `SetpointDisplay`, `MachineStatus`, `ParameterDisplay`, and many design-system components are used in the preview but not in the Scouring screen.

## 20. CURRENT END-TO-END USER FLOW

```text
Open app
  ↓
/ redirects to /setup
  ↓
Static design-system preview (no connected actions)
  ↓
User must navigate directly to /machine/scouring
  ↓
Scouring page initializes hardcoded SC-01 context and local values
  ↓
Operator edits actual readings in browser state
  ↓
Out-of-range Speed/Temperature creates local warning/alarm state
  ↓
If alarm exists: local Acknowledge Alarm is required
  ↓
Confirm Record writes JSON record/event to browser localStorage
  ↓
History and Alarm routes read those localStorage entries
```

Separate simulator flow:

```text
/machines or /dashboard
  ↓
Frontend polls simulator endpoint
  ↓
Shows mock machine snapshots
  ↓
Click machine
  ↓
/machine/{machineId} read-only generic HMI
```

No current flow reaches a PostgreSQL record write or real machine command.

## 21. IMPLEMENTED VS IMPLIED FUNCTIONALITY

| Feature | UI Suggests | Code Actually Does | Status |
|---|---|---|---|
| Machine running state | Live machine state | Scouring local boolean; generic pages show simulator status | simulated/partial |
| STOP | Stop the machine | Toggles local label and logs local event | UI-only |
| START | Start the machine | Toggles local label and logs local event | UI-only |
| Alarm acknowledgement | Acknowledge machine alarm | Acknowledges local validation events in localStorage | local-only |
| Manual input | Enter current process readings | Numeric inputs update React state | implemented locally |
| Setpoints | Process control targets | Hardcoded display values; no editing/control call | display-only |
| Ranges | Enforced operating limits | Only Speed/Temperature are evaluated; out-of-range numeric values remain accepted | partial validation |
| Confirm record | Persist a production record | Saves a JSON snapshot to browser localStorage | local-only |
| History | Historical production history | Reads local browser snapshots | local-only |
| Speed/temperature trends | Process trend/history | Uses saved local snapshots or short-lived simulator polling | local/demo only |
| Batch | Active managed batch | Hardcoded strings in Scouring; simulator batch strings elsewhere | implied, not managed |
| Operator | Identified authenticated operator | Hardcoded/displayed names; no auth route | implied, not authenticated |
| Production overview | Actual production monitoring | Aggregates mock `productionToday` snapshots in kg | simulator-only |
| Backend database | Durable system of record | Models/migration exist but current routes do not use them | schema-only |
| F-key navigation | Physical HMI navigation | Buttons render labels; only Scouring F4/F5 have handlers | mostly placeholder |

## 22. TECHNICAL / UX CONSTRAINTS ALREADY PRESENT

* `/setup` is the default landing screen and is a component preview, not an operational dashboard.
* Scouring local context and simulator context are separate hardcoded datasets with different batch IDs and operator formats.
* Frontend Scouring records/events use browser `localStorage` keys `ws3.scouring.records` and `ws3.scouring.events`.
* LocalStorage is per browser origin/device and has no server synchronization or user identity.
* The only backend API currently exposes read-only simulator and health data.
* Backend default API prefix is `/api`, while frontend default simulator requests omit `/api`; this is an existing integration constraint.
* Database models and migrations exist but are not wired into API handlers.
* Scouring values and limits are hardcoded in a module-level parameter array.
* Only Speed and Temperature have validation ranges.
* Confirm is blocked by unacknowledged local alarms, but there is no server validation or response handling.
* Root `#root` uses a 1.25 transform and hidden overflow, with a 278px Scouring sidebar at `lg` and fixed-ish dense control widths.
* Generic machine pages poll at 2–3 second intervals; Scouring itself does not poll backend data.
* F-key labels are not keyboard bindings.
* There is no authentication/operator selection, machine command channel, PLC protocol adapter, realtime WebSocket flow, or server-side audit trail in current routes.
* Existing reusable visual components and Tailwind tokens are widely used; the Scouring page also contains custom inline SVG trend markup and dense one-line JSX layout.

## 23. FINAL CURRENT-STATE SUMMARY

### A. What WS3 currently actually does

It serves a React HMI-style frontend and a small FastAPI backend. The backend serves health and deterministic simulated machine snapshots. The frontend can display simulator machines and a generic read-only machine HMI.

### B. What the Scouring module currently actually does

It displays hardcoded Scouring context and eight manual numeric readings, evaluates two parameters against hardcoded ranges, allows local STOP/START display toggling, allows local alarm acknowledgement, and saves confirmed snapshots/events to browser localStorage.

### C. What data is genuinely persisted

Scouring records and event logs are persisted only in browser localStorage. No current frontend workflow writes to PostgreSQL. Database tables are defined but unused by the live API paths.

### D. What is mock/demo only

The `/setup` design preview, simulator machine definitions, simulator changing readings, simulator production totals, Scouring initial values, Scouring machine/batch/operator/recipe strings, and the hardcoded Scouring limits are mock/demo or local UI data.

### E. What appears functional in UI but is not connected

STOP/START, setpoints, machine command semantics, Scouring machine status, alarm acknowledgement as a real alarm operation, Confirm Record as a backend save, operator identity, batch management, F-key navigation, and production input/output fabric meters are not connected to a real backend workflow.

### F. What screens currently exist

`/setup`, `/machines`, `/dashboard`, generic `/machine/:machineId`, `/machine/scouring`, `/machine/scouring/history`, and `/machine/scouring/alarm`, plus redirects.

### G. What major functionality is still absent

Real machine integration/control, authenticated users, backend CRUD, server-persisted Scouring records, server alarms/audit trail, managed batch/recipe flow, production input/output fabric meters, real history/trends, process-specific modules beyond the Scouring local page, and physical keyboard/F-key handling.

### H. Ten facts a product/UX designer must know before redesigning

1. The default route is a design-system preview, not an operational screen.
2. Scouring is a separate route and is not the page opened by selecting SC-01 from the machine list.
3. Scouring values are manually entered frontend state, not live sensor values.
4. Scouring records and alarms are browser-local JSON, not server records.
5. The backend currently serves only health and mock simulator snapshots.
6. The SQLAlchemy schema is broader than the currently exposed functionality and is not wired to the UI.
7. STOP changes only a local boolean and does not stop equipment.
8. Alarms are local range validation for only Speed and Temperature; they are not PLC/machine alarms.
9. Trends are local snapshots or short-lived simulator polling, not durable realtime history.
10. The global 1.25 root transform, fixed Scouring sidebar, dense grids, and hidden overflow materially shape the current screen-size behavior.

## 24. SOURCE REFERENCES

Important conclusions are supported by these files and symbols:

* Routing: `frontend/src/app/App.tsx`, `frontend/src/main.tsx`.
* Scouring UI and workflow: `frontend/src/features/machines/ScouringHMIPage.tsx`, especially `parameters`, `validationStatus`, `handleMachineToggle`, `acknowledgeAlarms`, `updateActualValue`, and `confirmRecord`.
* Scouring local persistence: `frontend/src/features/machines/scouringRecord.ts` and `frontend/src/features/machines/scouringEventLog.ts`.
* Scouring history/alarm views: `frontend/src/features/machines/ScouringHistoryPage.tsx` and `frontend/src/features/machines/ScouringAlarmPage.tsx`.
* Generic machine API and polling: `frontend/src/features/machines/machineApi.ts`, `MachineListPage.tsx`, `MachineHMIPage.tsx`, and `ProductionOverviewPage.tsx`.
* Generic status mapping: `frontend/src/features/machines/machineStatus.ts`.
* Backend route registration: `backend/app/main.py`, `backend/app/api/router.py`.
* Backend endpoints: `backend/app/api/routes/health.py` and `backend/app/api/routes/simulator.py`.
* Simulator data generation: `backend/app/simulator/mock.py`, `backend/app/simulator/source.py`, `backend/app/schemas/simulator.py`.
* Database session/settings: `backend/app/db/session.py`, `backend/app/config/settings.py`.
* Database models: `backend/app/models/machine.py`, `backend/app/models/operations.py`, `backend/app/models/production.py`, `backend/app/models/user.py`, and `backend/app/models/__init__.py`.
* Schema creation/seed: `backend/alembic/versions/20260916_0001_initial_schema.py`, `backend/app/db/seed.py`.
* Visual system and viewport behavior: `frontend/src/styles/index.css`, `frontend/tailwind.config.js`, and reusable components under `frontend/src/components/hmi`.
* Static design preview and unused placeholder: `frontend/src/components/DesignSystemDemo.tsx` and `frontend/src/components/PlaceholderPage.tsx`.
* Runtime/API configuration: `frontend/vite.config.ts`, `docker-compose.yml`, `backend/run.py`.
