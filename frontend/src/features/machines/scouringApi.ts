export type ScouringRecord = {
  id: number;
  machineId: string;
  recordedAt: string;
  createdAt: string;
  batchIdentifier: string | null;
  orderNumber: string | null;
  item: string | null;
  lotYarn: string | null;
  lotNumber: string | null;
  operatorName: string | null;
  operatorIdentifier: string | null;
  naoh: number;
  soap: number;
  desizer: number;
  h2o2: number;
  chelate: number;
  speed: number;
  temperature: number;
  cylinderTemperature: number;
  inputFabricMeters: number | null;
  outputFabricMeters: number | null;
  productionQuantityMeters: number | null;
};

export type ScouringRecordCreatePayload = {
  machineId: string;
  recordedAt?: string;
  batchIdentifier?: string | null;
  orderNumber?: string | null;
  item?: string | null;
  lotYarn?: string | null;
  lotNumber?: string | null;
  operatorName?: string | null;
  operatorIdentifier?: string | null;
  naoh: number;
  soap: number;
  desizer: number;
  h2o2: number;
  chelate: number;
  speed: number;
  temperature: number;
  cylinderTemperature: number;
  inputFabricMeters?: number | null;
  outputFabricMeters?: number | null;
  productionQuantityMeters?: number | null;
};

export type ScouringRecordApiResponse = {
  id: number;
  machine_id: string;
  recorded_at: string;
  created_at: string;
  batch_identifier: string | null;
  order_number: string | null;
  item: string | null;
  lot_yarn: string | null;
  lot_number: string | null;
  operator_name: string | null;
  operator_identifier: string | null;
  naoh: number;
  soap: number;
  desizer: number;
  h2o2: number;
  chelate: number;
  speed: number;
  temperature: number;
  cylinder_temperature: number;
  input_fabric_meters: number | null;
  output_fabric_meters: number | null;
  production_quantity_meters: number | null;
};

export type ScouringPhInspection = {
  id: number;
  scouringRecordId: number;
  inspectedAt: string;
  operatorName: string | null;
  tankPh: Array<number | null>;
  note: string | null;
  createdAt: string;
};

export type ScouringPhInspectionCreatePayload = {
  scouringRecordId: number;
  inspectedAt?: string;
  operatorName?: string | null;
  tankPh: Array<number | null>;
  note?: string | null;
};

export type BuffingCheck = {
  id: number;
  machineId: string;
  checkDate: string;
  checkedAt: string;
  operatorName: string | null;
  checks: boolean[];
  remark: string | null;
  createdAt: string;
  images: BuffingImage[];
};

export type BuffingImage = {
  id: number;
  originalName: string;
  mimeType: string;
  fileSize: number;
  sortOrder: number;
  isPrimary: boolean;
  url: string;
};

export type BuffingCheckCreatePayload = {
  machineId?: string;
  checkDate: string;
  checkedAt?: string;
  operatorName: string;
  checks: boolean[];
  remark?: string | null;
};

type ScouringPhInspectionApiResponse = {
  id: number;
  scouring_record_id: number;
  inspected_at: string;
  operator_name: string | null;
  tank_0_ph: number | null;
  tank_1_ph: number | null;
  tank_2_ph: number | null;
  tank_3_ph: number | null;
  tank_4_ph: number | null;
  tank_5_ph: number | null;
  tank_6_ph: number | null;
  tank_7_ph: number | null;
  note: string | null;
  created_at: string;
};

type ScouringRecordApiRequest = {
  machine_id: string;
  recorded_at?: string;
  batch_identifier?: string | null;
  order_number?: string | null;
  item?: string | null;
  lot_yarn?: string | null;
  lot_number?: string | null;
  operator_name?: string | null;
  operator_identifier?: string | null;
  naoh: number;
  soap: number;
  desizer: number;
  h2o2: number;
  chelate: number;
  speed: number;
  temperature: number;
  cylinder_temperature: number;
  input_fabric_meters?: number | null;
  output_fabric_meters?: number | null;
  production_quantity_meters?: number | null;
};

export type ScouringApiErrorDetails = unknown;

export class ScouringApiError extends Error {
  readonly status: number | null;
  readonly code: string;
  readonly details: ScouringApiErrorDetails;

  constructor(
    message: string,
    options: { status?: number | null; code?: string; details?: ScouringApiErrorDetails } = {},
  ) {
    super(message);
    this.name = 'ScouringApiError';
    this.status = options.status ?? null;
    this.code = options.code ?? 'scouring_api_error';
    this.details = options.details;
  }
}

type ApiErrorBody = {
  error?: string;
  message?: string;
  details?: ScouringApiErrorDetails;
  detail?: unknown;
};

