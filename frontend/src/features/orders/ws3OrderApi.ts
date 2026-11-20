import { requestJson } from '../../shared/api/http';

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

export type WS3SnapshotResult = {
  status: 'REPLACED';
  files: Partial<Record<'order' | 'machine' | 'worker', string>>;
  updated: { orders: number | null; machines: number | null; workers: number | null };
  counts: { orders: number; machines: number; workers: number };
};
export type WS3WarehouseSource = 'order' | 'machine' | 'worker';
export type WS3WarehouseSourceSummary = {
  count: number;
  first_date: string | null;
  last_date: string | null;
  updated_at: string | null;
};
export type WS3WarehouseSummary = Record<WS3WarehouseSource, WS3WarehouseSourceSummary>;
export type WS3WarehouseRecord = {
  id: number;
  date: string | null;
  created_at: string | null;
  raw_data: { columns?: string[]; row?: string[] };
};
export type WS3WarehousePage = {
  source: WS3WarehouseSource;
  total: number;
  offset: number;
  limit: number;
  records: WS3WarehouseRecord[];
};

/** Load record counts and date ranges for each data-warehouse source. */
export async function getWS3WarehouseSummary(): Promise<WS3WarehouseSummary> {
  return requestJson<WS3WarehouseSummary>(
    '/api/ws3/admin/data-warehouse/summary',
    {},
    'Warehouse API',
  );
}

/** Load one sortable, pageable data-warehouse result page. */
export async function getWS3WarehouseRecords(params: {
  source: WS3WarehouseSource;
  q?: string;
  date?: string;
  offset?: number;
  limit?: number;
  sortBy?: number | null;
  sortDirection?: 'asc' | 'desc';
}): Promise<WS3WarehousePage> {
  const query = new URLSearchParams({
    offset: String(params.offset ?? 0),
    limit: String(params.limit ?? 50),
  });
  if (params.q) query.set('q', params.q);
  if (params.date) query.set('date', params.date);
  if (params.sortBy !== undefined && params.sortBy !== null)
    query.set('sort_by', String(params.sortBy));
  if (params.sortDirection) query.set('sort_dir', params.sortDirection);
  return requestJson<WS3WarehousePage>(
    `/api/ws3/admin/data-warehouse/${params.source}?${query}`,
    {},
    'Warehouse API',
  );
}

export type WS3ProductionRollReport = {
  remarks: string | null;
  item_code: string | null;
  item_name: string | null;
  lot_no: string | null;
  worker_candidates: Array<{ shift: string; worker: string }>;
  out_no: string | null;
  roll_id: string | null;
  machine_no: string | null;
  source_date: string | null;
  weaving_date: string | null;
  length_meters: number | null;
  shift: string | null;
  worker: string | null;
};
export type WS3ProductionOrderReport = {
  pk_no: string;
  production_date: string;
  item_code: string | null;
  item_name: string | null;
  lot_no: string | null;
  sop_no: string | null;
  machine_no: string | null;
  expected_rolls: number;
  matched_rolls: number;
  status: 'READY' | 'CHECK';
  warnings: string[];
  rolls: WS3ProductionRollReport[];
};
export type WS3ProductionReport = {
  production_date: string;
  summary: { orders: number; ready: number; check: number };
  orders: WS3ProductionOrderReport[];
};

/** Resolve a production order context for a machine and SOP/order code. */
export async function getWS3ProductionOrderContext(
  orderNumber: string,
  machineId: 'BU-01' | 'SC-01' = 'BU-01',
): Promise<WS3ProductionOrderReport | null> {
  const query = new URLSearchParams({ order_number: orderNumber, machine_id: machineId });
  return requestJson<WS3ProductionOrderReport | null>(
    `/api/ws3/production-order-context?${query}`,
    {},
    'Production order API',
  );
}

/** Replace the MES snapshot files used to derive WS3 production data. */
export async function replaceWS3Snapshot(
  files: Partial<Record<'order' | 'machine' | 'worker', File>>,
): Promise<WS3SnapshotResult> {
  const formData = new FormData();
  if (files.order) formData.append('order_file', files.order);
  if (files.machine) formData.append('machine_file', files.machine);
  if (files.worker) formData.append('worker_file', files.worker);
  return requestJson<WS3SnapshotResult>(
    '/api/ws3/data-snapshot',
    { method: 'POST', body: formData },
    'Snapshot API',
  );
}

