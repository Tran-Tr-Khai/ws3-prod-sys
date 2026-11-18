/** Roles granted by the WS3 backend session. */
export type AccessRole = 'ADMIN' | 'SUPERVISOR' | 'OPERATOR';

/** Minimal session identity used for route and machine access decisions. */
export type SessionUser = {
  username: string;
  displayName: string;
  role: AccessRole;
  machineIds: string[];
};

export type LoginResult = 'success' | 'invalidCredentials' | 'sessionCookieRejected';

export type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  canAccessMachine: (machineId: string) => boolean;
};
