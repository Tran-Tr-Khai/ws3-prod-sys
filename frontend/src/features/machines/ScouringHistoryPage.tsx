import { useEffect, useMemo, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { getScouringRecords, type ScouringRecord } from './scouringApi';

type RecordStatus = 'COMPLETE' | 'WARNING' | 'INCOMPLETE';
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

function warningsFor(record: ScouringRecord): string[] {
  const warnings: string[] = [];
  if (record.speed < 40 || record.speed > 50) warnings.push('Speed outside expected 40–50 m/min');
  if (record.temperature < 90 || record.temperature > 98) warnings.push('Temperature outside expected 90–98 °C');
  return warnings;
}

function statusFor(record: ScouringRecord): RecordStatus {
  const required = [record.naoh, record.soap, record.desizer, record.h2o2, record.chelate, record.speed, record.temperature, record.cylinderTemperature];
  if (!required.every((value) => Number.isFinite(value))) return 'INCOMPLETE';
  return warningsFor(record).length > 0 ? 'WARNING' : 'COMPLETE';
}

function StatusText({ record }: { record: ScouringRecord }) {
  const status = statusFor(record);
  return <span className={`font-mono text-[10px] font-bold ${status === 'WARNING' ? 'text-warning' : status === 'INCOMPLETE' ? 'text-alarm' : 'text-success'}`}>{status}</span>;
}

function DetailGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <section className="border-b border-line last:border-b-0"><header className="bg-industrial px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{title}</header><div className="grid grid-cols-2 text-[11px]">{rows.map(([label, value]) => <div key={label} className="contents"><span className="border-b border-line/60 px-2 py-1.5 font-bold uppercase text-slate-500">{label}</span><span className="border-b border-line/60 px-2 py-1.5 font-mono font-semibold text-industrialDark">{value}</span></div>)}</div></section>;
}

