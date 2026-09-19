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
    <WS3Shell title="WS3 Production System" subtitle="Select a production module" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-hmiConsole p-2 text-slate-800">
        <section className="border-2 border-industrialDark bg-panel">
          <header className="flex min-h-9 items-center justify-between bg-industrialDark px-3 py-1.5 text-white">
            <h1 className="text-xs font-bold uppercase tracking-[0.14em]">WS3 Overview</h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">PRODUCTION MODULES</span>
          </header>
          <div className="grid gap-px border-b border-line bg-line md:grid-cols-[minmax(0,1fr)_minmax(280px,0.65fr)]">
            <div className="bg-white px-3 py-2">
              <p className="text-xs font-semibold text-industrialDark">Select a process to continue.</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Only Scouring is available in this release.</p>
            </div>
            <section className="bg-white px-3 py-2">
              <header className="flex items-center justify-between gap-2">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-industrialDark">Latest Scouring record</h2>
                {latestRecord && <span className={`font-mono text-[9px] font-bold uppercase ${warnings.length ? 'text-warning' : 'text-success'}`}>{warnings.length ? 'WARNING' : 'DATA AVAILABLE'}</span>}
              </header>
              {loading && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Loading recorded data...</p>}
              {!loading && error && <div className="mt-2 text-[10px] font-semibold uppercase text-alarm"><p>Scouring backend unavailable.</p><p className="mt-0.5 font-normal normal-case">{error}</p></div>}
              {!loading && !error && !latestRecord && <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">No Scouring records yet.</p>}
              {!loading && !error && latestRecord && <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]"><span className="font-bold uppercase text-slate-500">Machine</span><span className="font-mono font-bold text-industrial">{latestRecord.machineId}</span><span className="font-bold uppercase text-slate-500">Batch</span><span className="font-mono">{latestRecord.batchIdentifier || '—'}</span><span className="font-bold uppercase text-slate-500">Operator</span><span>{latestRecord.operatorName || latestRecord.operatorIdentifier || '—'}</span><span className="font-bold uppercase text-slate-500">Recorded</span><span className="font-mono">{formatDateTime(latestRecord.recordedAt)}</span><span className="font-bold uppercase text-slate-500">Status</span><span className={recordComplete ? 'font-bold text-success' : 'font-bold text-alarm'}>{recordComplete ? 'RECORD COMPLETE' : 'RECORD INCOMPLETE'}</span><span className="font-bold uppercase text-slate-500">Meters</span><span className="font-mono font-bold text-industrial">{latestRecord.inputFabricMeters ?? '—'} / {latestRecord.outputFabricMeters ?? '—'} m</span>{warnings.length > 0 && <><span className="font-bold uppercase text-slate-500">Attention</span><span className="font-bold text-warning">{warnings.length} data/process warning{warnings.length === 1 ? '' : 's'}</span></>}</div>}
            </section>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {processes.map((process) => (
              <div key={process.name} className={`flex min-h-32 flex-col justify-between bg-surfaceMuted p-3 ${process.available ? 'border-t-4 border-industrial' : 'border-t-4 border-slate-300'}`}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-industrialDark">{process.name}</h2>
                    <span className="font-mono text-[9px] font-bold text-slate-500">{process.code}</span>
                  </div>
                  <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${process.available ? 'text-success' : 'text-slate-500'}`}>
                    {process.available ? 'AVAILABLE' : 'NOT IMPLEMENTED'}
                  </p>
                </div>
                {process.available ? (
                  <Link to="/machine/scouring" className="mt-3 inline-flex">
                    <HMIButton size="compact" variant="primary">OPEN SCOURING</HMIButton>
                  </Link>
                ) : (
                  <span className="mt-3 border border-line bg-white px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">Coming soon</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </WS3Shell>
  );
}
