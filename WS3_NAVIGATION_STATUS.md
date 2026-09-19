# WS3 Navigation QA Status

## Completed routes

- `/` redirects to `/ws3`.
- `/ws3` is the official WS3 production landing page and Scouring entry point.
- `/machine/scouring` is the read-oriented Scouring Overview.
- `/machine/scouring/record` contains the operator entry, review and confirm flow.
- `/machine/scouring/history` displays PostgreSQL-backed Scouring history and details.
- `/machine/scouring/alarm` remains available as the legacy Scouring alarm route.
- `/dashboard` remains the legacy simulator dashboard.
- `/machines` and `/setup` remain available for development and design preview.

Unknown routes fall back to `/ws3`. The specific Scouring routes are declared before the generic `/machine/:machineId` route and are therefore not intercepted by it.

## Shared navigation components

- `WS3Shell.tsx` provides the shared HMI header, global navigation and page workspace.
- `GlobalNavigation.tsx` provides the link back to `/ws3`.
- `MachineNavigation.tsx` provides Overview, Record Entry and History tabs with active-route styling.
- The navigation uses React Router `NavLink`, so direct URLs, browser refresh, back and forward navigation preserve the active state.

## Production overview behavior

The `/ws3` page:

- Lists all six production processes.
- Opens Scouring at `/machine/scouring`.
- Shows the latest Scouring record from `/api/scouring/records` when available.
- Distinguishes loading, no records and backend unavailable states.
- Shows recorded machine, batch, operator, time, record status, warnings and available production meters.
- Does not show realtime machine status, simulated production totals or START/STOP controls.

## QA checks

- TypeScript typecheck: passed.
- Vite production build: passed.
- ESLint: passed.
- `GET /api/scouring/records`: HTTP 200.
- `GET /api/scouring/records/latest`: HTTP 200.
- `GET /api/scouring/records/1`: HTTP 200.
- Empty data and backend error branches are implemented in the Overview, Record Entry and History screens.
- Responsive layout preserves the existing HMI scale behavior for 1024x600-class displays and uses available width without centered production wrappers on fullscreen displays.
- Simulator data remains isolated in `/dashboard`, `/machines` and the simulator API layer; it is not used by `/ws3` or Scouring pages.

## Remaining limitations

- Browser-level visual capture at every target viewport requires the local frontend dev server to be reachable from the test browser. Build and responsive CSS paths were verified, while backend API checks were executed directly.
- Authentication and authorization are not implemented.
- PLC, sensor and realtime telemetry integration are not implemented.
- Input/output meter fields remain nullable provisional business fields.
- Scouring warning ranges remain the currently configured Speed and Temperature expectations and require factory confirmation.

## Next process implementation requirements

For Tenter, Dyeing, Suction, Calendar and Rapid, add each process only after its data contract and persistence source are confirmed. Each module should provide its own overview, record entry and history routes through `WS3Shell`, use real backend data, define validation and warning semantics, and remain separate from simulator behavior until production integration exists.
