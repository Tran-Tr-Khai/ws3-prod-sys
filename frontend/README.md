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

The application runs without a frontend `.env` file. Defaults are centralized
in `src/config/runtime.ts`:

| Variable                | Default                 | Purpose                          |
| ----------------------- | ----------------------- | -------------------------------- |
| `VITE_API_BASE_URL`     | `http://localhost:8000` | Backend HTTP API.                |
| `VITE_WS_BASE_URL`      | Browser origin          | Tenter realtime relay base URL.  |
| `VITE_CAMERA_AGENT_URL` | `http://127.0.0.1:8765` | Local Hikrobot/MVS Camera Agent. |

Docker uses the same-origin API path (`/`) and configures Nginx as the public
reverse proxy. Add a Vite environment override only when an isolated local
integration needs a different endpoint; do not commit it.

## Verification

```powershell
npm run lint
npm run build
```

## Source ownership

- `src/app`: application routes and top-level composition.
- `src/auth`: session API and authentication context.
- `src/components/mes`: shared MES UI primitives.
- `src/config`: browser runtime configuration and endpoint resolution.
- `src/features`: business features grouped by operational area.
- `src/styles`: global design tokens and minimal layout rules.

Keep new endpoint resolution in `src/config/runtime.ts`; feature code should not
read `import.meta.env` directly.
