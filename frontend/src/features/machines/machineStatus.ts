import type { HMIStatus } from '../../components/hmi';
import type { MachineStatus } from './machineApi';

export const machineStatusOptions: MachineStatus[] = [
  'RUNNING',
  'WARNING',
  'ALARM',
  'STOPPED',
  'MAINTENANCE',
  'OFFLINE',
];

export function toHMIStatus(status: MachineStatus): HMIStatus {
  const statusMap: Record<MachineStatus, HMIStatus> = {
    RUNNING: 'running',
    WARNING: 'warning',
    ALARM: 'alarm',
    STOPPED: 'stopped',
    MAINTENANCE: 'maintenance',
    OFFLINE: 'offline',
  };
  return statusMap[status];
}

export function formatStatus(status: MachineStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}
