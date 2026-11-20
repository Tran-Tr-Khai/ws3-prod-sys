import { useEffect, useState } from 'react';
import { tenterRealtimeUrl } from '../../config/runtime';

export type TenterReadingValues = Record<string, Record<string, number>>;

export type TenterMachineState = {
  machineId: string;
  timestamp: string | null;
  readingValues: TenterReadingValues;
  status: string;
};

export type TenterRealtimeSample = {
  time: number;
  values: Record<string, number | null>;
};

export type TenterRealtimeSnapshot = {
  connected: boolean;
  machine: TenterMachineState | null;
  history: TenterRealtimeSample[];
  error: string;
};

const emptySnapshot: TenterRealtimeSnapshot = {
  connected: false,
  machine: null,
  history: [],
  error: '',
};

const MOCK_QUERY_VALUE = 'tenter';

/** Return whether the operator explicitly enabled the local Tenter fixture. */
function isMockMode() {
  return new URLSearchParams(window.location.search).get('mock') === MOCK_QUERY_VALUE;
}

/** Generate one deterministic-looking sample of the Tenter signal groups. */
function mockReadingValues(tick: number): TenterReadingValues {
  const phase = tick / 5;
  const speed = 80 + Math.sin(phase) * 2.5;
  const counterA = 6897.2 + tick * 1.8;
  const counterB = Math.max(0, tick * 0.1);
  const counterTotal = 3933.9 + tick * 2.1;
  return {
    speed_and_width: {
      speed: Number(speed.toFixed(1)),
      'Counter A': Number(counterA.toFixed(1)),
      'Counter B': Number(counterB.toFixed(1)),
      'Counter Total': Number(counterTotal.toFixed(1)),
      width: Number((1820 + Math.sin(phase / 2) * 4).toFixed(1)),
    },
    chamber_temp_PV: {
      zone_1: Number((182 + Math.sin(phase) * 1.2).toFixed(1)),
      zone_2: Number((184 + Math.sin(phase + 0.7) * 1.1).toFixed(1)),
      zone_3: Number((181 + Math.sin(phase + 1.4) * 1.4).toFixed(1)),
      zone_4: Number((186 + Math.sin(phase + 2) * 1.1).toFixed(1)),
    },
    chamber_temp_SV: {
      zone_1: 182,
      zone_2: 184,
      zone_3: 181,
      zone_4: 186,
    },
  };
}

/** Build the initial 30-minute fixture used by the dashboard preview. */
function mockSnapshot(machineId: string, tick: number): TenterRealtimeSnapshot {
  const now = Date.now();
  const history = Array.from({ length: 30 }, (_, index) => {
    const sampleTick = tick - (29 - index);
    const readings = mockReadingValues(sampleTick);
    return {
      time: now - (29 - index) * 60 * 1000,
      values: {
        speed: readings.speed_and_width.speed,
        counterA: readings.speed_and_width['Counter A'],
        counterB: readings.speed_and_width['Counter B'],
        counterTotal: readings.speed_and_width['Counter Total'],
        width: readings.speed_and_width.width,
      },
    };
  });
  return {
    connected: true,
    machine: {
      machineId,
      timestamp: new Date(now).toISOString(),
      readingValues: mockReadingValues(tick),
      status: 'running',
    },
    history,
    error: '',
  };
}

/** Resolve the relay URL for a machine using the shared runtime configuration. */
function websocketUrl(machineId: string) {
  return tenterRealtimeUrl(machineId);
}

/** Normalize the machine identifiers emitted by different Tenter integrations. */
function machineAliases(machineId: string) {
  const normalized = machineId.trim().toUpperCase();
  const number = normalized.match(/^TE[-_ ]?(\d+)$/)?.[1];
  return new Set([normalized, number ? `TENTER ${Number(number)}` : '']);
}

/** Find and normalize one machine state from a relay state map. */
function pickMachine(
  states: Record<string, unknown>,
  machineId: string,
): TenterMachineState | null {
  const aliases = machineAliases(machineId);
  const entry = Object.entries(states).find(([key]) => aliases.has(key.trim().toUpperCase()));
  if (!entry) return null;
  const [id, raw] = entry;
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as { timestamp?: unknown; reading_values?: unknown; status?: unknown };
  const readings =
    value.reading_values && typeof value.reading_values === 'object'
      ? (value.reading_values as TenterReadingValues)
      : {};
  return {
    machineId: id,
    timestamp: typeof value.timestamp === 'string' ? value.timestamp : null,
    readingValues: readings,
    status: typeof value.status === 'string' ? value.status : 'disconnected',
  };
}

/** Read the first finite numeric value from a list of nested signal paths. */
function nestedNumber(readings: TenterReadingValues, paths: string[][]) {
  for (const path of paths) {
    const group = readings[path[0]];
    const value = group?.[path[1]];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
  }
  return null;
}

