import { describe, expect, it } from 'vitest';
import { canAccessDataWarehouse, canAccessPath, restrictedMachineForPath } from './accessPolicy';
import type { SessionUser } from '../auth/types';

const operator = (machineIds: string[]): SessionUser => ({
  username: 'operator',
  displayName: 'Operator',
  role: 'OPERATOR',
  machineIds,
});

describe('access policy', () => {
  it('resolves protected machine identifiers from routes', () => {
    expect(restrictedMachineForPath('/machine/buffing/record')).toBe('BU-01');
    expect(restrictedMachineForPath('/machine/te-02/history')).toBe('TE-02');
    expect(restrictedMachineForPath('/ws3')).toBeNull();
  });

  it('limits operators to their assigned machines', () => {
    expect(canAccessPath('/machine/buffing/record', operator(['BU-01']))).toBe(true);
    expect(canAccessPath('/machine/buffing/record', operator(['TE-01']))).toBe(false);
  });

  it('limits unrolling and warehouse screens by role', () => {
    expect(canAccessPath('/machine/unrolling/record', operator(['BU-01']))).toBe(false);
    expect(
      canAccessPath('/machine/unrolling/record', { ...operator([]), role: 'SUPERVISOR' }),
    ).toBe(true);
    expect(canAccessDataWarehouse({ ...operator([]), role: 'ADMIN' })).toBe(true);
    expect(canAccessDataWarehouse({ ...operator([]), role: 'SUPERVISOR' })).toBe(false);
  });
});