type RequestOptions = {
  signal?: AbortSignal;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000').replace(/\/$/, '');
const scouringRecordsPath = `${apiBaseUrl}/api/scouring/records`;
const scouringInspectionsPath = `${apiBaseUrl}/api/scouring/inspections`;
const buffingChecksPath = `${apiBaseUrl}/api/buffing/checks`;
const toApiUrl = (path: string) => path.startsWith('http') ? path : apiBaseUrl === '/' ? path : `${apiBaseUrl}${path.startsWith('/') ? '' : '/'}${path}`;

function toApiRequest(payload: ScouringRecordCreatePayload): ScouringRecordApiRequest {
  return {
    machine_id: payload.machineId,
    ...(payload.recordedAt === undefined ? {} : { recorded_at: payload.recordedAt }),
    ...(payload.batchIdentifier === undefined ? {} : { batch_identifier: payload.batchIdentifier }),
    ...(payload.orderNumber === undefined ? {} : { order_number: payload.orderNumber }),
    ...(payload.item === undefined ? {} : { item: payload.item }),
    ...(payload.lotYarn === undefined ? {} : { lot_yarn: payload.lotYarn }),
    ...(payload.lotNumber === undefined ? {} : { lot_number: payload.lotNumber }),
    ...(payload.operatorName === undefined ? {} : { operator_name: payload.operatorName }),
    ...(payload.operatorIdentifier === undefined ? {} : { operator_identifier: payload.operatorIdentifier }),
    naoh: payload.naoh,
    soap: payload.soap,
    desizer: payload.desizer,
    h2o2: payload.h2o2,
    chelate: payload.chelate,
    speed: payload.speed,
    temperature: payload.temperature,
    cylinder_temperature: payload.cylinderTemperature,
    ...(payload.inputFabricMeters === undefined ? {} : { input_fabric_meters: payload.inputFabricMeters }),
    ...(payload.outputFabricMeters === undefined ? {} : { output_fabric_meters: payload.outputFabricMeters }),
    ...(payload.productionQuantityMeters === undefined ? {} : { production_quantity_meters: payload.productionQuantityMeters }),
  };
}

function fromApiResponse(record: ScouringRecordApiResponse): ScouringRecord {
  return {
    id: record.id,
    machineId: record.machine_id,
    recordedAt: record.recorded_at,
    createdAt: record.created_at,
    batchIdentifier: record.batch_identifier,
    orderNumber: record.order_number,
    item: record.item,
    lotYarn: record.lot_yarn,
    lotNumber: record.lot_number,
    operatorName: record.operator_name,
    operatorIdentifier: record.operator_identifier,
    naoh: record.naoh,
    soap: record.soap,
    desizer: record.desizer,
    h2o2: record.h2o2,
    chelate: record.chelate,
    speed: record.speed,
    temperature: record.temperature,
    cylinderTemperature: record.cylinder_temperature,
    inputFabricMeters: record.input_fabric_meters,
    outputFabricMeters: record.output_fabric_meters,
    productionQuantityMeters: record.production_quantity_meters,
  };
}

function fromInspectionApiResponse(record: ScouringPhInspectionApiResponse): ScouringPhInspection {
  return { id: record.id, scouringRecordId: record.scouring_record_id, inspectedAt: record.inspected_at, operatorName: record.operator_name, tankPh: [record.tank_0_ph, record.tank_1_ph, record.tank_2_ph, record.tank_3_ph, record.tank_4_ph, record.tank_5_ph, record.tank_6_ph, record.tank_7_ph], note: record.note, createdAt: record.created_at };
}

function toInspectionApiRequest(payload: ScouringPhInspectionCreatePayload) {
  return { scouring_record_id: payload.scouringRecordId, ...(payload.inspectedAt === undefined ? {} : { inspected_at: payload.inspectedAt }), ...(payload.operatorName === undefined ? {} : { operator_name: payload.operatorName }), ...Object.fromEntries(payload.tankPh.map((value, index) => [`tank_${index}_ph`, value])), ...(payload.note === undefined ? {} : { note: payload.note }) };
}

type BuffingApiResponse = { id: number; machine_id: string; check_date: string; checked_at: string; operator_name: string | null; check_1: boolean; check_2: boolean; check_3: boolean; check_4: boolean; check_5: boolean; remark: string | null; created_at: string; images?: Array<{ id: number; original_name: string; mime_type: string; file_size: number; sort_order: number; is_primary: boolean; url: string }> };

function fromBuffingApiResponse(check: BuffingApiResponse): BuffingCheck {
  return { id: check.id, machineId: check.machine_id, checkDate: check.check_date, checkedAt: check.checked_at, operatorName: check.operator_name, checks: [check.check_1, check.check_2, check.check_3, check.check_4, check.check_5], remark: check.remark, createdAt: check.created_at, images: (check.images ?? []).map((image) => ({ id: image.id, originalName: image.original_name, mimeType: image.mime_type, fileSize: image.file_size, sortOrder: image.sort_order, isPrimary: image.is_primary, url: toApiUrl(image.url) })) };
}

function toBuffingApiRequest(payload: BuffingCheckCreatePayload) {
  return { machine_id: payload.machineId ?? 'BU-01', check_date: payload.checkDate, checked_at: payload.checkedAt, operator_name: payload.operatorName, check_1: payload.checks[0] ?? false, check_2: payload.checks[1] ?? false, check_3: payload.checks[2] ?? false, check_4: payload.checks[3] ?? false, check_5: payload.checks[4] ?? false, remark: payload.remark ?? null };
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return await response.json() as ApiErrorBody;
  } catch {
    return {};
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ScouringApiError('Unable to reach the Scouring backend.', { code: 'network_error' });
  }

  if (!response.ok) {
    const body = await readErrorBody(response);
    const detailMessage = typeof body.detail === 'string'
      ? body.detail
      : Array.isArray(body.detail)
        ? body.detail.map((item) => typeof item === 'object' && item !== null && 'msg' in item ? String(item.msg) : String(item)).join('; ')
        : undefined;
    throw new ScouringApiError(
      body.message || detailMessage || `Scouring API returned HTTP ${response.status}`,
      { status: response.status, code: body.error || 'scouring_api_error', details: body.details },
    );
  }

  return await response.json() as T;
}

