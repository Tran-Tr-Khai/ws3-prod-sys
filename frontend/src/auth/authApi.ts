import type { AccessRole, SessionUser } from './types';
import { requestJson } from '../shared/api/http';

type UserApi = { username: string; display_name: string; role: AccessRole; machine_ids: string[] };
const fromApi = (user: UserApi): SessionUser => ({
  username: user.username,
  displayName: user.display_name,
  role: user.role,
  machineIds: user.machine_ids,
});

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  return requestJson<T>(
    path,
    { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } },
    'Authentication request',
  );
}

/** Start a session and return the authenticated user's access scope. */
export async function login(username: string, password: string): Promise<SessionUser> {
  await request<UserApi>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  try {
    return fromApi(await request<UserApi>('/api/auth/me'));
  } catch {
    throw new Error('SESSION_COOKIE_REJECTED');
  }
}

/** Return the current session user, or null when no valid session exists. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  try {
    return fromApi(await request<UserApi>('/api/auth/me'));
  } catch {
    return null;
  }
}

/** End the current browser session. */
export async function logout(): Promise<void> {
  await request<void>('/api/auth/logout', { method: 'POST' });
}
