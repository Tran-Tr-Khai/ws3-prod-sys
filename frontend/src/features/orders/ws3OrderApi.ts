const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type ImportedRow = Record<string, string>;
export type WS3OrderRoll = {
  id: number;
  source_row_index: number;
  raw_data: ImportedRow;
  roll_id: string | null;
  item_code: string | null;
  item_name: string | null;
  lot_no: string | null;
  machine_no: string | null;
  length_meters: number | null;
  shift: string | null;
  worker: string | null;
  remarks: string | null;
  status: string;
};
export type WS3Order = {
  id: number;
  order_no: string;
  source_filename: string | null;
  source_format: string;
  columns: string[];
  mapping: Record<string, string>;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  rolls: WS3OrderRoll[];
  duplicate_count: number;
  new_count: number;
  incomplete_key_count: number;
};

export type WS3ImportBatch = {
  id: number;
  source_filename: string | null;
  source_format: string;
  created_at: string;
  row_count: number;
  available_count: number;
  duplicate_count: number;
  incomplete_key_count: number;
};

export type WS3ImportRow = {
  id: number;
  source_row_index: number;
  source_key: string | null;
  raw_data: ImportedRow;
  status: string;
  order_id: number | null;
};

export type WS3ImportBatchDetail = WS3ImportBatch & {
  columns: string[];
  mapping: Record<string, string>;
  rows: WS3ImportRow[];
};

export async function createWS3Order(payload: {
  source_filename?: string | null;
  source_format: string;
  columns: string[];
  rows: ImportedRow[];
  mapping: Record<string, string>;
  selected_row_indexes?: number[];
  import_batch_id?: number | null;
  import_row_ids?: number[];
}): Promise<WS3Order> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Order API returned HTTP ${response.status}`);
  return (await response.json()) as WS3Order;
}

export async function createWS3ImportBatch(payload: {
  source_filename?: string | null;
  source_format: string;
  columns: string[];
  rows: ImportedRow[];
  mapping: Record<string, string>;
  selected_row_indexes?: number[];
}): Promise<WS3ImportBatch> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Import API returned HTTP ${response.status}`);
  return (await response.json()) as WS3ImportBatch;
}

export async function listWS3ImportBatches(): Promise<WS3ImportBatch[]> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Import API returned HTTP ${response.status}`);
  return (await response.json()) as WS3ImportBatch[];
}

export async function getWS3ImportBatch(id: number): Promise<WS3ImportBatchDetail> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports/${id}`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Import API returned HTTP ${response.status}`);
  return (await response.json()) as WS3ImportBatchDetail;
}

export async function getWS3ImportWarehouse(): Promise<{ columns: string[]; rows: WS3ImportRow[] }> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports/data`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Warehouse API returned HTTP ${response.status}`);
  return (await response.json()) as { columns: string[]; rows: WS3ImportRow[] };
}

export async function updateWS3WarehouseRow(id: number, raw_data: ImportedRow): Promise<WS3ImportRow> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports/data/${id}`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ raw_data }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Warehouse API returned HTTP ${response.status}`);
  return (await response.json()) as WS3ImportRow;
}

export async function archiveWS3WarehouseRow(id: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/imports/data/${id}`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Warehouse API returned HTTP ${response.status}`);
}

export async function parseWS3SourceFile(file: File): Promise<{ filename: string; format: string; text?: string; columns?: string[]; rows?: ImportedRow[]; normalization_message?: string; normalization_message_en?: string; new_row_indexes?: number[]; duplicate_row_indexes?: number[]; incomplete_key_indexes?: number[]; duplicate_count?: number; new_count?: number; incomplete_key_count?: number }> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/parse-file`, { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `File API returned HTTP ${response.status}`);
  return (await response.json()) as { filename: string; format: string; text?: string; columns?: string[]; rows?: ImportedRow[]; normalization_message?: string; normalization_message_en?: string; new_row_indexes?: number[]; duplicate_row_indexes?: number[]; incomplete_key_indexes?: number[]; duplicate_count?: number; new_count?: number; incomplete_key_count?: number };
}

export async function confirmWS3Order(id: number): Promise<WS3Order> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/${id}/status`, {
    method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CONFIRMED' }),
  });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Order API returned HTTP ${response.status}`);
  return (await response.json()) as WS3Order;
}
