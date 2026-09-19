import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getScouringRecords, type ScouringRecord } from '../machines/scouringApi';

const processes = [
  { name: 'Scouring', code: 'SC-01', available: true },
  { name: 'Tenter', code: 'TE-01', available: false },
  { name: 'Dyeing', code: 'DY-01', available: false },
  { name: 'Suction', code: 'SU-01', available: false },
  { name: 'Calendar', code: 'CA-01', available: false },
  { name: 'Rapid', code: 'RA-01', available: false },
] as const;

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function recordWarnings(record: ScouringRecord): string[] {
  const warnings: string[] = [];
  if (record.speed < 40 || record.speed > 50) warnings.push('Speed outside expected 40–50 m/min');
  if (record.temperature < 90 || record.temperature > 98) warnings.push('Temperature outside expected 90–98 °C');
  return warnings;
}

function hasCompleteProcessData(record: ScouringRecord): boolean {
  return [record.naoh, record.soap, record.desizer, record.h2o2, record.chelate, record.speed, record.temperature, record.cylinderTemperature]
    .every((value) => Number.isFinite(value));
}

export function WS3OverviewPage() {
  const [latestRecord, setLatestRecord] = useState<ScouringRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getScouringRecords({ signal: controller.signal })
      .then((records) => setLatestRecord(records[0] ?? null))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to reach the Scouring backend.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const warnings = latestRecord ? recordWarnings(latestRecord) : [];
  const recordComplete = latestRecord ? hasCompleteProcessData(latestRecord) : false;

  return (
    <WS3Shell title="WS3 Production System" subtitle="Production overview · recorded data" status="info" time={new Date().toLocaleTimeString('vi-VN')} showGlobalNavigation={false}>
      <div className="h-full overflow-auto bg-hmiConsole p-2 text-slate-800">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {processes.map((process) => (
            <article key={process.name} className={`flex min-w-0 flex-col bg-white ${process.available ? 'border-2 border-industrial' : 'border border-line'}`}>
              <header className={`flex min-h-9 items-center justify-between px-3 py-2 text-white ${process.available ? 'bg-industrial' : 'bg-industrialDark'}`}>
                <h2 className="font-mono text-sm font-bold uppercase tracking-[0.1em]">{process.name}</h2>
                <span className="font-mono text-[9px] text-slate-300">{process.code}</span>
              </header>
              {process.available ? (
                <div className="flex min-h-[260px] flex-1 flex-col px-3 py-3">
                  {loading && <p className="py-6 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Loading recorded data...</p>}
                  {!loading && error && <div className="py-6 text-center text-[10px] uppercase"><p className="font-bold text-alarm">Scouring backend unavailable.</p><p className="mt-1 normal-case text-slate-600">{error}</p></div>}
                  {!loading && !error && !latestRecord && <p className="py-6 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">No Scouring records yet.</p>}
                  {!loading && !error && latestRecord && <>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]"><div><span className="block font-bold uppercase tracking-wide text-slate-500">Machine</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.machineId}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.batchIdentifier || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Operator</span><span className="mt-0.5 block font-semibold">{latestRecord.operatorName || latestRecord.operatorIdentifier || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Last recorded</span><span className="mt-0.5 block font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt)}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Status</span><span className={`mt-0.5 block font-bold uppercase ${recordComplete ? 'text-success' : 'text-alarm'}`}>{recordComplete ? 'Complete' : 'Incomplete'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Fabric in / out</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.inputFabricMeters ?? '—'} / {latestRecord.outputFabricMeters ?? '—'} m</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Production quantity</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.productionQuantityMeters ?? '—'} m</span><div><span className="block font-bold uppercase tracking-wide text-slate-500">Order No.</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.orderNumber || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Item</span><span className="mt-0.5 block font-semibold">{latestRecord.item || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Lot yarn / Lot No.</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.lotYarn || '—'} / {latestRecord.lotNumber || '—'}</span></div></div></div>
                    {warnings.length > 0 && <div className="mt-3 text-[9px] font-bold uppercase tracking-wide text-warning">{warnings.map((warning) => <div key={warning}>WARNING · {warning}</div>)}</div>}
                  </>}
                  <Link to="/machine/scouring" className="mt-auto inline-flex pt-4"><HMIButton size="normal" variant="primary" className="w-full">OPEN SCOURING</HMIButton></Link>
                </div>
              ) : (
                <div className="flex min-h-[120px] flex-1 items-start px-3 py-3"><span className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">Not implemented</span></div>
              )}
            </article>
          ))}
        </div>
      </div>
    </WS3Shell>
  );
}
