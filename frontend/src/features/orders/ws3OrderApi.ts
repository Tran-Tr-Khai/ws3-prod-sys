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

export type AutomationRoll = {
  out_no: string;
  item_code: string;
  item_name: string;
  lot_no: string;
  source_order_no?: string;
  roll_id: string;
  machine_no: string;
  production_date: string;
  length_meters: string;
  sop_no: string;
};

export type AutomationGroup = {
  order_no: string;
  item_code: string;
  item_name: string;
  lot_no: string;
  po_no?: string;
  sop_no?: string;
  machine_no?: string;
  expected_rolls: number;
  matched_rolls: number;
  status: 'READY' | 'CHECK';
  plan_rows: number;
  warnings: string[];
  rolls: AutomationRoll[];
};

export type AutomationPreview = {
  groups: AutomationGroup[];
  summary: { orders: number; ready: number; check: number };
  source_counts: { plan: number; order: number; machine: number };
  sources: { plan: string; order: string; machine: string };
};

export async function previewWS3Automation(files: { plan: File; order: File; machine: File }): Promise<AutomationPreview> {
  const formData = new FormData();
  formData.append('plan_file', files.plan);
  formData.append('order_file', files.order);
  formData.append('machine_file', files.machine);
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/automation/preview`, { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Automation API returned HTTP ${response.status}`);
  return (await response.json()) as AutomationPreview;
}

export async function saveWS3Automation(files: { plan: File; order: File; machine: File }): Promise<{ id: number; status: string; summary: AutomationPreview['summary'] }> {
  const formData = new FormData();
  formData.append('plan_file', files.plan);
  formData.append('order_file', files.order);
  formData.append('machine_file', files.machine);
  const response = await fetch(`${apiBaseUrl}/api/ws3/orders/automation/save`, { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Automation save returned HTTP ${response.status}`);
  return (await response.json()) as { id: number; status: string; summary: AutomationPreview['summary'] };
}

export type WS3SnapshotResult = {
  status: 'REPLACED';
  files: Partial<Record<'plan' | 'order' | 'machine' | 'worker', string>>;
  updated: { plans: number | null; orders: number | null; machines: number | null; workers: number | null };
  counts: { plans: number; orders: number; machines: number; workers: number };
};
export type WS3WarehouseSource = 'plan' | 'order' | 'machine' | 'worker';
export type WS3WarehouseSourceSummary = { count: number; first_date: string | null; last_date: string | null; updated_at: string | null };
export type WS3WarehouseSummary = Record<WS3WarehouseSource, WS3WarehouseSourceSummary>;
export type WS3WarehouseRecord = { id: number; date: string | null; created_at: string | null; raw_data: { columns?: string[]; row?: string[] } };
export type WS3WarehousePage = { source: WS3WarehouseSource; total: number; offset: number; limit: number; records: WS3WarehouseRecord[] };

export async function getWS3WarehouseSummary(): Promise<WS3WarehouseSummary> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/admin/data-warehouse/summary`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Warehouse API returned HTTP ${response.status}`);
  return (await response.json()) as WS3WarehouseSummary;
}

export async function getWS3WarehouseRecords(params: { source: WS3WarehouseSource; q?: string; date?: string; offset?: number; limit?: number; sortBy?: number | null; sortDirection?: 'asc' | 'desc' }): Promise<WS3WarehousePage> {
  const query = new URLSearchParams({ offset: String(params.offset ?? 0), limit: String(params.limit ?? 50) });
  if (params.q) query.set('q', params.q);
  if (params.date) query.set('date', params.date);
  if (params.sortBy !== undefined && params.sortBy !== null) query.set('sort_by', String(params.sortBy));
  if (params.sortDirection) query.set('sort_dir', params.sortDirection);
  const response = await fetch(`${apiBaseUrl}/api/ws3/admin/data-warehouse/${params.source}?${query}`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Warehouse API returned HTTP ${response.status}`);
  return (await response.json()) as WS3WarehousePage;
}

export type WS3ProductionRollReport = { out_no: string | null; roll_id: string | null; machine_no: string | null; weaving_date: string | null; length_meters: number | null; shift: string | null; worker: string | null };
export type WS3ProductionOrderReport = { pk_no: string; production_date: string; item_code: string | null; item_name: string | null; lot_no: string | null; sop_no: string | null; machine_no: string | null; expected_rolls: number; matched_rolls: number; status: 'READY' | 'CHECK'; warnings: string[]; rolls: WS3ProductionRollReport[] };
export type WS3ProductionReport = { production_date: string; summary: { orders: number; ready: number; check: number }; orders: WS3ProductionOrderReport[] };

export async function replaceWS3Snapshot(files: Partial<Record<'plan' | 'order' | 'machine' | 'worker', File>>): Promise<WS3SnapshotResult> {
  const formData = new FormData();
  if (files.plan) formData.append('plan_file', files.plan);
  if (files.order) formData.append('order_file', files.order);
  if (files.machine) formData.append('machine_file', files.machine);
  if (files.worker) formData.append('worker_file', files.worker);
  const response = await fetch(`${apiBaseUrl}/api/ws3/data-snapshot`, { method: 'POST', credentials: 'include', body: formData });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Snapshot API returned HTTP ${response.status}`);
  return (await response.json()) as WS3SnapshotResult;
}

export async function getWS3ProductionReport(productionDate: string): Promise<WS3ProductionReport> {
  const response = await fetch(`${apiBaseUrl}/api/ws3/production-orders?production_date=${encodeURIComponent(productionDate)}`, { credentials: 'include' });
  if (!response.ok) throw new Error((await response.json().catch(() => null))?.detail || `Production report API returned HTTP ${response.status}`);
  return (await response.json()) as WS3ProductionReport;
}

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
