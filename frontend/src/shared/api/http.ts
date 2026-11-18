import { apiBaseUrl } from '../../config/runtime';

type ErrorPayload = { detail?: unknown; message?: unknown };

/**
 * Error returned by an HTTP endpoint.
 *
 * The status is retained so feature code can distinguish expected states such
 * as an expired session or a missing record without parsing an error message.
 */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Build an API URL while preserving absolute URLs returned by the backend. */
export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path) || !apiBaseUrl) return path;
  return `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Read the API error body when available and return a safe operator-facing
 * fallback when a service responds with HTML, an empty body, or invalid JSON.
 */
export async function apiErrorMessage(response: Response, fallback: string): Promise<string> {
  const body = (await response.json().catch(() => null)) as ErrorPayload | null;
  if (typeof body?.message === 'string') return body.message;
  if (typeof body?.detail === 'string') return body.detail;
  return fallback;
}

/**
 * Send a same-session JSON request to the WS3 backend.
 *
 * Callers retain their feature-specific error wording, while credentials and
 * response parsing remain consistent across every MES module.
 */
export async function requestJson<T>(
  path: string,
  init: RequestInit = {},
  errorLabel = 'API request',
): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: 'include',
    ...init,
  });

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
  }

  const message = await apiErrorMessage(response, `${errorLabel} returned HTTP ${response.status}`);
  throw new ApiRequestError(message, response.status);
}