export async function getScouringRecords(options: RequestOptions = {}): Promise<ScouringRecord[]> {
  const response = await request<ScouringRecordApiResponse[]>(scouringRecordsPath, { signal: options.signal });
  return response.map(fromApiResponse);
}

export async function getLatestScouringRecord(options: RequestOptions = {}): Promise<ScouringRecord> {
  const response = await request<ScouringRecordApiResponse>(`${scouringRecordsPath}/latest`, { signal: options.signal });
  return fromApiResponse(response);
}

export async function getScouringRecord(id: number, options: RequestOptions = {}): Promise<ScouringRecord> {
  const response = await request<ScouringRecordApiResponse>(`${scouringRecordsPath}/${encodeURIComponent(id)}`, { signal: options.signal });
  return fromApiResponse(response);
}

export async function createScouringRecord(
  payload: ScouringRecordCreatePayload,
  options: RequestOptions = {},
): Promise<ScouringRecord> {
  const response = await request<ScouringRecordApiResponse>(scouringRecordsPath, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApiRequest(payload)),
    signal: options.signal,
  });
  return fromApiResponse(response);
}

export async function getScouringPhInspections(recordId?: number, options: RequestOptions = {}): Promise<ScouringPhInspection[]> {
  const url = recordId === undefined ? scouringInspectionsPath : `${scouringInspectionsPath}?scouring_record_id=${encodeURIComponent(recordId)}`;
  const response = await request<ScouringPhInspectionApiResponse[]>(url, { signal: options.signal });
  return response.map(fromInspectionApiResponse);
}

export async function createScouringPhInspection(payload: ScouringPhInspectionCreatePayload, options: RequestOptions = {}): Promise<ScouringPhInspection> {
  const response = await request<ScouringPhInspectionApiResponse>(scouringInspectionsPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toInspectionApiRequest(payload)), signal: options.signal });
  return fromInspectionApiResponse(response);
}

export async function getBuffingChecks(checkDate?: string, options: RequestOptions = {}): Promise<BuffingCheck[]> {
  const query = checkDate ? `?check_date=${encodeURIComponent(checkDate)}` : '';
  const response = await request<BuffingApiResponse[]>(`${buffingChecksPath}${query}`, { signal: options.signal });
  return response.map(fromBuffingApiResponse);
}

export async function createBuffingCheck(payload: BuffingCheckCreatePayload, options: RequestOptions = {}): Promise<BuffingCheck> {
  const response = await request<BuffingApiResponse>(buffingChecksPath, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(toBuffingApiRequest(payload)), signal: options.signal });
  return fromBuffingApiResponse(response);
}

export async function uploadBuffingImages(checkId: number, files: File[], options: RequestOptions = {}): Promise<BuffingImage[]> {
  const body = new FormData();
  files.forEach((file) => body.append('files', file));
  const response = await request<Array<{ id: number; original_name: string; mime_type: string; file_size: number; sort_order: number; is_primary: boolean; url: string }>>(`${buffingChecksPath}/${checkId}/images`, { method: 'POST', body, signal: options.signal });
  return response.map((image) => ({ id: image.id, originalName: image.original_name, mimeType: image.mime_type, fileSize: image.file_size, sortOrder: image.sort_order, isPrimary: image.is_primary, url: toApiUrl(image.url) }));
}