/** Load all production orders and rolls for one production date. */
export async function getWS3ProductionReport(
  productionDate: string,
  options: { signal?: AbortSignal } = {},
): Promise<WS3ProductionReport> {
  return requestJson<WS3ProductionReport>(
    `/api/ws3/production-orders?production_date=${encodeURIComponent(productionDate)}`,
    { signal: options.signal },
    'Production report API',
  );
}

/** Create a WS3 production order from normalized imported source rows. */
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
  return requestJson<WS3Order>(
    '/api/ws3/orders',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Order API',
  );
}

/** Persist a staged import batch before operators select final production rows. */
export async function createWS3ImportBatch(payload: {
  source_filename?: string | null;
  source_format: string;
  columns: string[];
  rows: ImportedRow[];
  mapping: Record<string, string>;
  selected_row_indexes?: number[];
}): Promise<WS3ImportBatch> {
  return requestJson<WS3ImportBatch>(
    '/api/ws3/orders/imports',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    'Import API',
  );
}

/** List previously staged source-file imports. */
export async function listWS3ImportBatches(): Promise<WS3ImportBatch[]> {
  return requestJson<WS3ImportBatch[]>('/api/ws3/orders/imports', {}, 'Import API');
}

/** Load one staged import with its column mapping and source rows. */
export async function getWS3ImportBatch(id: number): Promise<WS3ImportBatchDetail> {
  return requestJson<WS3ImportBatchDetail>(`/api/ws3/orders/imports/${id}`, {}, 'Import API');
}

/** Load rows stored in the WS3 staging warehouse. */
export async function getWS3ImportWarehouse(): Promise<{
  columns: string[];
  rows: WS3ImportRow[];
}> {
  return requestJson<{ columns: string[]; rows: WS3ImportRow[] }>(
    '/api/ws3/orders/imports/data',
    {},
    'Warehouse API',
  );
}

/** Update the raw source values for one staging-warehouse row. */
export async function updateWS3WarehouseRow(
  id: number,
  raw_data: ImportedRow,
): Promise<WS3ImportRow> {
  return requestJson<WS3ImportRow>(
    `/api/ws3/orders/imports/data/${id}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_data }),
    },
    'Warehouse API',
  );
}

/** Archive one staging row that should not be used for order creation. */
export async function archiveWS3WarehouseRow(id: number): Promise<void> {
  await requestJson<void>(
    `/api/ws3/orders/imports/data/${id}`,
    { method: 'DELETE' },
    'Warehouse API',
  );
}

/** Upload and normalize a source file without committing an import batch yet. */
export async function parseWS3SourceFile(file: File): Promise<{
  filename: string;
  format: string;
  text?: string;
  columns?: string[];
  rows?: ImportedRow[];
  normalization_message?: string;
  normalization_message_en?: string;
  new_row_indexes?: number[];
  duplicate_row_indexes?: number[];
  incomplete_key_indexes?: number[];
  duplicate_count?: number;
  new_count?: number;
  incomplete_key_count?: number;
}> {
  const formData = new FormData();
  formData.append('file', file);
  return requestJson<{
    filename: string;
    format: string;
    text?: string;
    columns?: string[];
    rows?: ImportedRow[];
    normalization_message?: string;
    normalization_message_en?: string;
    new_row_indexes?: number[];
    duplicate_row_indexes?: number[];
    incomplete_key_indexes?: number[];
    duplicate_count?: number;
    new_count?: number;
    incomplete_key_count?: number;
  }>('/api/ws3/orders/parse-file', { method: 'POST', body: formData }, 'File API');
}

/** Mark a drafted WS3 production order as confirmed for downstream use. */
export async function confirmWS3Order(id: number): Promise<WS3Order> {
  return requestJson<WS3Order>(
    `/api/ws3/orders/${id}/status`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'CONFIRMED' }),
    },
    'Order API',
  );
}
