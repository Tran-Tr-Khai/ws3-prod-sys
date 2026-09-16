import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FunctionKeyBar,
  HMIButton,
  HMIHeader,
  StatusLamp,
} from '../../components/hmi';
import { fetchMachines, type MachineSnapshot, type MachineStatus } from './machineApi';
import { formatStatus, machineStatusOptions, toHMIStatus } from './machineStatus';

function formatStartTime(value: string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function selectClassName(): string {
  return 'min-h-10 border border-line bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-industrial focus:ring-2 focus:ring-blue-100';
}

type MachineFilters = {
  process: string;
  status: MachineStatus | '';
  machineId: string;
};

export function MachineListPage() {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<MachineSnapshot[]>([]);
  const [filters, setFilters] = useState<MachineFilters>({ process: '', status: '', machineId: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMachines = useCallback(async (signal?: AbortSignal) => {
    try {
      setError(null);
      const nextMachines = await fetchMachines(signal);
      setMachines(nextMachines);
    } catch (requestError) {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(navigator.onLine ? 'Không thể tải dữ liệu máy từ backend.' : 'Backend đang offline.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void loadMachines(controller.signal);
    const timer = window.setInterval(() => void loadMachines(), 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [loadMachines]);

  const processOptions = useMemo(
    () => [...new Set(machines.map((machine) => machine.process))].sort(),
    [machines],
  );

  const filteredMachines = useMemo(
    () => machines.filter((machine) => (
      (!filters.process || machine.process === filters.process)
      && (!filters.status || machine.status === filters.status)
      && (!filters.machineId || machine.machineId === filters.machineId)
    )),
    [filters, machines],
  );

  const clearFilters = () => setFilters({ process: '', status: '', machineId: '' });

  return (
    <main className="min-h-screen bg-navy text-slate-800">
      <HMIHeader
        title="WS3 / Machines"
        subtitle="Machine list · Mock simulator polling"
        time={new Date().toLocaleTimeString('vi-VN')}
      />

      <div className="mx-auto max-w-[1280px] space-y-3 p-3">
        <section className="border border-line bg-white">
          <div className="flex flex-wrap items-end gap-3 border-b border-line bg-surfaceMuted p-3">
            <label className="grid min-w-40 gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
              Process
              <select
                className={selectClassName()}
                value={filters.process}
                onChange={(event) => setFilters((current) => ({ ...current, process: event.target.value }))}
              >
                <option value="">All processes</option>
                {processOptions.map((process) => <option key={process} value={process}>{process}</option>)}
              </select>
            </label>

            <label className="grid min-w-40 gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
              Status
              <select
                className={selectClassName()}
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as MachineStatus | '' }))}
              >
                <option value="">All statuses</option>
                {machineStatusOptions.map((status) => <option key={status} value={status}>{formatStatus(status)}</option>)}
              </select>
            </label>

            <label className="grid min-w-40 gap-1 text-xs font-bold uppercase tracking-wide text-slate-600">
              Machine
              <select
                className={selectClassName()}
                value={filters.machineId}
                onChange={(event) => setFilters((current) => ({ ...current, machineId: event.target.value }))}
              >
                <option value="">All machines</option>
                {machines.map((machine) => <option key={machine.machineId} value={machine.machineId}>{machine.machineId}</option>)}
              </select>
            </label>

            <HMIButton variant="secondary" size="normal" onClick={clearFilters}>Clear filters</HMIButton>
            <div className="ml-auto text-xs font-semibold text-slate-500">
              Showing {filteredMachines.length} / {machines.length}
            </div>
          </div>

          {loading && <div className="p-8 text-center text-sm text-slate-500">Loading machine data…</div>}

          {!loading && error && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-6">
              <div>
                <div className="font-bold text-alarm">{error}</div>
                <div className="mt-1 text-sm text-slate-500">Kiểm tra backend và thử lại.</div>
              </div>
              <HMIButton variant="primary" onClick={() => void loadMachines()}>Retry</HMIButton>
            </div>
          )}

          {!loading && !error && filteredMachines.length === 0 && (
            <div className="p-8 text-center text-sm text-slate-500">Không có máy phù hợp với bộ lọc.</div>
          )}

          {!loading && !error && filteredMachines.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead className="bg-industrial text-xs uppercase tracking-wide text-white">
                  <tr>
                    <th className="px-3 py-3">Machine</th>
                    <th className="px-3 py-3">Process</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Batch</th>
                    <th className="px-3 py-3 text-right">Speed</th>
                    <th className="px-3 py-3 text-right">Temperature</th>
                    <th className="px-3 py-3">Operator</th>
                    <th className="px-3 py-3">Start time</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMachines.map((machine) => (
                    <tr
                      key={machine.machineId}
                      className="cursor-pointer border-b border-slate-100 hover:bg-blue-50 focus-within:bg-blue-50"
                      tabIndex={0}
                      onClick={() => navigate(`/machine/${machine.machineId}`)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') navigate(`/machine/${machine.machineId}`);
                      }}
                    >
                      <td className="px-3 py-3 font-mono font-bold text-industrial">{machine.machineId}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-700">{machine.process}</td>
                      <td className="px-3 py-3"><StatusLamp status={toHMIStatus(machine.status)} label={formatStatus(machine.status)} /></td>
                      <td className="px-3 py-3 font-mono text-xs text-slate-600">{machine.batch ?? '—'}</td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">{machine.speed.toFixed(1)} <span className="text-xs font-normal text-slate-500">m/min</span></td>
                      <td className="px-3 py-3 text-right font-mono font-bold tabular-nums">{machine.temperature.toFixed(1)} <span className="text-xs font-normal text-slate-500">°C</span></td>
                      <td className="px-3 py-3 text-sm text-slate-700">{machine.operator ?? '—'}</td>
                      <td className="px-3 py-3 whitespace-nowrap text-xs text-slate-600">{formatStartTime(machine.startTime)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <FunctionKeyBar keys={[{ key: 'F1', label: 'Refresh' }, { key: 'F2', label: 'Filters' }, { key: 'F4', label: 'Back' }]} />
    </main>
  );
}
