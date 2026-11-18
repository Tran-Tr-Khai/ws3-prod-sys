import { requestJson } from '../../shared/api/http';

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

const progressPath = '/api/machine-orders/progress';

function toProgress(response: MachineOrderProgressResponse): MachineOrderProgress {
  return {
    id: response.id,
    machineId: response.machine_id,
    orderNumber: response.order_number,
    orderProgress: response.order_progress,
    updatedAt: response.updated_at,
  };
}

/** Read the persisted SOP progress for a supported production machine. */
export async function getMachineOrderProgress(
  machineId: OrderProgressMachineId,
  orderNumber: string,
  options: RequestOptions = {},
): Promise<MachineOrderProgress | null> {
  const query = new URLSearchParams({ machine_id: machineId, order_number: orderNumber.trim() });
  const response = await requestJson<MachineOrderProgressResponse | null>(
    `${progressPath}?${query}`,
    { signal: options.signal },
    'Machine order API',
  );
  return response ? toProgress(response) : null;
}

/** Persist the operator's current SOP progress for a supported production machine. */
export async function saveMachineOrderProgress(
  machineId: OrderProgressMachineId,
  orderNumber: string,
  orderProgress: OrderProgress,
  options: RequestOptions = {},
): Promise<MachineOrderProgress> {
  const response = await requestJson<MachineOrderProgressResponse>(
    progressPath,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        machine_id: machineId,
        order_number: orderNumber.trim(),
        order_progress: orderProgress,
      }),
      signal: options.signal,
    },
    'Machine order API',
  );
  return toProgress(response);
}
