# WS3 Frontend

React, TypeScript and Vite application for the WS3 MES interface.

## Run locally

From this directory:

```powershell
npm ci
npm run dev
```

The development server listens on `http://localhost:5173`.

## Runtime endpoints

The application runs with defaults from `src/config/runtime.ts`. Vite dev
and preview proxy `/api` and `/ws` to the local backend. The root `.env`
sets its port through `PORT` (default `8000`).

| Variable                | Default                 | Purpose                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `VITE_API_BASE_URL`     | Browser origin          | Backend HTTP API.                |
| `VITE_WS_BASE_URL`      | Browser origin          | Tenter realtime relay base URL.  |
| `VITE_CAMERA_AGENT_URL` | `http://127.0.0.1:8765` | Local Hikrobot/MVS Camera Agent. |

Docker uses the same-origin API path (`/`) and configures Nginx as the public
reverse proxy. Add a Vite environment override only when an isolated local
integration needs a different endpoint; do not commit it.

## Verification

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run format:check
```

`npm run check` runs lint, TypeScript, unit tests and formatting checks
together. The build remains a separate command because it also produces the
deployable Vite bundle.

## Architecture

The frontend is a feature-oriented React SPA. It is intentionally kept as one
application because the MES screens share authentication, navigation, table
patterns and runtime configuration.

```text
src/
├── app/          routes and top-level composition
├── auth/         session state and authentication API
├── components/   reusable, domain-neutral UI (especially MES primitives)
├── config/       runtime endpoint resolution
├── features/     business features grouped by operational area
├── i18n/         language state and translations
├── shared/       cross-feature API, types, formatters and utilities
└── styles/       global design tokens and base styles
```

## Source ownership

- `src/app`: application routes and top-level composition.
- `src/auth`: session API and authentication context.
- `src/components/mes`: shared MES UI primitives.
- `src/config`: browser runtime configuration and endpoint resolution.
- `src/features`: business features grouped by operational area.
- `src/shared`: code that is independent of a single business feature,
  including HTTP access and locale-aware formatters.
- `src/styles`: global design tokens and minimal layout rules.

Keep new endpoint resolution in `src/config/runtime.ts`; feature code should not
read `import.meta.env` directly.

## Frontend conventions

### Feature boundaries

Each feature owns its page, API adapter, types, hooks and feature-specific
styles. A feature may import from `components`, `shared`, `auth` and `config`,
but shared code must not import from a feature.

Prefer this shape for new work:

```text
features/<domain>/
├── <Domain>Page.tsx
├── <domain>Api.ts
├── types.ts
├── use<Domain>.ts       # only when state/effects need extraction
└── <Domain>Page.css
```

Do not put business logic in `App.tsx` or in reusable MES components.

### API access

Use the shared HTTP client in `src/shared/api/http.ts`. Feature API modules
should expose typed functions such as `getOrders` or `updateOrder`, not raw
`fetch` calls. Use `requestJson` for JSON/form requests and `requestBlob` for
downloads. Feature adapters are responsible for endpoint paths and response
mapping; pages are responsible for presenting loading, empty and error states.

Direct `fetch` is reserved for intentionally different transports such as the
camera agent and WebSocket setup. Those exceptions must remain isolated in
their feature API/client module.

### Naming and types

- React components and files: `PascalCase`.
- Hooks: `useSomething`.
- API adapters and utility modules: `camelCase` with a descriptive suffix.
- Types and interfaces: `PascalCase`.
- Constants: `camelCase` unless they are true module-level constants.
- Keep API response types near the feature that owns the endpoint.
- Avoid `any`; normalize uncertain API data at the adapter boundary.

### Components and state

Pages compose layout and coordinate hooks. Components render one coherent UI
region. Move repeated effects, filters, pagination and connection handling into
custom hooks. Do not introduce global state for data that belongs to one page;
use context only for cross-application concerns such as auth and language.

### Tenter preview data

The Tenter record page supports an explicit visual fixture for local UI review:

```text
/machine/TE-01/record?mock=tenter
```

This query parameter replaces only the realtime signal source with generated
values. SOP lookup, authentication and all production API calls remain real;
the fixture is never enabled implicitly in a deployed page.

### Styling

Use the existing MES design tokens and shared components before adding new
colors, spacing or typography. Feature CSS owns feature layout; shared MES CSS
owns reusable table, control and status patterns. Avoid arbitrary inline styles
for primary layout or visual rules, and do not create a second styling pattern
when an existing component already covers the use case.

Global CSS owns only page-level tokens, reset rules and responsive shell
behavior. Feature styles should target named feature classes rather than
structural selectors such as `section > div`, so layout changes do not silently
break unrelated screens.

### Change checklist

Before submitting a frontend change:

1. Keep API access inside an API/client module.
2. Add or update types for changed data.
3. Reuse shared MES primitives where applicable.
4. Handle loading, empty, error and unauthorized states.
5. Run `npm run lint`, `npm run build` and `npm run format:check`.
