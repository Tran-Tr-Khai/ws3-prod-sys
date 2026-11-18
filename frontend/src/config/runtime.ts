/**
 * Runtime endpoints used by the browser application.
 *
 * The fallback values keep local development usable without an `.env` file.
 * Docker builds set `VITE_API_BASE_URL=/` so Nginx proxies API requests
 * through the same origin.
 */
function normalizedUrl(value: string | undefined, fallback: string): string {
  return (value?.trim() || fallback).replace(/\/+$/, '');
}

export const apiBaseUrl = normalizedUrl(import.meta.env.VITE_API_BASE_URL, 'http://localhost:8000');

export const cameraAgentUrl = normalizedUrl(
  import.meta.env.VITE_CAMERA_AGENT_URL,
  'http://127.0.0.1:8765',
);

/**
 * Return the Tenter relay endpoint for one machine.
 *
 * A configured URL is useful during local development. In deployed builds the
 * browser connects to the current website origin, so the reverse proxy remains
 * the single public entry point.
 */
export function tenterRealtimeUrl(machineId: string): string {
  const configured = import.meta.env.VITE_WS_BASE_URL?.trim();
  const baseUrl = configured
    ? configured
        .replace(/\/$/, '')
        .replace(/^http:/, 'ws:')
        .replace(/^https:/, 'wss:')
    : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`;

  return `${baseUrl}/ws/tenter-data?machine_id=${encodeURIComponent(machineId)}`;
}
