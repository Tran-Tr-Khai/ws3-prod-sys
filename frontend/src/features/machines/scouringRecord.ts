import type { HMIStatus } from '../../components/hmi/types';

export type ScouringRecordParameter = {
  name: string;
  actual: number;
  set: number;
  unit: string;
  validationStatus: HMIStatus;
  timestamp: string;
};

export type ScouringDigitalRecord = {
  machine: string;
  process: string;
  batch: string;
  recipe: string;
  operator: string;
  recordStatus: 'CONFIRMED';
  timestamp: string;
  parameters: ScouringRecordParameter[];
};

const storageKey = 'ws3.scouring.records';

export function readScouringRecords(): ScouringDigitalRecord[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const records = JSON.parse(raw) as Partial<ScouringDigitalRecord>[];
    return records.map((record) => ({ ...record, recordStatus: record.recordStatus ?? 'CONFIRMED' } as ScouringDigitalRecord));
  } catch {
    return [];
  }
}

export function appendScouringRecord(record: ScouringDigitalRecord): void {
  window.localStorage.setItem(storageKey, JSON.stringify([...readScouringRecords(), record]));
}
