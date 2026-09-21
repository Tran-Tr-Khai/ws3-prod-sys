import { useEffect, useMemo, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getScouringPhInspections, getScouringRecords, type ScouringPhInspection, type ScouringRecord } from './scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';

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
  { label: 'Production quantity', value: record.productionQuantityMeters, unit: 'm' },
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

function StatusText({ record, label }: { record: ScouringRecord; label?: (status: RecordStatus) => string }) {
  const status = statusFor(record);
  return <span className={`font-mono text-[10px] font-bold ${status === 'WARNING' ? 'text-warning' : status === 'INCOMPLETE' ? 'text-alarm' : 'text-success'}`}>{label ? label(status) : status}</span>;
}

function DetailGroup({ title, rows }: { title: string; rows: Array<[string, string]> }) {
  return <section className="border-b border-line last:border-b-0"><header className="bg-industrial px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{title}</header><div className="grid grid-cols-2 text-[11px]">{rows.map(([label, value]) => <div key={label} className="contents"><span className="border-b border-line/60 px-2 py-1.5 font-bold uppercase text-slate-500">{label}</span><span className="border-b border-line/60 px-2 py-1.5 font-mono font-semibold text-industrialDark">{value}</span></div>)}</div></section>;
}

function PhInspectionGroup({ inspections }: { inspections: ScouringPhInspection[] }) {
  if (inspections.length === 0) return null;
  return <div className="divide-y divide-line/60 text-[10px]">{inspections.map((inspection) => <div key={inspection.id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-line px-2 py-2"><span className="font-mono font-bold text-industrial">{formatDateTime(inspection.inspectedAt)}</span><span className="font-semibold">{inspection.operatorName || '—'}</span><span className="col-span-2 font-mono text-industrialDark">{inspection.tankPh.map((value, index) => `T${index} ${value ?? '—'}`).join(' · ')}</span>{inspection.note ? <span className="col-span-2 text-slate-600">{inspection.note}</span> : null}</div>)}</div>;
}

export function ScouringHistoryPage() {
  const { t } = useLanguage();
  const [records, setRecords] = useState<ScouringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<RecordStatus | ''>('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailMode, setDetailMode] = useState<'record' | 'ph'>('record');
  const [phInspections, setPhInspections] = useState<ScouringPhInspection[]>([]);
  const [phInspectionCounts, setPhInspectionCounts] = useState<Record<number, number>>({});

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

  useEffect(() => {
    void getScouringPhInspections().then((items) => {
      setPhInspections(items);
      setPhInspectionCounts(items.reduce<Record<number, number>>((counts, item) => ({ ...counts, [item.scouringRecordId]: (counts[item.scouringRecordId] ?? 0) + 1 }), {}));
    }).catch(() => undefined);
  }, []);

  const filteredRecords = useMemo(() => records.filter((record) => {
    const search = operatorSearch.trim().toLowerCase();
    return (!date || record.recordedAt.slice(0, 10) === date)
      && (!status || statusFor(record) === status)
      && (!search || `${record.operatorName ?? ''} ${record.operatorIdentifier ?? ''}`.toLowerCase().includes(search));
  }), [date, operatorSearch, records, status]);

  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;
  useEffect(() => {
    if (selectedRecord) void getScouringPhInspections(selectedRecord.id).then(setPhInspections).catch(() => setPhInspections([]));
  }, [selectedRecord?.id]);
  const clearFilters = () => { setDate(''); setStatus(''); setOperatorSearch(''); };

  return <WS3Shell title="WS3 / Scouring History" subtitle="Stored Scouring records · PostgreSQL" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <section className="border-b-2 border-industrialDark"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">{t('recordFilters')}</h2><span className="font-mono text-[10px] uppercase tracking-wider">{filteredRecords.length} / {records.length}</span></header><div className="overflow-x-auto"><div className="flex min-w-[760px] items-end gap-1.5 bg-hmiSection p-1.5"><label className="grid min-w-[190px] flex-1 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{t('recordedTime')}<input type="date" className="min-h-10 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="grid min-w-[190px] flex-1 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{t('status')}<select className="min-h-10 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={status} onChange={(event) => setStatus(event.target.value as RecordStatus | '')}><option value="">{t('allStatuses')}</option><option value="COMPLETE">{t('complete')}</option><option value="WARNING">{t('warning')}</option><option value="INCOMPLETE">{t('incomplete')}</option></select></label><label className="grid min-w-[300px] flex-[1.5] gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{t('operator')}<input className="min-h-10 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder={t('searchWhenAvailable')} /></label><HMIButton size="compact" className="shrink-0" onClick={clearFilters}>{t('clearFilters')}</HMIButton></div></div></section>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="flex min-h-0 min-w-0 flex-col border-b-2 border-industrialDark bg-panel lg:border-b-0 lg:border-r-2"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">{t('history')}</h2><span className="text-[10px] font-semibold uppercase text-slate-300">{t('newestFirst')}</span></header>{loading ? <div className="p-6 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{t('loadingRecords')}</div> : error ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-alarm"><p>{t('unableToLoadRecords')}</p><p className="mt-1 font-normal normal-case">{error}</p><HMIButton size="compact" className="mt-3" onClick={() => window.location.reload()}>{t('retry')}</HMIButton></div> : filteredRecords.length === 0 ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{records.length === 0 ? t('noRecords') : t('noMatchingRecords')}</div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[10px]"><thead className="sticky top-0 bg-industrial text-[9px] uppercase tracking-wider text-white"><tr><th className="px-2 py-1.5">{t('recordedTime')}</th><th className="px-2 py-1.5">{t('machine')}</th><th className="px-2 py-1.5">{t('operator')}</th><th className="px-2 py-1.5">{t('speed')}</th><th className="px-2 py-1.5">{t('temperature')}</th><th className="px-2 py-1.5">{t('cylinderTemperature')}</th><th className="px-2 py-1.5">{t('inputMeters')}</th><th className="px-2 py-1.5">{t('outputMeters')}</th><th className="px-2 py-1.5">{t('phInspection')}</th><th className="px-2 py-1.5">{t('status')}</th></tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className={`cursor-pointer border-b border-line hover:bg-hmiHover ${selectedRecord?.id === record.id ? 'bg-hmiSelected' : ''}`} onClick={() => { setSelectedId(record.id); setDetailMode('record'); }}><td className="whitespace-nowrap px-2 py-1.5 font-mono font-semibold">{formatDateTime(record.recordedAt)}</td><td className="px-2 py-1.5 font-mono font-bold text-industrial">{record.machineId}</td><td className="px-2 py-1.5">{record.operatorName || record.operatorIdentifier || '—'}</td><td className="px-2 py-1.5 font-mono font-bold">{record.speed} m/min</td><td className="px-2 py-1.5 font-mono font-bold">{record.temperature} °C</td><td className="px-2 py-1.5 font-mono font-bold">{record.cylinderTemperature} °C</td><td className="px-2 py-1.5 font-mono">{record.inputFabricMeters ?? '—'} m</td><td className="px-2 py-1.5 font-mono">{record.outputFabricMeters ?? '—'} m</td><td className="px-2 py-1.5">{phInspectionCounts[record.id] ? <button type="button" className="font-bold text-industrial underline" onClick={(event) => { event.stopPropagation(); setSelectedId(record.id); setDetailMode('ph'); }}>{t('view')} ({phInspectionCounts[record.id]})</button> : <span>—</span>}</td><td className="px-2 py-1.5"><StatusText record={record} label={(value) => value === 'COMPLETE' ? t('complete') : value === 'WARNING' ? t('warning') : t('incomplete')} /></td></tr>)}</tbody></table></div>}</section>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel"><header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">{detailMode === 'ph' ? t('phInspection') : t('recordDetail')}</h2><span className="text-[10px] font-bold uppercase text-slate-300">{selectedRecord ? `ID ${selectedRecord.id}` : t('noSelection')}</span></header>{selectedRecord ? <div className="min-h-0 flex-1 overflow-auto">{detailMode === 'ph' ? <PhInspectionGroup inspections={phInspections} /> : <><div className="grid grid-cols-2 gap-x-3 gap-y-1 border-b-2 border-line bg-white px-2 py-2 text-[11px]"><span className="font-bold uppercase text-slate-500">{t('recordedTime')}</span><span className="font-mono font-bold text-industrial">{formatDateTime(selectedRecord.recordedAt)}</span><span className="font-bold uppercase text-slate-500">{t('machine')}</span><span className="font-mono font-semibold">{selectedRecord.machineId}</span><span className="font-bold uppercase text-slate-500">{t('operator')}</span><span className="font-semibold">{selectedRecord.operatorName || selectedRecord.operatorIdentifier || '—'}</span></div><DetailGroup title={t('recordContext')} rows={[[t('orderNumber'), selectedRecord.orderNumber || '—'], [t('item'), selectedRecord.item || '—'], [t('lotYarn'), selectedRecord.lotYarn || '—'], [t('lotNumber'), selectedRecord.lotNumber || '—']]} /><DetailGroup title={t('chemicalInput')} rows={chemicalDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><DetailGroup title={t('processConditions')} rows={processDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><DetailGroup title={t('production')} rows={productionDefinitions(selectedRecord).map((item) => [item.label, `${item.value ?? '—'} ${item.value === null ? '' : item.unit}`])} /><div className="border-t border-line bg-white px-2 py-2 text-[10px] font-bold uppercase tracking-wide">{t('status')}: <StatusText record={selectedRecord} label={(value) => value === 'COMPLETE' ? t('complete') : value === 'WARNING' ? t('warning') : t('incomplete')} />{warningsFor(selectedRecord).map((warning) => <div key={warning} className="mt-1 text-warning">{warning.includes('Temperature') ? t('temperatureWarning') : t('speedWarning')}</div>)}</div></>}</div> : <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{t('noSelection')}</div>}</section>
      </div>
      </div>
    </div>
  </WS3Shell>;
}
