import type { AccessRole, SessionUser } from './AuthContext';

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
type UserApi = { username: string; display_name: string; role: AccessRole; machine_ids: string[] };
const fromApi = (user: UserApi): SessionUser => ({ username: user.username, displayName: user.display_name, role: user.role, machineIds: user.machine_ids });

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, credentials: 'include', headers: { 'Content-Type': 'application/json', ...init?.headers } });
  if (!response.ok) throw new Error(`Authentication request failed (${response.status})`);
  return response.status === 204 ? undefined as T : await response.json() as T;
}

export async function login(username: string, password: string): Promise<SessionUser> { return fromApi(await request<UserApi>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })); }
export async function getCurrentUser(): Promise<SessionUser | null> { try { return fromApi(await request<UserApi>('/api/auth/me')); } catch { return null; } }
export async function logout(): Promise<void> { await request<void>('/api/auth/logout', { method: 'POST' }); }
