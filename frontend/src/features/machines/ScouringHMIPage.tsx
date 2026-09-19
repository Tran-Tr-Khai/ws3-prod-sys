import { useCallback, useEffect, useMemo, useState } from 'react';
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
  { label: 'Fabric Input', value: record.inputFabricMeters, unit: 'm' },
  { label: 'Fabric Output', value: record.outputFabricMeters, unit: 'm' },
  { label: 'Production Quantity', value: record.productionQuantityMeters, unit: 'm' },
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

function DataRow({ item, prominent = false }: { item: ValueDefinition; prominent?: boolean }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-[9px] font-bold uppercase tracking-wide text-slate-500">{item.label}</span>
      <span className={`mt-1 block truncate font-mono font-bold text-industrialDark ${prominent ? 'text-xl' : 'text-base'}`}>
        {item.value === null ? '—' : item.value} <small className="text-[10px] font-semibold text-slate-500">{item.value === null ? '' : item.unit}</small>
      </span>
    </div>
  );
}

export function ScouringHMIPage() {
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

  return (
    <WS3Shell title="WS3 / Scouring Overview" subtitle="Read-only recorded data · Scouring / 정련기" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-white">
          <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
            <section className="border-b border-line pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-industrialDark">Latest record</h2>
                {latestRecord && <span className={`font-mono text-[10px] font-bold uppercase ${latestWarnings.length ? 'text-warning' : 'text-success'}`}>{latestWarnings.length ? 'Data warning' : 'Record complete'}</span>}
              </div>
              {loading && <div className="py-6 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">Loading Scouring records...</div>}
              {!loading && error && <div className="py-4 text-center text-[10px] uppercase text-alarm"><p className="font-bold">Unable to load Scouring records.</p><p className="mt-1 font-normal normal-case">{error}</p><HMIButton size="compact" className="mt-2" onClick={() => void loadRecords()}>RETRY</HMIButton></div>}
              {!loading && !error && !latestRecord && <div className="py-6 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">No Scouring records yet. Enter the first record to populate this overview.</div>}
              {!loading && !error && latestRecord && <div className="mt-3 grid gap-x-5 gap-y-2 text-[10px] sm:grid-cols-4"><div><span className="block font-bold uppercase tracking-wide text-slate-500">Recorded time</span><span className="mt-0.5 block font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt)}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="mt-0.5 block font-mono font-bold text-industrial">{latestRecord.batchIdentifier || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Operator</span><span className="mt-0.5 block font-semibold">{latestRecord.operatorName || latestRecord.operatorIdentifier || '—'}</span></div><div><span className="block font-bold uppercase tracking-wide text-slate-500">Status</span><span className={`mt-0.5 block font-bold uppercase ${isComplete(latestRecord) ? 'text-success' : 'text-alarm'}`}>{isComplete(latestRecord) ? 'Complete' : 'Incomplete'}</span></div></div>}
            </section>

            {!loading && !error && latestRecord && <>
              <section className="border-b border-line py-3"><h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Process conditions</h3><div className="mt-2 grid grid-cols-3 divide-x divide-line">{processDefinitions(latestRecord).map((item) => <div key={item.label} className="px-3 first:pl-0 last:pr-0"><DataRow item={item} prominent /></div>)}</div></section>
              <section className="border-b border-line py-3"><h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Production</h3><div className="mt-2 grid grid-cols-3 divide-x divide-line">{productionDefinitions(latestRecord).map((item) => <div key={item.label} className="px-3 first:pl-0 last:pr-0"><DataRow item={item} prominent /></div>)}</div></section>
              <section className="border-b border-line py-3"><h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Chemical input</h3><div className="mt-2 grid grid-cols-5 divide-x divide-line">{chemicalDefinitions(latestRecord).map((item) => <div key={item.label} className="px-2 first:pl-0 last:pr-0"><DataRow item={item} /></div>)}</div></section>
              {latestWarnings.length > 0 && <div className="py-2 text-[9px] font-bold uppercase tracking-wide text-warning">{latestWarnings.map((warning) => <div key={warning}>WARNING · {warning}</div>)}</div>}
            </>}

            <div className="min-h-[100px] flex-1" aria-hidden="true" />
          </div>
        </div>
      </div>
    </WS3Shell>
  );
}
