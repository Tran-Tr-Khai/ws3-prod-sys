export type MachineStatus = 'RUNNING' | 'WARNING' | 'ALARM' | 'STOPPED' | 'MAINTENANCE' | 'OFFLINE';

export type MachineSnapshot = {
  machineId: string;
  process: string;
  status: MachineStatus;
  batch: string | null;
  speed: number;
  temperature: number;
  productionToday: number;
  operator: string | null;
  startTime: string;
  updatedAt: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export async function fetchMachines(signal?: AbortSignal): Promise<MachineSnapshot[]> {
  const response = await fetch(`${apiBaseUrl}/simulator/machines`, { signal });
  if (!response.ok) {
    throw new Error(`Machine API returned HTTP ${response.status}`);
  }
  return (await response.json()) as MachineSnapshot[];
}

export async function fetchMachine(machineId: string, signal?: AbortSignal): Promise<MachineSnapshot> {
  const response = await fetch(`${apiBaseUrl}/simulator/machines/${encodeURIComponent(machineId)}`, { signal });
  if (!response.ok) {
    throw new Error(response.status === 404 ? 'Machine not found.' : `Machine API returned HTTP ${response.status}`);
  }
  return (await response.json()) as MachineSnapshot;
}