/** Convert a relay machine state into one point for the dashboard history chart. */
function toSample(machine: TenterMachineState): TenterRealtimeSample | null {
  const time = machine.timestamp ? Date.parse(machine.timestamp) : NaN;
  if (!Number.isFinite(time)) return null;
  const readings = machine.readingValues;
  return {
    time,
    values: {
      speed: nestedNumber(readings, [
        ['speed_and_width', 'speed'],
        ['speed_and_width', 'Tốc độ'],
      ]),
      counterA: nestedNumber(readings, [['speed_and_width', 'Counter A']]),
      counterB: nestedNumber(readings, [['speed_and_width', 'Counter B']]),
      counterTotal: nestedNumber(readings, [['speed_and_width', 'Counter Total']]),
      width: nestedNumber(readings, [
        ['speed_and_width', 'width'],
        ['speed_and_width', 'Width'],
      ]),
    },
  };
}

/** Extract the selected machine from either supported relay message envelope. */
function payloadMachine(payload: unknown, machineId: string) {
  if (!payload || typeof payload !== 'object') return null;
  const source = payload as { type?: unknown; payload?: unknown; tenter_states?: unknown };
  const nested = source.type === 'tenter_update' ? source.payload : payload;
  if (!nested || typeof nested !== 'object') return null;
  const states = (nested as { tenter_states?: unknown }).tenter_states;
  if (!states || typeof states !== 'object') return null;
  return pickMachine(states as Record<string, unknown>, machineId);
}

/**
 * Subscribe to one Tenter machine relay and retain a bounded 30-minute signal history.
 *
 * The `?mock=tenter` fixture is deliberately opt-in for dashboard review; it never
 * replaces live data during normal machine operation.
 */
export function useTenterRealtime(machineId: string, enabled: boolean): TenterRealtimeSnapshot {
  const [snapshot, setSnapshot] = useState<TenterRealtimeSnapshot>(emptySnapshot);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(emptySnapshot);
      return undefined;
    }

    // Temporary visual fixture. It is opt-in via ?mock=tenter and never runs in the normal flow.
    if (isMockMode()) {
      let tick = 0;
      setSnapshot(mockSnapshot(machineId, tick));
      const timer = window.setInterval(() => {
        tick += 1;
        setSnapshot(mockSnapshot(machineId, tick));
      }, 1200);
      return () => window.clearInterval(timer);
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: number | null = null;
    let disposed = false;
    let reconnectDelay = 1000;

    const connect = () => {
      if (disposed) return;
      try {
        socket = new WebSocket(websocketUrl(machineId));
      } catch (reason) {
        setSnapshot((current) => ({
          ...current,
          connected: false,
          error: reason instanceof Error ? reason.message : 'Unable to connect to Tenter data.',
        }));
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        return;
      }

      socket.addEventListener('open', () => {
        reconnectDelay = 1000;
        setSnapshot((current) => ({ ...current, connected: true, error: '' }));
      });
      socket.addEventListener('message', (event) => {
        try {
          const machine = payloadMachine(JSON.parse(event.data as string), machineId);
          if (!machine) return;
          const sample = toSample(machine);
          setSnapshot((current) => {
            const history = sample
              ? [...current.history, sample]
                  .reduce<TenterRealtimeSample[]>((items, item) => {
                    const withoutDuplicate = items.filter(
                      (existing) => existing.time !== item.time,
                    );
                    withoutDuplicate.push(item);
                    return withoutDuplicate;
                  }, [])
                  .filter(
                    (item) =>
                      item.time >= Date.now() - 30 * 60 * 1000 &&
                      item.time <= Date.now() + 60 * 1000,
                  )
                  .sort((left, right) => left.time - right.time)
                  .slice(-120)
              : current.history;
            return { connected: true, machine, history, error: '' };
          });
        } catch {
          setSnapshot((current) => ({ ...current, error: 'Dữ liệu realtime không hợp lệ.' }));
        }
      });
      socket.addEventListener('error', () => {
        setSnapshot((current) => ({
          ...current,
          connected: false,
          error: 'Không kết nối được dữ liệu máy.',
        }));
      });
      socket.addEventListener('close', () => {
        if (disposed) return;
        setSnapshot((current) => ({ ...current, connected: false }));
        reconnectTimer = window.setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 10000);
      });
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer !== null) window.clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [enabled, machineId]);

  return snapshot;
}

/** Return the first finite realtime value found in a list of group/key aliases. */
export function readTenterValue(readings: TenterReadingValues, paths: string[][]) {
  return nestedNumber(readings, paths);
}

/** Return the first available realtime signal group from compatible relay aliases. */
export function readTenterGroup(readings: TenterReadingValues, keys: string[]) {
  for (const key of keys) {
    const group = readings[key];
    if (group && typeof group === 'object') return group;
  }
  return {};
}
