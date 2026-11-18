import { useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { MesDataCell } from '../../components/mes/MesDataCell';
import { MesResizableHeaderCell, MesResizableTable } from '../../components/mes/MesResizableTable';
import { formatShiftLabel } from '../../components/hmi/ShiftSelect';
import { useLanguage } from '../../i18n/LanguageContext';
import { downloadBuffingReport, getBuffingChecks, type BuffingCheck } from './scouringApi';
import './BuffingPage.css';
import '../../components/mes/MesDataTable.css';

function OrderProgressBadge({ progress, language }: { progress: BuffingCheck['orderProgress']; language: string }) {
  if (!progress) return <span className="text-slate-400">—</span>;
  const completed = progress === 'COMPLETED';
  return <span className={`buffing-history__progress ${completed ? 'is-completed' : 'is-progress'}`}>
    {completed ? (language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : (language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS')}
  </span>;
}

const dateForRecord = (record: BuffingCheck) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.checkedAt));

function BuffingHistoryNavigation({ language }: { language: string }) {
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  return <nav className="buffing-mes-nav" aria-label={tx('Điều hướng Buffing', 'Buffing navigation')}>
    <NavLink end to="/ws3">{tx('Máy móc', 'Machinery')}</NavLink>
    <NavLink end to="/machine/buffing/record">{tx('Vận hành', 'Operation')}</NavLink>
    <NavLink to="/machine/buffing/history">{tx('Lịch sử', 'History')}</NavLink>
  </nav>;
}

export function BuffingHistoryPage() {
  const { language, t } = useLanguage();
  const [date, setDate] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [imagePreview, setImagePreview] = useState<{ url: string; name: string } | null>(null);
  const [unavailableImages, setUnavailableImages] = useState<Set<number>>(() => new Set());
  const [records, setRecords] = useState<BuffingCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void getBuffingChecks(undefined, { signal: controller.signal }).then((loaded) => {
      setRecords(loaded);
      setOrderNumber((current) => loaded.some((record) => record.orderNumber?.trim() === current) ? current : '');
    }).catch((reason) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return;
      setRecords([]);
      setError(reason instanceof Error ? reason.message : (language === 'vi' ? 'Không thể tải lịch sử Buffing.' : 'Unable to load Buffing history.'));
    }).finally(() => setLoading(false));
    return () => controller.abort();
  }, [language]);

  const dateFilteredRecords = useMemo(() => records.filter((record) => !date || dateForRecord(record) === date), [records, date]);
  const orderOptions = useMemo(() => [...new Set(dateFilteredRecords.map((record) => record.orderNumber?.trim()).filter((value): value is string => Boolean(value)))].sort((a, b) => a.localeCompare(b)), [dateFilteredRecords]);
  const filteredRecords = useMemo(() => dateFilteredRecords.filter((record) => !orderNumber || record.orderNumber?.trim() === orderNumber), [dateFilteredRecords, orderNumber]);
  const exportExcel = async () => {
    if (loading || exporting || filteredRecords.length === 0) return;
    setExporting(true);
    setError(null);
    try {
      const blob = await downloadBuffingReport(date || undefined, language === 'vi' ? 'vi' : 'en', orderNumber || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `buffing-report-${date || 'all'}${orderNumber ? `-${orderNumber}` : ''}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : (language === 'vi' ? 'Không thể tải báo cáo Excel.' : 'Unable to download Excel report.'));
    } finally {
      setExporting(false);
    }
  };
  return <WS3MesShell module="Buffing" breadcrumbs={[]} navigation={<BuffingHistoryNavigation language={language} />}>
    <div className="buffing-history-page">
      <div className="buffing-history-page__workspace">
          <section className="buffing-history-page__filters shrink-0 border-b-2 border-industrialDark bg-hmiSection p-2"><div className="buffing-history-page__filterbar"><div className="buffing-history-page__filter-fields">
            <label>{language === 'vi' ? 'Ngày ghi' : 'Record date'}<input type="date" className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={date} onChange={(event) => { setDate(event.target.value); setOrderNumber(''); }} /></label>
            <label>SOP<select className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold normal-case text-industrialDark" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)}><option value="">{language === 'vi' ? 'Tất cả SOP' : 'All SOPs'}</option>{orderOptions.map((order) => <option key={order} value={order}>{order}</option>)}</select></label>
          </div><button type="button" className="buffing-history-page__export-button" onClick={() => void exportExcel()} disabled={loading || exporting || filteredRecords.length === 0}>{exporting ? (language === 'vi' ? 'ĐANG XUẤT…' : 'EXPORTING…') : (language === 'vi' ? 'Xuất Excel' : 'Export Excel')}</button></div></section>
          <div className="flex min-h-0 flex-1">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              {loading ? <div className="p-8 text-center text-xs font-bold uppercase text-slate-500">{t('loadingHistory')}</div> : error ? <div className="p-8 text-center text-xs font-semibold text-alarm">{error}<div><button type="button" className="buffing-mes__secondary-button mt-3" onClick={() => window.location.reload()}>{t('retry')}</button></div></div> : filteredRecords.length === 0 ? <div className="p-8 text-center text-xs font-semibold uppercase text-slate-500">{records.length === 0 ? (language === 'vi' ? 'Chưa có bản ghi Buffing.' : 'No Buffing records yet.') : (language === 'vi' ? 'Không có bản ghi khớp bộ lọc.' : 'No records match these filters.')}</div> : <div className="min-h-0 flex-1 overflow-auto"><MesResizableTable initialWidths={[155, 150, 140, 85, 60, 60, 60, 60, 60, 110, 120]} storageKey="buffing-history" className="mes-data-table w-full min-w-[1060px] border-collapse text-left text-[10px]"><thead className="text-[9px] uppercase tracking-wide text-white"><tr>{[language === 'vi' ? 'Ngày giờ' : 'Date & time', 'SOP', t('operator'), language === 'vi' ? 'Ca' : 'Shift', ...[1, 2, 3, 4, 5].map((point) => `${language === 'vi' ? 'Điểm' : 'Check'} ${point}`), language === 'vi' ? 'Ảnh' : 'Images', language === 'vi' ? 'Tiến độ đơn' : 'Order progress'].map((heading, index) => <MesResizableHeaderCell key={index} index={index} scope="col" className={`sticky top-0 z-30 border-r border-white/20 bg-industrial px-2 py-2 ${index >= 4 ? 'text-center' : 'text-left'} last:border-r-0`}>{heading}</MesResizableHeaderCell>)}</tr></thead><tbody>{filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-line hover:bg-hmiHover"><MesDataCell tooltip={new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.checkedAt))} className="whitespace-nowrap px-2 py-2 font-mono font-bold">{new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.checkedAt))}</MesDataCell><MesDataCell tooltip={record.orderNumber || '—'} className="px-2 py-2 font-mono font-semibold">{record.orderNumber || '—'}</MesDataCell><MesDataCell tooltip={record.operatorName || record.operatorIdentifier || '—'} className="px-2 py-2">{record.operatorName || record.operatorIdentifier || '—'}</MesDataCell><MesDataCell tooltip={formatShiftLabel(record.shift, language)} className="px-2 py-2">{formatShiftLabel(record.shift, language) || '—'}</MesDataCell>{record.checks.map((passed, index) => <td key={index} className={`px-2 py-2 text-center text-base font-bold ${passed ? 'text-success' : 'text-alarm'}`} aria-label={`${language === 'vi' ? 'Điểm' : 'Check'} ${index + 1}: ${passed ? (language === 'vi' ? 'Đạt' : 'Pass') : (language === 'vi' ? 'Cảnh báo' : 'Alert')}`}>{passed ? '✓' : '×'}</td>)}<td className="relative z-0 px-2 py-2 text-center">{record.images.length ? (() => { const image = record.images.find((item) => item.isPrimary) ?? record.images[0]; return unavailableImages.has(image.id) ? <span className="inline-flex h-12 w-16 items-center justify-center border border-warning bg-hmiWarning px-1 text-[8px] font-bold text-warning">{language === 'vi' ? 'LỖI ẢNH' : 'IMAGE ERROR'}</span> : <button type="button" draggable={false} className="relative z-0 inline-flex select-none border border-line bg-hmiSection" onClick={() => setImagePreview({ url: image.url, name: image.originalName })} onDragStart={(event) => event.preventDefault()} aria-label={language === 'vi' ? `Xem ảnh ${image.originalName}` : `View image ${image.originalName}`}><img src={image.url} alt={image.originalName} className="pointer-events-none h-12 w-16 select-none object-cover" loading="lazy" decoding="async" draggable={false} onError={() => setUnavailableImages((current) => new Set(current).add(image.id))} />{record.images.length > 1 && <span className="pointer-events-none absolute bottom-0 right-0 bg-industrial px-1 text-[8px] font-bold text-white">+{record.images.length - 1}</span>}</button>; })() : '—'}</td><MesDataCell tooltip={record.orderProgress === 'COMPLETED' ? (language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : (language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS')} className="px-2 py-2"><OrderProgressBadge progress={record.orderProgress} language={language} /></MesDataCell></tr>
              ))}</tbody></MesResizableTable></div>}
            </section>
          </div>
          <footer className="shrink-0 border-t border-line bg-hmiSection px-3 py-1 text-right font-mono text-[10px] font-bold uppercase text-slate-500">{filteredRecords.length} / {records.length} {language === 'vi' ? 'bản ghi' : 'records'}</footer>
      </div>
    </div>
    {imagePreview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={t('buffingImages')} onClick={() => setImagePreview(null)}><button type="button" className="absolute right-4 top-3 text-3xl text-white" aria-label={t('closeGallery')} onClick={() => setImagePreview(null)}>×</button><img src={imagePreview.url} alt={imagePreview.name} className="max-h-[90vh] max-w-[92vw] object-contain" /></div>}
  </WS3MesShell>;
}
