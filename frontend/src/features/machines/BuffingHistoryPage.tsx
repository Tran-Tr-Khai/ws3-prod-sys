import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { downloadBuffingReport, getBuffingChecks, type BuffingCheck } from './scouringApi';

const dateForRecord = (record: BuffingCheck) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(record.checkedAt));
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

export function BuffingHistoryPage() {
  const navigate = useNavigate();
  const { language, t } = useLanguage();
  const [date, setDate] = useState(today);
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
  return <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} title={`WS3 / ${language === 'vi' ? 'LỊCH SỬ BUFFING' : 'BUFFING HISTORY'}`} subtitle={`${t('periodicChecklist')} · Buffing`} machineId="BU-01" machineLabel="Buffing" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <MachineNavigation machineId="BU-01" machineLabel="Buffing" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('home')}</HMIButton>} />
      <div className="buffing-page-content min-h-0 flex-1 p-2">
        <div className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
          <header className="flex shrink-0 items-center justify-between gap-2 bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white"><h1>{t('history')}</h1><div className="flex items-center gap-2"><span className="hidden sm:inline">{language === 'vi' ? 'Mới nhất trước' : 'Newest first'}</span><HMIButton size="compact" variant="secondary" onClick={() => void exportExcel()} disabled={loading || exporting || filteredRecords.length === 0}>{exporting ? (language === 'vi' ? 'ĐANG XUẤT…' : 'EXPORTING…') : `${t('overview')} EXCEL`}</HMIButton></div></header>
          <section className="shrink-0 border-b-2 border-industrialDark bg-hmiSection p-2"><div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] items-end justify-start gap-2 sm:grid-cols-[minmax(0,360px)_minmax(0,420px)_40px]">
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Ngày ghi' : 'Record date'}<input type="date" className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={date} onChange={(event) => { setDate(event.target.value); setOrderNumber(''); }} /></label>
            <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'Đơn sản xuất' : 'Production order'}<select className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={orderNumber} onChange={(event) => setOrderNumber(event.target.value)}><option value="">{language === 'vi' ? 'TẤT CẢ ĐƠN' : 'ALL ORDERS'}</option>{orderOptions.map((order) => <option key={order} value={order}>{order}</option>)}</select></label>
            <button type="button" aria-label={language === 'vi' ? 'Xóa ngày, xem tất cả' : 'Clear date, show all'} title={language === 'vi' ? 'Xóa ngày · Xem tất cả' : 'Clear date · Show all'} onClick={() => { setDate(''); setOrderNumber(''); }} className="inline-flex h-10 w-10 items-center justify-center border-2 border-line bg-white text-lg font-bold leading-none text-industrial hover:bg-hmiHover">×</button>
          </div></section>
          <div className="flex min-h-0 flex-1">
            <section className="flex min-h-0 min-w-0 flex-1 flex-col">
              {loading ? <div className="p-8 text-center text-xs font-bold uppercase text-slate-500">{t('loadingHistory')}</div> : error ? <div className="p-8 text-center text-xs font-semibold text-alarm">{error}<div><HMIButton size="compact" className="mt-3" onClick={() => window.location.reload()}>{t('retry')}</HMIButton></div></div> : filteredRecords.length === 0 ? <div className="p-8 text-center text-xs font-semibold uppercase text-slate-500">{records.length === 0 ? (language === 'vi' ? 'Chưa có bản ghi Buffing.' : 'No Buffing records yet.') : (language === 'vi' ? 'Không có bản ghi khớp bộ lọc.' : 'No records match these filters.')}</div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[950px] border-collapse text-left text-[10px]"><thead className="text-[9px] uppercase tracking-wide text-white"><tr>{[language === 'vi' ? 'Ngày giờ' : 'Date & time', t('orderNumber'), t('operator'), language === 'vi' ? 'Ca' : 'Shift', ...[1, 2, 3, 4, 5].map((point) => `${language === 'vi' ? 'Điểm' : 'Check'} ${point}`), language === 'vi' ? 'Ảnh' : 'Images'].map((heading, index) => <th key={index} scope="col" className={`sticky top-0 z-30 border-r border-white/20 bg-industrial px-2 py-2 ${index >= 4 ? 'text-center' : 'text-left'} last:border-r-0`}>{heading}</th>)}</tr></thead><tbody>{filteredRecords.map((record) => (
                <tr key={record.id} className="border-b border-line hover:bg-hmiHover"><td className="whitespace-nowrap px-2 py-2 font-mono font-bold">{new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(record.checkedAt))}</td><td className="px-2 py-2 font-mono font-semibold">{record.orderNumber || '—'}</td><td className="px-2 py-2">{record.operatorName || record.operatorIdentifier || '—'}</td><td className="px-2 py-2">{record.shift || '—'}</td>{record.checks.map((passed, index) => <td key={index} className={`px-2 py-2 text-center text-base font-bold ${passed ? 'text-success' : 'text-alarm'}`} aria-label={`${language === 'vi' ? 'Điểm' : 'Check'} ${index + 1}: ${passed ? (language === 'vi' ? 'Đạt' : 'Pass') : (language === 'vi' ? 'Cảnh báo' : 'Alert')}`}>{passed ? '✓' : '×'}</td>)}<td className="relative z-0 px-2 py-2 text-center">{record.images.length ? (() => { const image = record.images.find((item) => item.isPrimary) ?? record.images[0]; return unavailableImages.has(image.id) ? <span className="inline-flex h-12 w-16 items-center justify-center border border-warning bg-hmiWarning px-1 text-[8px] font-bold text-warning" title={image.originalName}>{language === 'vi' ? 'LỖI ẢNH' : 'IMAGE ERROR'}</span> : <button type="button" draggable={false} className="relative z-0 inline-flex select-none border border-line bg-hmiSection" onClick={() => setImagePreview({ url: image.url, name: image.originalName })} onDragStart={(event) => event.preventDefault()} aria-label={language === 'vi' ? `Xem ảnh ${image.originalName}` : `View image ${image.originalName}`}><img src={image.url} alt={image.originalName} className="pointer-events-none h-12 w-16 select-none object-cover" loading="lazy" decoding="async" draggable={false} onError={() => setUnavailableImages((current) => new Set(current).add(image.id))} />{record.images.length > 1 && <span className="pointer-events-none absolute bottom-0 right-0 bg-industrial px-1 text-[8px] font-bold text-white">+{record.images.length - 1}</span>}</button>; })() : '—'}</td></tr>
              ))}</tbody></table></div>}
            </section>
          </div>
          <footer className="shrink-0 border-t border-line bg-hmiSection px-3 py-1 text-right font-mono text-[10px] font-bold uppercase text-slate-500">{filteredRecords.length} / {records.length} {language === 'vi' ? 'bản ghi' : 'records'}</footer>
        </div>
      </div>
    </div>
    {imagePreview && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-label={t('buffingImages')} onClick={() => setImagePreview(null)}><button type="button" className="absolute right-4 top-3 text-3xl text-white" aria-label={t('closeGallery')} onClick={() => setImagePreview(null)}>×</button><img src={imagePreview.url} alt={imagePreview.name} className="max-h-[90vh] max-w-[92vw] object-contain" /></div>}
  </WS3Shell>;
}
