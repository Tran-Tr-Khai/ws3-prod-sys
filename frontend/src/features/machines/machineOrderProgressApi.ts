export type OrderProgress = 'IN_PROGRESS' | 'COMPLETED';
export type OrderProgressMachineId = 'BU-01' | 'TE-01' | 'TE-02';

export type MachineOrderProgress = {
  id: number;
  machineId: OrderProgressMachineId;
  orderNumber: string;
  orderProgress: OrderProgress;
  updatedAt: string;
};

type MachineOrderProgressResponse = {
  id: number;
  machine_id: OrderProgressMachineId;
  order_number: string;
  order_progress: OrderProgress;
  updated_at: string;
};

type RequestOptions = { signal?: AbortSignal };

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const progressPath = `${apiBaseUrl}/api/machine-orders/progress`;

function toProgress(response: MachineOrderProgressResponse): MachineOrderProgress {
  return {
    id: response.id,
    machineId: response.machine_id,
    orderNumber: response.order_number,
    orderProgress: response.order_progress,
    updatedAt: response.updated_at,
  };
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, { credentials: 'include', ...init });
  if (response.ok) return response.status === 204 ? undefined as T : response.json() as Promise<T>;

  const body = await response.json().catch(() => ({})) as { detail?: string; message?: string };
  throw new Error(body.message || body.detail || `Machine order API returned HTTP ${response.status}`);
}

/** Read the persisted SOP progress for a supported production machine. */
export async function getMachineOrderProgress(
  machineId: OrderProgressMachineId,
  orderNumber: string,
  options: RequestOptions = {},
): Promise<MachineOrderProgress | null> {
  const query = new URLSearchParams({ machine_id: machineId, order_number: orderNumber.trim() });
  const response = await request<MachineOrderProgressResponse | null>(`${progressPath}?${query}`, { signal: options.signal });
  return response ? toProgress(response) : null;
}

/** Persist the operator's current SOP progress for a supported production machine. */
export async function saveMachineOrderProgress(
  machineId: OrderProgressMachineId,
  orderNumber: string,
  orderProgress: OrderProgress,
  options: RequestOptions = {},
): Promise<MachineOrderProgress> {
  const response = await request<MachineOrderProgressResponse>(progressPath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ machine_id: machineId, order_number: orderNumber.trim(), order_progress: orderProgress }),
    signal: options.signal,
  });
  return toProgress(response);
}
