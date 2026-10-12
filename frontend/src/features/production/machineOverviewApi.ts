const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type OverviewRecord = {
  id: number;
  machine_id: string;
  sop: string | null;
  progress: 'IN_PROGRESS' | 'COMPLETED' | null;
  shift: string | null;
  operator: string | null;
  employee: string | null;
  recorded: string;
  started: string | null;
  item: string | null;
  lot: string | null;
  output: number | null;
  speed: number | null;
  temperature: number | null;
  inspection: 'PASS' | 'WARNING' | null;
};
export type OverviewDetails = {
  started: string | null;
  rolls?: number;
  output?: number | null;
  checks?: number;
  failed_checks?: number;
  inspection?: 'PASS' | 'WARNING';
};
export type OverviewMes = { item: string | null; lot: string | null; rolls: number; input: number | null };

async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${baseUrl}/api/machine-overview/${path}`, { credentials: 'include', signal });
  if (!response.ok) throw new Error(`Machine overview returned HTTP ${response.status}`);
  return response.json() as Promise<T>;
}

export const getOverview = (machineId: string, signal: AbortSignal) => request<OverviewRecord | null>(encodeURIComponent(machineId), signal);
export const getOverviewDetails = (record: OverviewRecord, signal: AbortSignal) => request<OverviewDetails>(`${encodeURIComponent(record.machine_id)}/details?record_id=${record.id}`, signal);
export const getOverviewMes = (record: OverviewRecord, signal: AbortSignal) => record.sop
  ? request<OverviewMes | null>(`${encodeURIComponent(record.machine_id)}/mes?${new URLSearchParams({ sop: record.sop })}`, signal)
  : Promise.resolve(null);
