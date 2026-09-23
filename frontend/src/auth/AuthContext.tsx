import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import * as authApi from './authApi';

export type AccessRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';
export type SessionUser = { username: string; displayName: string; role: AccessRole; machineIds: string[] };
type AuthContextValue = { user: SessionUser | null; loading: boolean; login: (username: string, password: string) => Promise<boolean>; logout: () => Promise<void>; canAccessMachine: (machineId: string) => boolean };
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { void authApi.getCurrentUser().then(setUser).finally(() => setLoading(false)); }, []);
  const login = async (username: string, password: string) => { try { setUser(await authApi.login(username, password)); return true; } catch { return false; } };
  const logout = async () => { try { await authApi.logout(); } finally { setUser(null); } };
  const value = useMemo(() => ({ user, loading, login, logout, canAccessMachine: (machineId: string) => Boolean(user && (user.role !== 'OPERATOR' || user.machineIds.includes(machineId))) }), [loading, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context; }
export function RequireAuth() { const { user } = useAuth(); const location = useLocation(); return user ? <>{/* Protected application routes */}</> : <Navigate to="/login" replace state={{ from: location.pathname }} />; }
