import { requestJson } from '../../shared/api/http';

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
export type OverviewMes = {
  item: string | null;
  lot: string | null;
  rolls: number;
  input: number | null;
};

/** Read one overview endpoint while allowing the caller to cancel stale loads. */
async function request<T>(path: string, signal: AbortSignal): Promise<T> {
  return requestJson<T>(`/api/machine-overview/${path}`, { signal }, 'Machine overview API');
}

/** Load the current production overview for one machine. */
export const getOverview = (machineId: string, signal: AbortSignal) =>
  request<OverviewRecord | null>(encodeURIComponent(machineId), signal);

/** Load supporting details for an overview record. */
export const getOverviewDetails = (record: OverviewRecord, signal: AbortSignal) =>
  request<OverviewDetails>(
    `${encodeURIComponent(record.machine_id)}/details?record_id=${record.id}`,
    signal,
  );

/** Load MES order details only when the machine record is linked to an SOP. */
export const getOverviewMes = (record: OverviewRecord, signal: AbortSignal) =>
  record.sop
    ? request<OverviewMes | null>(
        `${encodeURIComponent(record.machine_id)}/mes?${new URLSearchParams({ sop: record.sop })}`,
        signal,
      )
    : Promise.resolve(null);
