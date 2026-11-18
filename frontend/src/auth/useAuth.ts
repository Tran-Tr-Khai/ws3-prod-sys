import { useContext } from 'react';
import { AuthContext } from './authContextStore';

/** Access the current browser session and its authorized machine scope. */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
