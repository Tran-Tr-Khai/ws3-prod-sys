import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as authApi from './authApi';
import { AuthContext } from './authContextStore';
import type { LoginResult, SessionUser } from './types';

/** Provide authenticated session state to all application routes. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void authApi
      .getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);
  const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
      setUser(await authApi.login(username, password));
      return 'success';
    } catch (reason) {
      setUser(null);
      return reason instanceof Error && reason.message === 'SESSION_COOKIE_REJECTED'
        ? 'sessionCookieRejected'
        : 'invalidCredentials';
    }
  };
  const logout = async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
    }
  };
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      canAccessMachine: (machineId: string) =>
        Boolean(user && (user.role !== 'OPERATOR' || user.machineIds.includes(machineId))),
    }),
    [loading, user],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
