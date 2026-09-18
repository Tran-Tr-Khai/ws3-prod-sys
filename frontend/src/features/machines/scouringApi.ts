export type ScouringRecord = {
  id: number;
  machineId: string;
  recordedAt: string;
  createdAt: string;
  batchIdentifier: string | null;
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
};

export type ScouringRecordCreatePayload = {
  machineId: string;
  recordedAt?: string;
  batchIdentifier?: string | null;
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
};

export type ScouringRecordApiResponse = {
  id: number;
  machine_id: string;
  recorded_at: string;
  created_at: string;
  batch_identifier: string | null;
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
};

type ScouringRecordApiRequest = {
  machine_id: string;
  recorded_at?: string;
  batch_identifier?: string | null;
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

function toApiRequest(payload: ScouringRecordCreatePayload): ScouringRecordApiRequest {
  return {
    machine_id: payload.machineId,
    ...(payload.recordedAt === undefined ? {} : { recorded_at: payload.recordedAt }),
    ...(payload.batchIdentifier === undefined ? {} : { batch_identifier: payload.batchIdentifier }),
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
  };
}

function fromApiResponse(record: ScouringRecordApiResponse): ScouringRecord {
  return {
    id: record.id,
    machineId: record.machine_id,
    recordedAt: record.recorded_at,
    createdAt: record.created_at,
    batchIdentifier: record.batch_identifier,
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
  };
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