export function ScouringHistoryPage() {
  const [records, setRecords] = useState<ScouringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<RecordStatus | ''>('');
  const [operatorBatch, setOperatorBatch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void getScouringRecords({ signal: controller.signal }).then((loaded) => {
      setRecords(loaded);
      setSelectedId((current) => current ?? loaded[0]?.id ?? null);
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setError(reason instanceof Error ? reason.message : 'Unable to load Scouring history.');
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, []);

  const filteredRecords = useMemo(() => records.filter((record) => {
    const search = operatorBatch.trim().toLowerCase();
    return (!date || record.recordedAt.slice(0, 10) === date)
      && (!status || statusFor(record) === status)
      && (!search || `${record.operatorName ?? ''} ${record.operatorIdentifier ?? ''} ${record.batchIdentifier ?? ''}`.toLowerCase().includes(search));
  }), [date, operatorBatch, records, status]);

  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;
  const clearFilters = () => { setDate(''); setStatus(''); setOperatorBatch(''); };

  return <main className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
    <HMIHeader variant="machine" title="WS3 / Scouring History" subtitle="Stored Scouring records · PostgreSQL" machineName="SC-01" status="info" time={new Date().toLocaleTimeString('vi-VN')} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <section className="border-b-2 border-industrialDark"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Record filters</h2><span className="font-mono text-[10px] uppercase tracking-wider">{filteredRecords.length} / {records.length}</span></header><div className="grid grid-cols-2 gap-1.5 bg-hmiSection p-1.5 sm:grid-cols-4"><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Date<input type="date" className="min-h-9 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Status<select className="min-h-9 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={status} onChange={(event) => setStatus(event.target.value as RecordStatus | '')}><option value="">All statuses</option><option value="COMPLETE">Complete</option><option value="WARNING">Warning</option><option value="INCOMPLETE">Incomplete</option></select></label><label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:col-span-2">Operator / batch<input className="min-h-9 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={operatorBatch} onChange={(event) => setOperatorBatch(event.target.value)} placeholder="Search when available" /></label><HMIButton size="compact" className="self-end" onClick={clearFilters}>CLEAR FILTERS</HMIButton></div></section>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-b-2 border-industrialDark bg-panel lg:border-b-0 lg:border-r-2"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Saved Scouring records</h2><span className="text-[10px] font-semibold uppercase text-slate-300">Newest first</span></header>{loading ? <div className="p-6 text-center text-xs font-bold uppercase tracking-wide text-slate-500">Loading Scouring history...</div> : error ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-alarm"><p>Unable to load Scouring history.</p><p className="mt-1 font-normal normal-case">{error}</p><HMIButton size="compact" className="mt-3" onClick={() => window.location.reload()}>RETRY</HMIButton></div> : filteredRecords.length === 0 ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{records.length === 0 ? 'No Scouring records yet.' : 'No records match the current filters.'}</div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[10px]"><thead className="sticky top-0 bg-industrial text-[9px] uppercase tracking-wider text-white"><tr><th className="px-2 py-1.5">Recorded</th><th className="px-2 py-1.5">Machine</th><th className="px-2 py-1.5">Batch</th><th className="px-2 py-1.5">Operator</th><th className="px-2 py-1.5">Speed</th><th className="px-2 py-1.5">Temp.</th><th className="px-2 py-1.5">Cylinder</th><th className="px-2 py-1.5">Input</th><th className="px-2 py-1.5">Output</th><th className="px-2 py-1.5">Status</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className={`cursor-pointer border-b border-line hover:bg-hmiHover ${selectedRecord?.id === record.id ? 'bg-hmiSelected' : ''}`} onClick={() => setSelectedId(record.id)}><td className="whitespace-nowrap px-2 py-1.5 font-mono font-semibold">{formatDateTime(record.recordedAt)}</td><td className="px-2 py-1.5 font-mono font-bold text-industrial">{record.machineId}</td><td className="px-2 py-1.5 font-mono">{record.batchIdentifier || '—'}</td><td className="px-2 py-1.5">{record.operatorName || record.operatorIdentifier || '—'}</td><td className="px-2 py-1.5 font-mono font-bold">{record.speed} m/min</td><td className="px-2 py-1.5 font-mono font-bold">{record.temperature} °C</td><td className="px-2 py-1.5 font-mono font-bold">{record.cylinderTemperature} °C</td><td className="px-2 py-1.5 font-mono">{record.inputFabricMeters ?? '—'} m</td><td className="px-2 py-1.5 font-mono">{record.outputFabricMeters ?? '—'} m</td><td className="px-2 py-1.5"><StatusText record={record} /></td></tr>)}</tbody></table></div>}</section>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Record detail</h2><span className="text-[10px] font-bold uppercase text-slate-300">{selectedRecord ? `ID ${selectedRecord.id}` : 'No selection'}</span></header>{selectedRecord ? <div className="min-h-0 flex-1 overflow-auto"><div className="grid grid-cols-2 gap-x-3 gap-y-1 border-b-2 border-line bg-white px-2 py-2 text-[11px]"><span className="font-bold uppercase text-slate-500">Recorded</span><span className="font-mono font-bold text-industrial">{formatDateTime(selectedRecord.recordedAt)}</span><span className="font-bold uppercase text-slate-500">Machine</span><span className="font-mono font-semibold">{selectedRecord.machineId}</span><span className="font-bold uppercase text-slate-500">Batch</span><span className="font-mono font-semibold">{selectedRecord.batchIdentifier || '—'}</span><span className="font-bold uppercase text-slate-500">Operator</span><span className="font-semibold">{selectedRecord.operatorName || selectedRecord.operatorIdentifier || '—'}</span></div><DetailGroup title="Chemical Input" rows={chemicalDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><DetailGroup title="Process Conditions" rows={processDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><DetailGroup title="Production" rows={productionDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><div className="border-t border-line bg-white px-2 py-2 text-[10px] font-bold uppercase tracking-wide">Status: <StatusText record={selectedRecord} />{warningsFor(selectedRecord).map((warning) => <div key={warning} className="mt-1 text-warning">WARNING · {warning}</div>)}</div></div> : <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Select a saved record to view complete details.</div>}</section>
      </div>
    </div>
  </main>;
}
