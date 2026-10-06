import { useEffect, useMemo, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getScouringPhInspections, getScouringRecords, type ScouringPhInspection, type ScouringRecord } from './scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ensureVietnamesePdfFonts } from '../../utils/pdfFonts';

type RecordStatus = 'COMPLETE' | 'WARNING' | 'INCOMPLETE';
type OrderProgress = 'IN_PROGRESS' | 'COMPLETED' | 'UNKNOWN';
function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
}

function localDateKey(timestamp: string): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function orderProgressLabel(progress: OrderProgress, language: string): string {
  if (progress === 'IN_PROGRESS') return language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS';
  if (progress === 'COMPLETED') return language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED';
  return language === 'vi' ? 'CHƯA CẬP NHẬT' : 'NOT SET';
}

function OrderProgressBadge({ progress, language }: { progress: OrderProgress; language: string }) {
  const style = progress === 'COMPLETED' ? 'border-success bg-hmiNormal text-success' : progress === 'IN_PROGRESS' ? 'border-info bg-hmiInfo text-industrial' : 'border-line bg-hmiSection text-slate-500';
  return <span className={`inline-flex border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${style}`}>{orderProgressLabel(progress, language)}</span>;
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

function PhInspectionGroup({ inspections }: { inspections: ScouringPhInspection[] }) {
  if (inspections.length === 0) return null;
  return <div className="divide-y divide-line/60 text-[10px]">{inspections.map((inspection) => <div key={inspection.id} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 border-b border-line px-2 py-2"><span className="font-mono font-bold text-industrial">{formatDateTime(inspection.inspectedAt)}</span><span className="font-semibold">{inspection.operatorName || '—'}</span><span className="col-span-2 font-mono text-industrialDark">{inspection.tankPh.map((value, index) => `T${index} ${value ?? '—'}`).join(' · ')}</span>{inspection.note ? <span className="col-span-2 text-slate-600">{inspection.note}</span> : null}</div>)}</div>;
}

export function ScouringHistoryPage() {
  const { t, language } = useLanguage();
  const [records, setRecords] = useState<ScouringRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [status, setStatus] = useState<RecordStatus | ''>('');
  const [orderProgress, setOrderProgress] = useState<OrderProgress | ''>('');
  const [operatorSearch, setOperatorSearch] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [phDialogOpen, setPhDialogOpen] = useState(false);
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
    return (!date || localDateKey(record.recordedAt) === date)
      && (!status || statusFor(record) === status)
      && (!orderProgress || (orderProgress === 'UNKNOWN' ? !record.orderProgress : record.orderProgress === orderProgress))
      && (!search || `${record.orderNumber ?? ''} ${record.item ?? ''} ${record.lotNumber ?? ''} ${record.operatorName ?? ''} ${record.operatorIdentifier ?? ''} ${record.shift ?? ''}`.toLowerCase().includes(search));
  }), [date, operatorSearch, orderProgress, records, status]);

  const selectedRecord = filteredRecords.find((record) => record.id === selectedId) ?? filteredRecords[0] ?? null;
  const selectedRecordId = selectedRecord?.id;
  const formatValue = (value: number | null) => value === null ? '—' : value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 });
  useEffect(() => {
    if (selectedRecordId) void getScouringPhInspections(selectedRecordId).then(setPhInspections).catch(() => setPhInspections([]));
  }, [selectedRecordId]);
  const clearFilters = () => { setDate(''); setStatus(''); setOrderProgress(''); setOperatorSearch(''); };

  const exportPdf = async () => {
    if (!selectedRecord) return;

    const document = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    await ensureVietnamesePdfFonts(document);
    const detailRows: Array<[string, string]> = [
      [t('recordedTime'), formatDateTime(selectedRecord.recordedAt)],
      [t('machine'), selectedRecord.machineId],
      [t('operator'), selectedRecord.operatorName || selectedRecord.operatorIdentifier || '—'],
      [language === 'vi' ? 'ID nhân viên' : 'Employee ID', selectedRecord.operatorIdentifier || '—'],
      [language === 'vi' ? 'Ca làm' : 'Shift', selectedRecord.shift || '—'],
      [language === 'vi' ? 'Tiến độ đơn' : 'Order progress', orderProgressLabel(selectedRecord.orderProgress ?? 'UNKNOWN', language)],
      [t('orderNumber'), selectedRecord.orderNumber || '—'],
      [t('item'), selectedRecord.item || '—'],
      [t('lotYarn'), selectedRecord.lotYarn || '—'],
      [t('lotNumber'), selectedRecord.lotNumber || '—'],
      [t('chemicalInput'), ''],
      ['NaOH', `${selectedRecord.naoh ?? '—'} ${selectedRecord.naoh === null ? '' : 'L'}`],
      ['Soap', `${selectedRecord.soap ?? '—'} ${selectedRecord.soap === null ? '' : 'L'}`],
      ['Desizer', `${selectedRecord.desizer ?? '—'} ${selectedRecord.desizer === null ? '' : 'L'}`],
      ['H2O2', `${selectedRecord.h2o2 ?? '—'} ${selectedRecord.h2o2 === null ? '' : 'L'}`],
      ['Chelate', `${selectedRecord.chelate ?? '—'} ${selectedRecord.chelate === null ? '' : 'L'}`],
      [t('processConditions'), ''],
      [t('speed'), `${selectedRecord.speed ?? '—'} ${selectedRecord.speed === null ? '' : 'm/min'}`],
      [t('temperature'), `${selectedRecord.temperature ?? '—'} ${selectedRecord.temperature === null ? '' : '°C'}`],
      [t('cylinderTemperature'), `${selectedRecord.cylinderTemperature ?? '—'} ${selectedRecord.cylinderTemperature === null ? '' : '°C'}`],
      [t('production'), ''],
      [t('inputMeters'), `${selectedRecord.inputFabricMeters ?? '—'} ${selectedRecord.inputFabricMeters === null ? '' : 'm'}`],
      [t('outputMeters'), `${selectedRecord.outputFabricMeters ?? '—'} ${selectedRecord.outputFabricMeters === null ? '' : 'm'}`],
      [language === 'vi' ? 'Hao hụt' : 'Loss', `${selectedRecord.lossMeters ?? '—'} ${selectedRecord.lossMeters === null ? '' : 'm'}`],
      [t('status'), statusFor(selectedRecord)],
      ...warningsFor(selectedRecord).map((warning) => [t('warning'), warning] as [string, string]),
    ];

    autoTable(document, {
      startY: 10,
      head: [['FIELD', 'VALUE']],
      body: detailRows,
      theme: 'grid',
      styles: { font: 'Arial', fontSize: 9, cellPadding: 3, textColor: [36, 59, 74], lineColor: [196, 208, 214], lineWidth: 0.2 },
      headStyles: { font: 'Arial', fillColor: [71, 98, 113], textColor: [255, 255, 255], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [244, 248, 250] },
      columnStyles: { 0: { cellWidth: 62, fontStyle: 'bold' }, 1: { cellWidth: 118 } },
      didParseCell: (data) => {
        if (data.section === 'body' && [7, 13, 17].includes(data.row.index)) {
          data.cell.styles.fillColor = [71, 98, 113];
          data.cell.styles.textColor = [255, 255, 255];
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });
    document.save(`scouring-record-${selectedRecord.id}.pdf`);
  };

  return <WS3Shell title="WS3 / Scouring History" subtitle="Stored Scouring records · PostgreSQL" machineId="SC-01" machineLabel="Scouring" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <div className="scouring-screen-frame scouring-full-width-frame mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <section className="shrink-0 border-b-2 border-industrialDark">
        <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">{t('recordFilters')}</h2><span className="font-mono text-[10px] uppercase tracking-wider">{filteredRecords.length} / {records.length}</span></header>
        <div className="bg-hmiSection p-2"><div className="grid items-end gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(180px,0.8fr)_minmax(260px,2fr)_36px]">
          <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{t('recordedTime')}<input type="date" className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={orderProgress} onChange={(event) => setOrderProgress(event.target.value as OrderProgress | '')}><option value="">{language === 'vi' ? 'Tất cả tiến độ' : 'All progress'}</option><option value="IN_PROGRESS">{orderProgressLabel('IN_PROGRESS', language)}</option><option value="COMPLETED">{orderProgressLabel('COMPLETED', language)}</option><option value="UNKNOWN">{orderProgressLabel('UNKNOWN', language)}</option></select></label>
          <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">{language === 'vi' ? 'Kết quả thông số' : 'Parameter result'}<select className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={status} onChange={(event) => setStatus(event.target.value as RecordStatus | '')}><option value="">{t('allStatuses')}</option><option value="COMPLETE">{t('complete')}</option><option value="WARNING">{t('warning')}</option><option value="INCOMPLETE">{t('incomplete')}</option></select></label>
          <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600 sm:col-span-2 xl:col-span-1">{language === 'vi' ? 'Đơn hàng / Người vận hành' : 'Order / Operator'}<input className="min-h-9 border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial" value={operatorSearch} onChange={(event) => setOperatorSearch(event.target.value)} placeholder={language === 'vi' ? 'Mã đơn, tên hoặc ID nhân viên…' : 'Order, name or employee ID…'} /></label>
          <button type="button" className="inline-flex min-h-9 w-9 items-center justify-center border-2 border-line bg-white text-lg font-bold leading-none text-industrialDark hover:border-industrialDark hover:bg-hmiHover" onClick={clearFilters} aria-label={t('clearFilters')} title={t('clearFilters')}>×</button>
        </div></div>
      </section>
      <div className="min-h-0 flex-1">
        <section className="flex h-full min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white">
            <h2 className="text-xs font-bold uppercase tracking-wider">{t('history')}</h2>
            <div className="flex items-center gap-2"><span className="hidden text-[10px] font-semibold uppercase text-slate-300 sm:inline">{t('newestFirst')}</span><HMIButton size="compact" className="!min-h-6 !px-2 !py-1 !text-[9px]" onClick={exportPdf} disabled={!selectedRecord}>{t('overview')} PDF</HMIButton></div>
          </header>
          {loading ? <div className="p-6 text-center text-xs font-bold uppercase tracking-wide text-slate-500">{t('loadingRecords')}</div>
            : error ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-alarm"><p>{t('unableToLoadRecords')}</p><p className="mt-1 font-normal normal-case">{error}</p><HMIButton size="compact" className="mt-3" onClick={() => window.location.reload()}>{t('retry')}</HMIButton></div>
              : filteredRecords.length === 0 ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">{records.length === 0 ? t('noRecords') : t('noMatchingRecords')}</div>
                : <><p className="shrink-0 px-2 py-1 text-[9px] font-semibold text-slate-500 sm:hidden">{language === 'vi' ? 'Vuốt ngang để xem đầy đủ thông tin' : 'Swipe horizontally to see all columns'}</p><div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[2500px] border-collapse text-left text-[10px]"><thead className="sticky top-0 z-10 bg-industrial text-[9px] uppercase tracking-wider text-white"><tr>{[t('recordedTime'),t('machine'),t('orderNumber'),t('item'),t('lotYarn'),t('lotNumber'),t('operator'),language === 'vi' ? 'ID nhân viên' : 'Employee ID',language === 'vi' ? 'Ca' : 'Shift',language === 'vi' ? 'Tiến độ đơn' : 'Order progress','NaOH (L)','Soap (L)','Desizer (L)','H2O2 (L)','Chelate (L)',`${t('speed')} (m/min)`,`${t('temperature')} (°C)`,language === 'vi' ? 'Nhiệt độ lô gia (°C)' : 'Cylinder temp. (°C)',language === 'vi' ? 'Mét đầu vào' : 'Input (m)',language === 'vi' ? 'Mét đầu ra' : 'Output (m)',language === 'vi' ? 'Sản lượng' : 'Production (m)',language === 'vi' ? 'Hao hụt (m)' : 'Loss (m)',t('phInspection'),language === 'vi' ? 'Kết quả' : 'Result'].map((heading) => <th key={heading} className="whitespace-nowrap px-2 py-2">{heading}</th>)}</tr></thead><tbody>{filteredRecords.map((record) => <tr key={record.id} className={`cursor-pointer border-b border-line hover:bg-hmiHover ${selectedRecord?.id === record.id ? 'bg-hmiSelected' : 'bg-white'}`} onClick={() => { setSelectedId(record.id); setPhDialogOpen(false); }}>
                  <td className="sticky left-0 z-[1] whitespace-nowrap border-r border-line bg-inherit px-2 py-2 font-mono font-semibold">{formatDateTime(record.recordedAt)}</td><td className="whitespace-nowrap px-2 py-2">{record.machineId}</td><td className="whitespace-nowrap px-2 py-2 font-mono font-bold text-industrial">{record.orderNumber || '—'}</td><td className="max-w-[260px] truncate px-2 py-2" title={record.item || ''}>{record.item || '—'}</td><td className="whitespace-nowrap px-2 py-2">{record.lotYarn || '—'}</td><td className="whitespace-nowrap px-2 py-2">{record.lotNumber || '—'}</td><td className="whitespace-nowrap px-2 py-2">{record.operatorName || '—'}</td><td className="whitespace-nowrap px-2 py-2 font-mono">{record.operatorIdentifier || '—'}</td><td className="whitespace-nowrap px-2 py-2">{record.shift || '—'}</td><td className="whitespace-nowrap px-2 py-2"><OrderProgressBadge progress={record.orderProgress ?? 'UNKNOWN'} language={language} /></td>
                  {[record.naoh,record.soap,record.desizer,record.h2o2,record.chelate].map((value, index) => <td key={index} className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(value)}</td>)}<td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.speed)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.temperature)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.cylinderTemperature)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.inputFabricMeters)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.outputFabricMeters)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.productionQuantityMeters)}</td><td className="whitespace-nowrap px-2 py-2 text-right font-mono">{formatValue(record.lossMeters)}</td><td className="whitespace-nowrap px-2 py-2">{phInspectionCounts[record.id] ? <button type="button" className="font-bold text-industrial underline" onClick={(event) => { event.stopPropagation(); setSelectedId(record.id); setPhDialogOpen(true); }}>{t('view')} ({phInspectionCounts[record.id]})</button> : '—'}</td><td className="whitespace-nowrap px-2 py-2"><StatusText record={record} label={(value) => value === 'COMPLETE' ? t('complete') : value === 'WARNING' ? t('warning') : t('incomplete')} /></td>
                </tr>)}</tbody></table></div></>}
        </section>
      </div>
      </div>
      {phDialogOpen ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 p-3" role="presentation" onClick={() => setPhDialogOpen(false)}><section role="dialog" aria-modal="true" aria-labelledby="ph-dialog-title" className="flex max-h-[85vh] w-full max-w-xl flex-col border-2 border-industrialDark bg-white shadow-xl" onClick={(event) => event.stopPropagation()}><header className="flex items-center justify-between bg-industrialDark px-3 py-2 text-white"><h2 id="ph-dialog-title" className="text-xs font-bold uppercase">{t('phInspection')} · {selectedRecord?.orderNumber || `ID ${selectedRecord?.id ?? ''}`}</h2><button type="button" aria-label={t('cancel')} className="px-2 text-lg" onClick={() => setPhDialogOpen(false)}>×</button></header><div className="min-h-0 overflow-auto">{phInspections.length ? <PhInspectionGroup inspections={phInspections} /> : <p className="p-5 text-center text-xs text-slate-500">{language === 'vi' ? 'Chưa có dữ liệu pH.' : 'No pH inspection data.'}</p>}</div></section></div> : null}
    </div>
  </WS3Shell>;
}
