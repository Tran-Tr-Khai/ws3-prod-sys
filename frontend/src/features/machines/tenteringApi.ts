import { apiUrl, ApiRequestError, requestJson } from '../../shared/api/http';

export type TenteringRollEntry = {
  id: number;
  roll_number: number;
  roll_id: string | null;
  tenter_date: string | null;
  weaving_date: string | null;
  planned_quantity: number | null;
  actual_quantity: number | null;
  note: string | null;
  recorded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export type TenteringOrder = {
  id: number;
  machine_id: string;
  sop_no: string;
  operator_name: string | null;
  operator_identifier: string | null;
  shift: string | null;
  order_progress: 'IN_PROGRESS' | 'COMPLETED';
  customer: string | null;
  item_description: string | null;
  warp_yarn: string | null;
  weft_yarn: string | null;
  greige_density_pick: number | null;
  finish_density_pick: number | null;
  shrink_percent: number | null;
  greige_width_inch: number | null;
  finish_width_inch: number | null;
  fabric_received_date: string | null;
  created_at: string;
  updated_at: string;
  entries: TenteringRollEntry[];
};

export type TenteringOrderInput = Omit<
  TenteringOrder,
  'id' | 'machine_id' | 'sop_no' | 'created_at' | 'updated_at' | 'entries'
> & {
  entries: Array<
    Pick<
      TenteringRollEntry,
      | 'roll_number'
      | 'roll_id'
      | 'tenter_date'
      | 'weaving_date'
      | 'planned_quantity'
      | 'actual_quantity'
      | 'note'
    >
  >;
};

export type TenteringOrderSource = {
  item_description: string | null;
  customer: string | null;
  rolls: Array<{
    roll_number: number;
    roll_id: string | null;
    weaving_date: string | null;
    length_meters: number | null;
  }>;
  total_rolls: number;
};

/** List saved Tentering SOP records for one physical machine. */
export async function getTenteringOrders(
  machineId: string,
  query = '',
  options: { signal?: AbortSignal } = {},
): Promise<TenteringOrder[]> {
  const params = new URLSearchParams({ limit: '100' });
  params.set('machine_id', machineId);
  if (query.trim()) params.set('q', query.trim());
  return requestJson<TenteringOrder[]>(
    `/api/tentering/orders?${params}`,
    { signal: options.signal },
    'Tentering API',
  );
}

/** Download the filtered Tentering order report as an Excel workbook. */
export async function downloadTenteringReport(filters: {
  machineId: string;
  savedDate?: string;
  query?: string;
  language: 'vi' | 'en';
}): Promise<Blob> {
  const params = new URLSearchParams({ machine_id: filters.machineId, language: filters.language });
  if (filters.savedDate) params.set('saved_date', filters.savedDate);
  if (filters.query?.trim()) params.set('q', filters.query.trim());
  const response = await fetch(apiUrl(`/api/tentering/orders/export?${params.toString()}`), {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`Tentering API returned HTTP ${response.status}`);
  return response.blob();
}

/** Find a saved SOP for one machine, returning null only when it does not exist. */
export async function getTenteringOrder(
  machineId: string,
  sopNo: string,
): Promise<TenteringOrder | null> {
  const params = new URLSearchParams({ machine_id: machineId });
  try {
    return await requestJson<TenteringOrder>(
      `/api/tentering/orders/${encodeURIComponent(sopNo.trim())}?${params}`,
      {},
      'Tentering API',
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) return null;
    throw error;
  }
}

/** Load MES source data that can prefill a Tentering SOP. */
export async function getTenteringOrderSource(
  machineId: string,
  sopNo: string,
): Promise<TenteringOrderSource | null> {
  const params = new URLSearchParams({ machine_id: machineId });
  return requestJson<TenteringOrderSource | null>(
    `/api/tentering/orders/${encodeURIComponent(sopNo.trim())}/source?${params}`,
    {},
    'Tentering API',
  );
}

/** Create or replace the saved production record for one Tentering SOP. */
export async function saveTenteringOrder(
  machineId: string,
  sopNo: string,
  payload: TenteringOrderInput,
): Promise<TenteringOrder> {
  const params = new URLSearchParams({ machine_id: machineId });
  return requestJson<TenteringOrder>(
    `/api/tentering/orders/${encodeURIComponent(sopNo.trim())}?${params}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Tentering API',
  );
}
