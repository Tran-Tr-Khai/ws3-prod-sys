import type { HMIStatus } from '../../components/hmi/types';

export type ScouringEventType = 'PARAMETER_WARNING' | 'PARAMETER_ALARM' | 'ALARM_ACKNOWLEDGED' | 'DIGITAL_RECORD_SAVED' | 'INVALID_INPUT_ATTEMPT' | 'MACHINE_START' | 'MACHINE_STOP';
export type EventStatus = 'ACTIVE' | 'ACKNOWLEDGED' | 'HISTORICAL';
export type AcknowledgementStatus = 'UNACKNOWLEDGED' | 'ACKNOWLEDGED' | 'NOT_APPLICABLE';

export type ScouringEvent = {
  eventId: string;
  timestamp: string;
  machine: string;
  process: string;
  batch: string;
  operator: string;
  eventType: ScouringEventType;
  parameterName?: string;
  actualValue?: number;
  setValue?: number;
  unit?: string;
  limitRange?: string;
  validationStatus: HMIStatus;
  eventStatus: EventStatus;
  acknowledgementStatus: AcknowledgementStatus;
};

const storageKey = 'ws3.scouring.events';

export function readScouringEvents(): ScouringEvent[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) as ScouringEvent[] : [];
  } catch {
    return [];
  }
}

export function appendScouringEvent(event: Omit<ScouringEvent, 'eventId'>): ScouringEvent {
  const savedEvent: ScouringEvent = { ...event, eventId: `SC-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}` };
  window.localStorage.setItem(storageKey, JSON.stringify([...readScouringEvents(), savedEvent]));
  return savedEvent;
}

export function acknowledgeScouringAlarms(eventIds: string[]): void {
  const ids = new Set(eventIds);
  const events = readScouringEvents().map((event) => ids.has(event.eventId) ? { ...event, eventStatus: 'ACKNOWLEDGED' as const, acknowledgementStatus: 'ACKNOWLEDGED' as const } : event);
  window.localStorage.setItem(storageKey, JSON.stringify(events));
}
