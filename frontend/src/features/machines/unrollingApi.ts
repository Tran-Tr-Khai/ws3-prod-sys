const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type UnrollingRollStatus = 'WAITING' | 'COLLECTED' | 'TRANSFERRED';
export type UnrollingRoll = {
  roll_id: string;
  machine_no: string | null;
  length_meters: number | null;
  collection_status: UnrollingRollStatus;
  collected_at: string | null;
  collected_by: string | null;
  collected_worker_id: string | null;
  collected_shift: string | null;
  transferred_at: string | null;
  transferred_by: string | null;
};

export type UnrollingWorkerProfile = {
  worker_name: string;
  worker_id: string;
  worker_shift: string;
};

export type UnrollingOrder = {
  pk_no: string;
  production_date: string;
  item_code: string | null;
  item_name: string | null;
  lot_no: string | null;
  expected_rolls: number;
  matched_rolls: number;
  collected_rolls: number;
  transferred_rolls: number;
  collection_complete: boolean;
  status: 'READY' | 'CHECK';
  warnings: string[];
  rolls: UnrollingRoll[];
};

async function readError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: unknown } | null;
  return typeof body?.detail === 'string' ? body.detail : fallback;
}

export async function getUnrollingOrders(q = '', signal?: AbortSignal, orderDate = ''): Promise<UnrollingOrder[]> {
  const params = new URLSearchParams({ limit: '500' });
  if (q.trim()) params.set('q', q.trim());
  if (orderDate) params.set('order_date', orderDate);
  const response = await fetch(`${apiBaseUrl}/api/ws3/unrolling/orders?${params}`, {
    credentials: 'include',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  });
  if (!response.ok) throw new Error(await readError(response, `Order API returned HTTP ${response.status}`));
  const result = await response.json() as { orders: UnrollingOrder[] };
  return result.orders;
}

export async function recordUnrollingRollAction(
  pkNo: string,
  rollId: string,
  action: 'COLLECT' | 'UNDO_COLLECTION' | 'TRANSFER_TO_PRODUCTION',
  worker: UnrollingWorkerProfile,
): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/unrolling/roll-actions`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pk_no: pkNo, roll_id: rollId, action, ...worker }),
  });
  if (!response.ok) throw new Error(await readError(response, `Roll action failed with HTTP ${response.status}`));
}
