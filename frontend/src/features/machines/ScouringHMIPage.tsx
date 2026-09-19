import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getScouringRecords, type ScouringRecord } from './scouringApi';

type ValueDefinition = { label: string; value: number | null; unit: string };

const chemicalDefinitions = (record: ScouringRecord): ValueDefinition[] => [
  { label: 'NaOH', value: record.naoh, unit: 'L' },
  { label: 'Soap', value: record.soap, unit: 'L' },
  { label: 'Desizer', value: record.desizer, unit: 'L' },
  { label: 'H2O2', value: record.h2o2, unit: 'L' },
  { label: 'Chelate', value: record.chelate, unit: 'L' },
];

const processDefinitions = (record: ScouringRecord): ValueDefinition[] => [
  { label: 'Speed', value: record.speed, unit: 'm/min' },
  { label: 'Temperature', value: record.temperature, unit: '°C' },
  { label: 'Cylinder Temperature', value: record.cylinderTemperature, unit: '°C' },
];

const productionDefinitions = (record: ScouringRecord): ValueDefinition[] => [
  { label: 'Input meters', value: record.inputFabricMeters, unit: 'm' },
  { label: 'Output meters', value: record.outputFabricMeters, unit: 'm' },
];

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function recordWarnings(record: ScouringRecord): string[] {
  const warnings: string[] = [];
  if (record.speed < 40 || record.speed > 50) warnings.push('Speed outside expected 40–50 m/min');
  if (record.temperature < 90 || record.temperature > 98) warnings.push('Temperature outside expected 90–98 °C');
  return warnings;
}

function isComplete(record: ScouringRecord): boolean {
  return [...chemicalDefinitions(record), ...processDefinitions(record)].every(({ value }) => value !== null && Number.isFinite(value));
}

