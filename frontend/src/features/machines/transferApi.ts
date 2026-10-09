const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');

export type TransferRecord = {
  id: number;
  machine_id: 'HT-01';
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
  temperature: number;
  speed: number;
  quantity_meters: number;
  created_at: string;
};

export type TransferRecordInput = Omit<TransferRecord, 'id' | 'recorded_at' | 'created_at'>;
export type TransferOrderSource = { item: string | null; buyer: string | null; design: string | null };

async function readError(response: Response): Promise<string> {
  const body = await response.json().catch(() => null) as { detail?: unknown } | null;
  return typeof body?.detail === 'string' ? body.detail : `H/T Transfer API returned HTTP ${response.status}`;
}

export async function getTransferOrderSource(sopNo: string): Promise<TransferOrderSource | null> {
  const response = await fetch(`${apiBaseUrl}/api/transfer/records/orders/${encodeURIComponent(sopNo.trim())}/source`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as TransferOrderSource | null;
}

export async function listTransferRecords(productionDate?: string): Promise<TransferRecord[]> {
  const params = new URLSearchParams({ limit: '500' });
  if (productionDate) params.set('production_date', productionDate);
  const response = await fetch(`${apiBaseUrl}/api/transfer/records?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as TransferRecord[];
}

export async function createTransferRecord(payload: TransferRecordInput): Promise<TransferRecord> {
  const response = await fetch(`${apiBaseUrl}/api/transfer/records`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as TransferRecord;
}

export async function downloadTransferReport(productionDate: string | undefined, language: 'vi' | 'en'): Promise<Blob> {
  const params = new URLSearchParams({ language });
  if (productionDate) params.set('production_date', productionDate);
  const response = await fetch(`${apiBaseUrl}/api/transfer/records/export?${params}`, { credentials: 'include' });
  if (!response.ok) throw new Error(await readError(response));
  return response.blob();
}
