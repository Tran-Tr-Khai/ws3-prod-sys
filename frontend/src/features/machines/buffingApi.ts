import { apiUrl, requestJson } from '../../shared/api/http';

export type BuffingImage = {
  id: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  isPrimary: boolean;
  url: string;
};

export type BuffingCheck = {
  id: number;
  machineId: string;
  checkDate: string;
  checkedAt: string;
  operatorName: string | null;
  operatorIdentifier: string | null;
  shift: string | null;
  orderNumber: string | null;
  orderProgress: 'IN_PROGRESS' | 'COMPLETED' | null;
  checks: boolean[];
  remark: string | null;
  createdAt: string;
  images: BuffingImage[];
};

export type BuffingCheckCreatePayload = {
  machineId?: string;
  checkDate: string;
  checkedAt?: string;
  operatorName: string;
  operatorIdentifier: string;
  shift: string;
  orderNumber: string;
  orderProgress?: 'IN_PROGRESS' | 'COMPLETED';
  checks: boolean[];
  remark?: string | null;
};

type BuffingCheckResponse = {
  id: number;
  machine_id: string;
  check_date: string;
  checked_at: string;
  operator_name: string | null;
  operator_identifier: string | null;
  shift: string | null;
  order_number: string | null;
  order_progress: 'IN_PROGRESS' | 'COMPLETED' | null;
  check_1: boolean;
  check_2: boolean;
  check_3: boolean;
  check_4: boolean;
  check_5: boolean;
  remark: string | null;
  created_at: string;
  images?: BuffingImageResponse[];
};

type BuffingImageResponse = {
  id: number;
  original_name: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  is_primary: boolean;
  url: string;
};

type RequestOptions = { signal?: AbortSignal };

const checksPath = '/api/buffing/checks';

function toApiUrl(path: string): string {
  return apiUrl(path);
}

function toImage(image: BuffingImageResponse): BuffingImage {
  return {
    id: image.id,
    originalName: image.original_name,
    mimeType: image.mime_type,
    fileSize: image.file_size,
    sortOrder: image.sort_order,
    isPrimary: image.is_primary,
    url: toApiUrl(image.url),
  };
}

function toCheck(response: BuffingCheckResponse): BuffingCheck {
  return {
    id: response.id,
    machineId: response.machine_id,
    checkDate: response.check_date,
    checkedAt: response.checked_at,
    operatorName: response.operator_name,
    operatorIdentifier: response.operator_identifier,
    shift: response.shift,
    orderNumber: response.order_number,
    orderProgress: response.order_progress,
    checks: [
      response.check_1,
      response.check_2,
      response.check_3,
      response.check_4,
      response.check_5,
    ],
    remark: response.remark,
    createdAt: response.created_at,
    images: (response.images ?? []).map(toImage),
  };
}

function toCreatePayload(payload: BuffingCheckCreatePayload) {
  return {
    machine_id: payload.machineId ?? 'BU-01',
    check_date: payload.checkDate,
    checked_at: payload.checkedAt,
    operator_name: payload.operatorName,
    operator_identifier: payload.operatorIdentifier,
    shift: payload.shift,
    order_number: payload.orderNumber,
    order_progress: payload.orderProgress ?? 'IN_PROGRESS',
    check_1: payload.checks[0] ?? false,
    check_2: payload.checks[1] ?? false,
    check_3: payload.checks[2] ?? false,
    check_4: payload.checks[3] ?? false,
    check_5: payload.checks[4] ?? false,
    remark: payload.remark ?? null,
  };
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  try {
    return await requestJson<T>(url, init, 'Buffing API');
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    if (error instanceof TypeError) throw new Error('Unable to reach the Buffing backend.');
    throw error;
  }
}

/** List checklist records, optionally narrowed to one production date. */
export async function getBuffingChecks(
  checkDate?: string,
  options: RequestOptions = {},
  limit?: number,
): Promise<BuffingCheck[]> {
  const params = new URLSearchParams();
  if (checkDate) params.set('check_date', checkDate);
  if (limit !== undefined) params.set('limit', String(limit));
  const query = params.size ? `?${params}` : '';
  return (
    await request<BuffingCheckResponse[]>(`${checksPath}${query}`, { signal: options.signal })
  ).map(toCheck);
}

/** List checklist records linked to an entered SOP/order code. */
export async function getBuffingChecksForOrder(
  orderNumber: string,
  options: RequestOptions = {},
): Promise<BuffingCheck[]> {
  const query = new URLSearchParams({ order_number: orderNumber.trim() });
  return (
    await request<BuffingCheckResponse[]>(`${checksPath}?${query}`, { signal: options.signal })
  ).map(toCheck);
}

/** Create one Buffing checklist record. */
export async function createBuffingCheck(
  payload: BuffingCheckCreatePayload,
  options: RequestOptions = {},
): Promise<BuffingCheck> {
  return toCheck(
    await request<BuffingCheckResponse>(checksPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toCreatePayload(payload)),
      signal: options.signal,
    }),
  );
}

/** Delete a checklist record and its associated images. */
export async function deleteBuffingCheck(
  checkId: number,
  options: RequestOptions = {},
): Promise<void> {
  await request<void>(`${checksPath}/${checkId}`, { method: 'DELETE', signal: options.signal });
}

/** Upload checklist images after the parent check has been saved. */
export async function uploadBuffingImages(
  checkId: number,
  files: File[],
  options: RequestOptions = {},
): Promise<BuffingImage[]> {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  return (
    await request<BuffingImageResponse[]>(`${checksPath}/${checkId}/images`, {
      method: 'POST',
      body,
      signal: options.signal,
    })
  ).map(toImage);
}

/** Download the filtered checklist report as an Excel file. */
export async function downloadBuffingReport(
  checkDate: string | undefined,
  language: 'vi' | 'en',
  orderNumber?: string,
  options: RequestOptions = {},
): Promise<Blob> {
  const params = new URLSearchParams({ language });
  if (checkDate) params.set('check_date', checkDate);
  if (orderNumber) params.set('order_number', orderNumber);
  const response = await fetch(apiUrl(`${checksPath}/export?${params}`), {
    credentials: 'include',
    signal: options.signal,
  });
  if (!response.ok) throw new Error(`Buffing API returned HTTP ${response.status}`);
  return response.blob();
}
