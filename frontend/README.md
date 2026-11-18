# WS3 Frontend

React, TypeScript and Vite application for the WS3 MES interface.

## Run locally

From this directory:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
```

The development server listens on `http://localhost:5173`.

## Environment variables

`frontend/.env` is optional. When it is absent, the application uses safe local
defaults so a new developer can start immediately.

| Variable                | Default                 | Purpose                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `VITE_API_BASE_URL`     | `http://localhost:8000` | Backend HTTP API.                |
| `VITE_WS_BASE_URL`      | Browser origin          | Tenter realtime relay base URL.  |
| `VITE_CAMERA_AGENT_URL` | `http://127.0.0.1:8765` | Local Hikrobot/MVS Camera Agent. |

Do not commit `.env`. Use `.env.example` as the shareable template. Docker uses
the same-origin API path (`/`) and configures Nginx as the public reverse proxy.

## Verification

```powershell
npm run lint
npm run build
```

## Source ownership

- `src/app`: application routes and top-level composition.
- `src/auth`: session API and authentication context.
- `src/components/mes`: shared MES UI primitives.
- `src/components/hmi`: shared legacy-compatible machine UI primitives still
  used by active Buffing, Tentering and Unrolling screens.
- `src/config`: browser runtime configuration and endpoint resolution.
- `src/features`: business features grouped by operational area.
- `src/styles`: global design tokens and minimal layout rules.

Keep new endpoint resolution in `src/config/runtime.ts`; feature code should not
read `import.meta.env` directly.
