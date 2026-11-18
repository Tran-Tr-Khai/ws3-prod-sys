import { createContext } from 'react';
import type { AuthContextValue } from './types';

/** Internal context store. Consumers should use the useAuth hook. */
export const AuthContext = createContext<AuthContextValue | null>(null);