function ValueGroup({ title, values }: { title: string; values: ValueDefinition[] }) {
  return (
    <section className="border-b border-line last:border-b-0">
      <header className="flex min-h-8 items-center justify-between bg-industrialDark px-2 py-1 text-white">
        <h3 className="text-[11px] font-bold uppercase tracking-[0.14em]">{title}</h3>
        <span className="font-mono text-[9px] uppercase tracking-wider text-slate-300">{values.length} VALUES</span>
      </header>
      <div className="grid grid-cols-2 divide-x divide-line/50 bg-white lg:grid-cols-3">
        {values.map((item) => (
          <div key={item.label} className="border-b border-line/50 px-3 py-2 last:border-b-0">
            <div className="text-[9px] font-bold uppercase tracking-[0.1em] text-slate-500">{item.label}</div>
            <div className="mt-1 font-mono text-[22px] font-bold leading-none text-industrialDark">
              {item.value === null ? '—' : item.value} <span className="text-[11px] font-semibold text-slate-500">{item.value === null ? '' : item.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecordStatus({ record }: { record: ScouringRecord }) {
  const warnings = recordWarnings(record);
  const complete = isComplete(record);
  return (
    <section className="border border-line bg-white">
      <header className="flex min-h-8 items-center justify-between border-b border-line bg-surfaceMuted px-2 py-1 text-industrialDark">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">Data status</h2>
        <span className={`font-mono text-[10px] font-bold uppercase ${complete ? 'text-success' : 'text-alarm'}`}>{complete ? 'RECORD COMPLETE' : 'RECORD INCOMPLETE'}</span>
      </header>
      <div className="px-3 py-2 text-[10px]">
        {warnings.length === 0 ? <span className="font-semibold uppercase tracking-wide text-success">No data/process warnings</span> : <div className="grid gap-1 text-warning">{warnings.map((warning) => <span key={warning}>WARNING · {warning}</span>)}</div>}
      </div>
    </section>
  );
}

export function ScouringHMIPage() {
  const navigate = useNavigate();
  const [records, setRecords] = useState<ScouringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await getScouringRecords());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load Scouring records.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const latestRecord = records[0];
  const latestWarnings = useMemo(() => latestRecord ? recordWarnings(latestRecord) : [], [latestRecord]);

  return <WS3Shell title="WS3 / Scouring Overview" subtitle="Read-only recorded data · Scouring / 정련기" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[278px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b-2 border-industrialDark bg-hmiConsole lg:border-b-0 lg:border-r-2">
          <section>
            <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Scouring overview</h2><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">READ ONLY</span></header>
            <div className="border-l-4 border-info bg-white px-2 py-3"><div className="font-mono text-xl font-bold tracking-[0.12em] text-industrialDark">SC-01 / SCOURING</div><div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Latest backend record</div></div>
          </section>
          <section className="mt-2 border-t border-line bg-white">
            <header className="flex min-h-8 items-center justify-between bg-surfaceMuted px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-industrialDark">Latest context</h2><span className="font-mono text-[10px] text-slate-500">RECORDED</span></header>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 py-2 text-[11px]"><span className="font-bold uppercase tracking-wide text-slate-500">Time</span><span className="font-mono font-bold text-industrial">{latestRecord ? formatDateTime(latestRecord.recordedAt) : '—'}</span><span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="font-mono font-bold text-industrial">{latestRecord?.batchIdentifier || '—'}</span><span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span>{latestRecord?.operatorName || latestRecord?.operatorIdentifier || '—'}</span></div>
          </section>
          <section className="mt-auto grid gap-2 p-2"><HMIButton size="large" variant="primary" onClick={() => navigate('/machine/scouring/record')}>ENTER RECORD</HMIButton><HMIButton size="large" variant="secondary" onClick={() => navigate('/machine/scouring/history')}>VIEW HISTORY</HMIButton></section>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Latest Scouring data</h2><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">BACKEND RECORDS</span></header>
          <div className="min-h-0 flex-1 overflow-auto bg-surfaceMuted p-2">
            {loading && <div className="border border-line bg-white p-6 text-center text-xs font-bold uppercase tracking-wider text-slate-500">Loading Scouring records...</div>}
            {!loading && error && <div className="border border-alarm bg-hmiAlarm p-4 text-center text-xs font-bold uppercase tracking-wide text-alarm"><p>Unable to load Scouring records.</p><p className="mt-1 font-normal normal-case">{error}</p><HMIButton size="compact" className="mt-3" onClick={() => void loadRecords()}>RETRY</HMIButton></div>}
            {!loading && !error && !latestRecord && <div className="border border-line bg-white p-8 text-center text-xs font-bold uppercase tracking-wider text-slate-500">No Scouring records yet. Enter the first record to populate this overview.</div>}
            {!loading && !error && latestRecord && <div className="grid gap-2"><RecordStatus record={latestRecord} /><div className="border border-line bg-white"><ValueGroup title="Chemical Input" values={chemicalDefinitions(latestRecord)} /><ValueGroup title="Process Conditions" values={processDefinitions(latestRecord)} /><ValueGroup title="Production" values={productionDefinitions(latestRecord)} /></div><section className="border border-line bg-white"><header className="flex min-h-8 items-center justify-between border-b border-line bg-surfaceMuted px-2 py-1 text-industrialDark"><h2 className="text-[11px] font-bold uppercase tracking-[0.14em]">Recent records</h2><span className="font-mono text-[9px] uppercase tracking-wider text-slate-500">{records.length} LOADED</span></header><div className="overflow-auto"><table className="w-full border-collapse text-left text-[10px]"><thead className="bg-industrial text-[9px] uppercase tracking-wider text-white"><tr><th className="px-2 py-1.5">Recorded</th><th className="px-2 py-1.5">Operator</th><th className="px-2 py-1.5">Speed</th><th className="px-2 py-1.5">Temp.</th><th className="px-2 py-1.5">Status</th></tr></thead><tbody>{records.slice(0, 5).map((record) => { const warnings = recordWarnings(record); return <tr key={record.id} className="border-b border-line"><td className="whitespace-nowrap px-2 py-1.5 font-mono font-semibold">{formatDateTime(record.recordedAt)}</td><td className="px-2 py-1.5">{record.operatorName || record.operatorIdentifier || '—'}</td><td className="px-2 py-1.5 font-mono font-bold text-industrial">{record.speed} m/min</td><td className="px-2 py-1.5 font-mono font-bold text-industrial">{record.temperature} °C</td><td className={`px-2 py-1.5 font-mono font-bold ${warnings.length ? 'text-warning' : 'text-success'}`}>{warnings.length ? `WARNING · ${warnings.length}` : 'COMPLETE'}</td></tr>; })}</tbody></table></div></section>{latestWarnings.length > 0 && <div className="text-[9px] font-bold uppercase tracking-wider text-warning">Warnings shown are data/process warnings, not machine alarms.</div>}</div>}
          </div>
        </section>
      </div>
      </div>
    </div>
  </WS3Shell>;
}
