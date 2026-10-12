const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type PrintRecord = {
  id: number;
  machine_id: 'PR-01';
  production_date: string;
  recorded_at: string;
  order_number: string;
  operator_name: string;
  operator_identifier: string;
  shift: string;
  order_progress: 'IN_PROGRESS' | 'COMPLETED';
  item: string;
  buyer: string;
  design: string;
  speed: number;
  quantity_meters: number;
  created_at: string;
};

export type PrintRecordInput = Omit<PrintRecord, 'id' | 'recorded_at' | 'created_at'>;
export type PrintOrderSource = { item: string | null; buyer: string | null; design: string | null };

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: unknown } | null;
  return typeof body?.detail === 'string' ? body.detail : `Print API returned HTTP ${response.status}`;
}

export async function getPrintOrderSource(sopNo: string): Promise<PrintOrderSource | null> {
  const response = await fetch(`${apiBaseUrl}/api/print/records/orders/${encodeURIComponent(sopNo.trim())}/source`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as PrintOrderSource | null;
}

export async function listPrintRecords(productionDate?: string, options: { signal?: AbortSignal } = {}): Promise<PrintRecord[]> {
  const params = new URLSearchParams({ limit: '500' });
  if (productionDate) params.set('production_date', productionDate);
  const response = await fetch(`${apiBaseUrl}/api/print/records?${params}`, { credentials: 'include', signal: options.signal });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as PrintRecord[];
}

export async function createPrintRecord(payload: PrintRecordInput): Promise<PrintRecord> {
  const response = await fetch(`${apiBaseUrl}/api/print/records`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as PrintRecord;
}

export async function updatePrintRecord(recordId: number, payload: PrintRecordInput): Promise<PrintRecord> {
  const response = await fetch(`${apiBaseUrl}/api/print/records/${recordId}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as PrintRecord;
}

export async function deletePrintRecord(recordId: number): Promise<void> {
  const response = await fetch(`${apiBaseUrl}/api/print/records/${recordId}`, { method: 'DELETE', credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
}

export async function downloadPrintReport(productionDate: string | undefined, language: 'vi' | 'en', orderProgress?: PrintRecord['order_progress'], search?: string): Promise<Blob> {
  const params = new URLSearchParams({ language });
  if (productionDate) params.set('production_date', productionDate);
  if (orderProgress) params.set('order_progress', orderProgress);
  if (search) params.set('search', search);
  const response = await fetch(`${apiBaseUrl}/api/print/records/export?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  return response.blob();
}
