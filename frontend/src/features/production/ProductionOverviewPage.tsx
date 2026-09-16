import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FunctionKeyBar,
  HMIButton,
  HMIHeader,
  StatusLamp,
} from '../../components/hmi';
import { fetchMachines, type MachineSnapshot } from '../machines/machineApi';
import { formatStatus, toHMIStatus } from '../machines/machineStatus';
import { formatProduction, summarizeProduction, type ProductionSummary } from './productionOverview';

const initialSummary: ProductionSummary = {
  totalMachines: 0,
  running: 0,
  stopped: 0,
  maintenance: 0,
  alarm: 0,
  productionToday: 0,
};

const summaryCards: Array<{ key: keyof ProductionSummary; label: string; tone: string; unit?: string }> = [
  { key: 'totalMachines', label: 'Total machines', tone: 'border-industrial text-industrial' },
  { key: 'running', label: 'Running', tone: 'border-success text-success' },
  { key: 'stopped', label: 'Stopped', tone: 'border-slate-400 text-slate-600' },
  { key: 'maintenance', label: 'Maintenance', tone: 'border-warning text-amber-700' },
  { key: 'alarm', label: 'Alarm', tone: 'border-alarm text-alarm' },
  { key: 'productionToday', label: 'Production today', tone: 'border-info text-info', unit: 'kg' },
];

function formatTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', { timeStyle: 'short' }).format(new Date(value));
}

export function ProductionOverviewPage() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<MachineSnapshot[]>([]);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const nextMachines = await fetchMachines(signal);
      setMachines(nextMachines);
      setSummary(summarizeProduction(nextMachines));
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(navigator.onLine ? 'Không thể tải dữ liệu sản xuất.' : 'Backend đang offline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadOverview(controller.signal);
    const timer = window.setInterval(() => void loadOverview(), 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadOverview]);

  const lastUpdated = useMemo(
    () => machines.reduce<string | null>((latest, machine) => (
      latest && latest > machine.updatedAt ? latest : machine.updatedAt
    ), null),
    [machines],
  );

  return (
    <main className="min-h-screen bg-navy text-slate-800">
      <HMIHeader title="WS3 / Production Overview" subtitle="Production monitoring · Mock simulator" time={new Date().toLocaleTimeString('vi-VN')} />

      <div className="mx-auto max-w-[1280px] space-y-3 p-3">
        <section className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {summaryCards.map((card) => (
            <div key={card.key} className={`border border-line border-l-4 bg-panel px-3 py-2 ${card.tone}`}>
              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{card.label}</div>
              <div className="mt-1 font-mono text-2xl font-bold tabular-nums">
                {card.key === 'productionToday' ? formatProduction(summary[card.key]) : summary[card.key]}
                {card.unit && <span className="ml-1 text-xs font-semibold text-slate-500">{card.unit}</span>}
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-none border-2 border-line bg-panel">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-line bg-surfaceMuted px-3 py-1.5">
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Machine overview</h2>
              <p className="text-[11px] text-slate-500">Compact live status list</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {lastUpdated && <span>Updated {formatTime(lastUpdated)}</span>}
              <HMIButton size="compact" variant="secondary" onClick={() => navigate('/machines')}>Open full list</HMIButton>
            </div>
          </header>

          {loading && <div className="p-8 text-center text-sm text-slate-500">Loading production data…</div>}
          {!loading && error && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-6">
              <span className="font-semibold text-alarm">{error}</span>
              <HMIButton variant="primary" onClick={() => void loadOverview()}>Retry</HMIButton>
            </div>
          )}
          {!loading && !error && machines.length === 0 && <div className="p-8 text-center text-sm text-slate-500">No machine data.</div>}
          {!loading && !error && machines.length > 0 && (
            <div className="grid divide-y divide-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
              {machines.map((machine) => (
                <button
                  key={machine.machineId}
                  type="button"
                  className="grid grid-cols-[1fr_auto] gap-3 px-3 py-2 text-left hover:bg-surfaceMuted"
                  onClick={() => navigate(`/machine/${machine.machineId}`)}
                >
                  <span>
                    <span className="block font-mono text-sm font-bold text-industrial">{machine.machineId}</span>
                    <span className="mt-1 block text-xs text-slate-500">{machine.process} · {machine.batch}</span>
                  </span>
                  <span className="text-right">
                    <StatusLamp status={toHMIStatus(machine.status)} label={formatStatus(machine.status)} />
                    <span className="mt-1 block font-mono text-xs text-slate-600">{machine.temperature.toFixed(1)} °C · {machine.speed.toFixed(1)} m/min</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      <FunctionKeyBar keys={[{ key: 'F1', label: 'Machines' }, { key: 'F2', label: 'Production' }, { key: 'F4', label: 'Refresh' }]} />
    </main>
  );
}
