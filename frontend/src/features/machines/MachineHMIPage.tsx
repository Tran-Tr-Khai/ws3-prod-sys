import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlarmIndicator,
  FunctionKeyBar,
  HMIButton,
  HMIHeader,
  ParameterCard,
  ProcessPanel,
  StatusLamp,
  TrendChart,
  ValueDisplay,
} from '../../components/hmi';
import type { TrendPoint } from '../../components/hmi';
import { fetchMachine, type MachineSnapshot } from './machineApi';
import { formatStatus, toMachineHMIState, type MachineHMIState } from './machineStatus';

function hmiStateStatus(state: MachineHMIState) {
  if (state === 'RUNNING') return 'running' as const;
  if (state === 'ALARM') return 'alarm' as const;
  return 'stopped' as const;
}

function sampleLabel(value: string): string {
  return new Date(value).toLocaleTimeString('vi-VN', { timeStyle: 'short' });
}

export function MachineHMIPage() {
  const { machineId = '' } = useParams<{ machineId: string }>();
  const [machine, setMachine] = useState<MachineSnapshot | null>(null);
  const [temperatureTrend, setTemperatureTrend] = useState<TrendPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMachine = useCallback(async (signal?: AbortSignal) => {
    try {
      const snapshot = await fetchMachine(machineId, signal);
      setMachine(snapshot);
      setTemperatureTrend((current) => [
        ...current,
        { label: sampleLabel(snapshot.updatedAt), value: snapshot.temperature },
      ].slice(-24));
      setError(null);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(requestError instanceof Error ? requestError.message : 'Unable to load machine.');
    } finally {
      setLoading(false);
    }
  }, [machineId]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void loadMachine(controller.signal);
    const timer = window.setInterval(() => void loadMachine(), 2000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadMachine]);

  const state = machine ? toMachineHMIState(machine.status) : 'STOPPED';

  if (loading && !machine) {
    return <main className="min-h-screen bg-navy p-6 text-sm text-slate-500">Loading machine HMI…</main>;
  }

  if (error && !machine) {
    return (
      <main className="min-h-screen bg-navy p-6">
        <div className="border-2 border-alarm bg-panel p-6">
          <h1 className="font-bold text-alarm">Machine unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <HMIButton className="mt-5" variant="primary" onClick={() => void loadMachine()}>Retry</HMIButton>
        </div>
      </main>
    );
  }

  if (!machine) return null;

  return (
    <main className="min-h-screen bg-navy text-slate-800">
      <HMIHeader
        title="WS3 / Machine HMI"
        subtitle={`Machine ID ${machine.machineId} · Process ${machine.process} · Batch ${machine.batch ?? '—'} · Operator ${machine.operator ?? '—'}`}
        machineName={machine.machineId}
        status={hmiStateStatus(state)}
        time={new Date().toLocaleTimeString('vi-VN')}
      />

      <div className="mx-auto grid max-w-[1280px] gap-3 p-3 xl:grid-cols-[1fr_1.5fr_1fr]">
        <ProcessPanel title="Machine / process status" status={hmiStateStatus(state)} statusLabel={state}>
          <div className="flex min-h-36 flex-col items-center justify-center border border-line bg-surfaceMuted">
            <StatusLamp status={hmiStateStatus(state)} label={state} />
            <div className="mt-4 font-mono text-3xl font-bold tracking-widest text-industrial">{state}</div>
            <div className="mt-2 text-xs text-slate-500">{machine.process} · {machine.machineId}</div>
          </div>
        </ProcessPanel>

        <ProcessPanel title="Realtime parameters" status="normal" statusLabel="Live polling">
          <div className="grid grid-cols-2 gap-2">
            <ValueDisplay label="Speed" value={machine.speed.toFixed(1)} unit="m/min" emphasis="primary" />
            <ValueDisplay label="Temperature" value={machine.temperature.toFixed(1)} unit="°C" emphasis={machine.status === 'WARNING' ? 'warning' : 'normal'} />
            <ValueDisplay label="Production today" value={machine.productionToday.toFixed(1)} unit="kg" />
            <ValueDisplay label="Last update" value={sampleLabel(machine.updatedAt)} emphasis="primary" />
          </div>
        </ProcessPanel>

        <div className="grid gap-3">
          <ParameterCard title="Batch" code="BATCH">
            <div className="space-y-2 p-3">
              <div className="text-xs font-semibold uppercase text-slate-500">Current batch</div>
              <div className="font-mono text-lg font-bold text-industrial">{machine.batch ?? '—'}</div>
              <div className="text-xs text-slate-500">Operator: {machine.operator ?? '—'}</div>
            </div>
          </ParameterCard>
          <ParameterCard title="Alarm" code="ALM">
            <div className="flex items-center justify-between p-3">
              <AlarmIndicator count={machine.status === 'ALARM' || machine.status === 'WARNING' ? 1 : 0} status={machine.status === 'ALARM' ? 'alarm' : machine.status === 'WARNING' ? 'warning' : 'normal'} />
              <span className="text-xs text-slate-500">{formatStatus(machine.status)}</span>
            </div>
          </ParameterCard>
        </div>

        <div className="xl:col-span-3">
          <TrendChart series={temperatureTrend} label="Temperature" unit="°C" />
        </div>
      </div>

      <FunctionKeyBar keys={[
        { key: 'F1', label: 'Overview' },
        { key: 'F2', label: 'Parameters' },
        { key: 'F3', label: 'Batch' },
        { key: 'F4', label: 'History' },
        { key: 'F5', label: 'Alarm' },
        { key: 'F6', label: 'Menu' },
      ]} />
    </main>
  );
}
