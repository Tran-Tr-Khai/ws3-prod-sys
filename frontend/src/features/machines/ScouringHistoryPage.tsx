import { useMemo, useState } from 'react';
import { FunctionKeyBar } from '../../components/hmi/FunctionKeyBar';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { HMIButton } from '../../components/hmi/HMIButton';
import { StatusLamp } from '../../components/hmi/StatusLamp';
import type { HMIStatus } from '../../components/hmi/types';
import { readScouringRecords } from './scouringRecord';

const ranges: Record<string, [number, number]> = { Speed: [40, 50], Temperature: [90, 98] };

function statusLabel(status: HMIStatus): string {
  return status.toUpperCase();
}

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function selectClassName(): string {
  return 'min-h-9 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial focus:ring-1 focus:ring-industrial';
}

export function ScouringHistoryPage() {
  const records = useMemo(() => readScouringRecords().reverse(), []);
  const [date, setDate] = useState('');
  const [machine, setMachine] = useState('');
  const [batch, setBatch] = useState('');
  const [operator, setOperator] = useState('');
  const [status, setStatus] = useState('');
  const [selectedTimestamp, setSelectedTimestamp] = useState<string | null>(records[0]?.timestamp ?? null);

  const filteredRecords = records.filter((record) => (
    (!date || record.timestamp.slice(0, 10) === date)
    && (!machine || record.machine === machine)
    && (!batch || record.batch.toLowerCase().includes(batch.toLowerCase()))
    && (!operator || record.operator.toLowerCase().includes(operator.toLowerCase()))
    && (!status || (record.recordStatus ?? 'CONFIRMED') === status)
  ));
  const selectedRecord = filteredRecords.find((record) => record.timestamp === selectedTimestamp) ?? filteredRecords[0] ?? null;

  const clearFilters = () => { setDate(''); setMachine(''); setBatch(''); setOperator(''); setStatus(''); };
  const machines = [...new Set(records.map((record) => record.machine))];
  const statuses = [...new Set(records.map((record) => record.recordStatus ?? 'CONFIRMED'))];

  return <main className="h-screen min-h-[600px] overflow-hidden bg-navy text-slate-800 flex flex-col">
    <HMIHeader title="WS3 / Scouring History" subtitle="Digital operation records · Manual operator input" machineName="SC-01" status="info" time={new Date().toLocaleTimeString('vi-VN')} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-[#c7d0d4]">
      <section className="border-b-2 border-industrialDark">
        <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Record filters</h2><span className="font-mono text-[10px] uppercase tracking-wider">{filteredRecords.length} / {records.length}</span></header>
        <div className="grid grid-cols-2 gap-2 bg-[#d3dce0] p-2 sm:grid-cols-3 lg:grid-cols-6">
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Date<input type="date" className={selectClassName()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Machine<select className={selectClassName()} value={machine} onChange={(event) => setMachine(event.target.value)}><option value="">All</option>{machines.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Batch<input className={selectClassName()} value={batch} onChange={(event) => setBatch(event.target.value)} placeholder="All batches" /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Operator<input className={selectClassName()} value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="All operators" /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Status<select className={selectClassName()} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <HMIButton size="compact" className="self-end" onClick={clearFilters}>Clear filters</HMIButton>
        </div>
      </section>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_minmax(370px,0.95fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-b-2 border-industrialDark bg-panel lg:border-b-0 lg:border-r-2">
          <header className="flex min-h-8 items-center justify-between border-b border-line bg-[#dfe5e8] px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider">Saved Scouring records</h2><span className="text-[10px] font-semibold uppercase text-slate-500">Immutable snapshots</span></header>
          {filteredRecords.length === 0 ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">No saved records match the filters.</div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[560px] border-collapse text-left text-[11px]"><thead className="sticky top-0 bg-industrial text-[10px] uppercase tracking-wider text-white"><tr><th className="px-2 py-2">Date / time</th><th className="px-2 py-2">Machine</th><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Operator</th><th className="px-2 py-2">Status</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={`${record.timestamp}-${record.batch}`} className={`cursor-pointer border-b border-line hover:bg-[#e7edf0] ${selectedRecord?.timestamp === record.timestamp ? 'bg-[#dfeaf0]' : ''}`} onClick={() => setSelectedTimestamp(record.timestamp)}><td className="whitespace-nowrap px-2 py-2 font-mono font-semibold">{formatDateTime(record.timestamp)}</td><td className="px-2 py-2 font-mono font-bold text-industrial">{record.machine}</td><td className="px-2 py-2 font-mono">{record.batch}</td><td className="px-2 py-2">{record.operator}</td><td className="px-2 py-2"><span className="font-mono font-bold text-success">{record.recordStatus ?? 'CONFIRMED'}</span></td></tr>)}</tbody></table></div>}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b border-line bg-[#dfe5e8] px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider">Record detail</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-info"><StatusLamp status="info" showLabel={false} /> MANUAL RECORD</span></header>
          {selectedRecord ? <div className="min-h-0 flex-1 overflow-auto p-2"><div className="mb-2 grid grid-cols-2 gap-x-3 gap-y-1 border-b-2 border-line pb-2 text-[11px]"><span className="font-bold uppercase text-slate-500">Recorded</span><span className="font-mono font-bold text-industrial">{formatDateTime(selectedRecord.timestamp)}</span><span className="font-bold uppercase text-slate-500">Machine / process</span><span className="font-semibold">{selectedRecord.machine} · {selectedRecord.process}</span><span className="font-bold uppercase text-slate-500">Batch / recipe</span><span className="font-semibold">{selectedRecord.batch} · {selectedRecord.recipe}</span><span className="font-bold uppercase text-slate-500">Entered by</span><span className="font-semibold">{selectedRecord.operator}</span></div><div className="overflow-auto"><table className="w-full min-w-[360px] border-collapse text-xs"><thead className="bg-industrial text-[10px] uppercase tracking-wider text-white"><tr><th className="px-2 py-1.5 text-left">Parameter</th><th className="px-2 py-1.5 text-right">Actual</th><th className="px-2 py-1.5 text-right">Set</th><th className="px-2 py-1.5 text-right">Limit</th><th className="px-2 py-1.5">State</th></tr></thead><tbody>{selectedRecord.parameters.map((parameter) => { const range = ranges[parameter.name]; return <tr key={parameter.name} className="border-b border-line"><td className="px-2 py-1.5 font-semibold">{parameter.name}</td><td className="px-2 py-1.5 text-right font-mono font-bold text-industrial">{parameter.actual} {parameter.unit}</td><td className="px-2 py-1.5 text-right font-mono">{parameter.set} {parameter.unit}</td><td className="px-2 py-1.5 text-right font-mono text-[10px] text-slate-500">{range ? `${range[0]}–${range[1]} ${parameter.unit}` : '—'}</td><td className={`px-2 py-1.5 font-mono text-[10px] font-bold ${parameter.validationStatus === 'alarm' ? 'text-alarm' : parameter.validationStatus === 'warning' ? 'text-warning' : 'text-success'}`}>{statusLabel(parameter.validationStatus)}</td></tr>; })}</tbody></table></div></div> : <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Select a saved record to view its parameters.</div>}
        </section>
      </div>
    </div>
    <div className="mx-2 mt-2 flex-none"><FunctionKeyBar keys={[{ key: 'F1', label: 'Current HMI' }, { key: 'F4', label: 'History' }, { key: 'F6', label: 'Menu' }]} /></div>
  </main>;
}
