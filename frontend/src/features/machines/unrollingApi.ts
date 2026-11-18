import { requestJson } from '../../shared/api/http';

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
  sop_no: string | null;
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

/** Load production orders and roll state for the Unrolling workspace. */
export async function getUnrollingOrders(
  q = '',
  signal?: AbortSignal,
  orderDate = '',
): Promise<UnrollingOrder[]> {
  const params = new URLSearchParams({ limit: '500' });
  if (q.trim()) params.set('q', q.trim());
  if (orderDate) params.set('order_date', orderDate);
  const result = await requestJson<{ orders: UnrollingOrder[] }>(
    `/api/ws3/unrolling/orders?${params}`,
    {
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : AbortSignal.timeout(20000),
    },
    'Unrolling order API',
  );
  return result.orders;
}

/** Record one collect, undo, or production-transfer action for a roll. */
export async function recordUnrollingRollAction(
  pkNo: string,
  rollId: string,
  action: 'COLLECT' | 'UNDO_COLLECTION' | 'TRANSFER_TO_PRODUCTION',
  worker: UnrollingWorkerProfile,
): Promise<void> {
  await requestJson<void>(
    '/api/ws3/unrolling/roll-actions',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pk_no: pkNo, roll_id: rollId, action, ...worker }),
    },
    'Unrolling roll action',
  );
}
