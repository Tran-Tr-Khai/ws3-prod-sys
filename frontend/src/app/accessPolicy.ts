import type { SessionUser } from '../auth/types';

const UNROLLING_ROLES = new Set(['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER']);

/** Resolve the machine identifier protected by a machine route, if any. */
export function restrictedMachineForPath(pathname: string): string | null {
  if (pathname.startsWith('/machine/buffing')) return 'BU-01';
  const tenteringMachine = pathname.match(/^\/machine\/(TE-01|TE-02)\/(record|history)$/i);
  return tenteringMachine?.[1].toUpperCase() ?? null;
}

/** Return whether a session may open a route before the route is rendered. */
export function canAccessPath(pathname: string, user: SessionUser): boolean {
  if (pathname.startsWith('/machine/unrolling') && !UNROLLING_ROLES.has(user.role)) return false;
  const restrictedMachine = restrictedMachineForPath(pathname);
  return (
    user.role !== 'OPERATOR' || !restrictedMachine || user.machineIds.includes(restrictedMachine)
  );
}

/** Return whether a session may open the administrative warehouse screen. */
export function canAccessDataWarehouse(user: SessionUser): boolean {
  return user.role === 'ADMIN';
}
