import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { downloadPrintReport, listPrintRecords, type PrintRecord } from './printApi';

type OrderProgress = '' | PrintRecord['order_progress'];
const factoryToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function ProgressBadge({ progress, vi }: { progress: PrintRecord['order_progress']; vi: boolean }) {
  const completed = progress === 'COMPLETED';
  return <span className={`inline-flex whitespace-nowrap border px-1.5 py-0.5 text-[9px] font-bold uppercase ${completed ? 'border-green-600 bg-green-100 text-green-800' : 'border-blue-500 bg-blue-100 text-blue-800'}`}>{completed ? (vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : (vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS')}</span>;
}

export function PrintHistoryPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const [date, setDate] = useState(factoryToday);
  const [orderProgress, setOrderProgress] = useState<OrderProgress>('');
  const [search, setSearch] = useState('');
  const [records, setRecords] = useState<PrintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void listPrintRecords().then((rows) => { if (active) setRecords(rows); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : (vi ? 'Không tải được lịch sử máy in.' : 'Unable to load print history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [vi]);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return records.filter((record) => {
      const matchesDate = !date || record.production_date === date;
      const matchesProgress = !orderProgress || record.order_progress === orderProgress;
      const haystack = [record.order_number, record.item, record.buyer, record.design, record.operator_name, record.operator_identifier, record.shift].join(' ').toLocaleLowerCase();
      return matchesDate && matchesProgress && (!term || haystack.includes(term));
    });
  }, [date, orderProgress, records, search]);

  const clearFilters = () => { setDate(''); setOrderProgress(''); setSearch(''); };

  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await downloadPrintReport(date || undefined, language, orderProgress || undefined, search.trim() || undefined);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `print-report-${date || 'all'}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : (vi ? 'Không xuất được Excel.' : 'Unable to export Excel.')); }
    finally { setExporting(false); }
  };

  return <WS3Shell title="WS3 / Print" subtitle={vi ? 'Lịch sử sản xuất · Máy in' : 'Production history · Print'} machineId="PR-01" machineLabel={vi ? 'Máy in' : 'Print'} status="info" showGlobalNavigation={false} showMachineNavigation={false}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <MachineNavigation machineId="PR-01" machineLabel={vi ? 'Máy in' : 'Print'} basePath="/machine/PR-01" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{vi ? 'TRANG CHỦ' : 'HOME'}</HMIButton>} />
      <main className="min-h-0 flex-1 p-2">
        <section className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
          <header className="machine-primary-header flex shrink-0 flex-wrap items-center justify-between gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wide">
            <h1>{vi ? 'LỊCH SỬ SẢN XUẤT' : 'PRODUCTION HISTORY'}</h1>
            <HMIButton size="compact" variant="secondary" disabled={loading || exporting || filtered.length === 0} onClick={() => void exportExcel()}>{exporting ? (vi ? 'ĐANG XUẤT…' : 'EXPORTING…') : (vi ? 'BÁO CÁO EXCEL' : 'EXCEL REPORT')}</HMIButton>
          </header>
          <section className="shrink-0 border-b-2 border-industrialDark bg-hmiSection p-2">
            <div className="grid items-end gap-2 sm:grid-cols-2 xl:grid-cols-[minmax(150px,0.8fr)_minmax(180px,0.9fr)_minmax(260px,2fr)_40px]">
              <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'Ngày sản xuất' : 'Production date'}<input type="date" className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'Tiến độ đơn' : 'Order progress'}<select className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={orderProgress} onChange={(event) => setOrderProgress(event.target.value as OrderProgress)}><option value="">{vi ? 'Tất cả tiến độ' : 'All progress'}</option><option value="IN_PROGRESS">{vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option><option value="COMPLETED">{vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option></select></label>
              <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'Tìm đơn / sản phẩm / người vận hành' : 'Search order / item / operator'}<input className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={vi ? 'Mã SOP, loại vải, người mua, thiết kế, tên hoặc ID…' : 'SOP, item, buyer, design, name or ID…'} /></label>
              <button type="button" aria-label={vi ? 'Xóa bộ lọc' : 'Clear filters'} title={vi ? 'Xóa bộ lọc' : 'Clear filters'} onClick={clearFilters} className="inline-flex h-10 w-10 items-center justify-center border-2 border-line bg-white text-lg font-bold text-industrial hover:bg-hmiHover">×</button>
            </div>
          </section>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? <p className="p-8 text-center text-xs font-bold uppercase text-slate-500">{vi ? 'Đang tải lịch sử…' : 'Loading history…'}</p> : error ? <p role="alert" className="p-8 text-center text-xs font-semibold text-alarm">{error}</p> : filtered.length === 0 ? <p className="p-8 text-center text-xs font-semibold uppercase text-slate-500">{vi ? 'Chưa có bản ghi phù hợp.' : 'No matching records.'}</p> :
              <table className="w-full min-w-[1350px] border-collapse text-left text-[10px]"><thead className="sticky top-0 z-10 bg-industrial text-[9px] uppercase tracking-wider text-white"><tr>
                <th rowSpan={2} className="whitespace-nowrap border-r border-line px-3 py-2">{vi ? 'Ngày giờ ghi' : 'Recorded date & time'}</th>
                <th colSpan={4} className="border-r border-line px-3 py-2 text-center">{vi ? 'Thông tin đơn hàng' : 'Order information'}</th>
                <th colSpan={2} className="border-r border-line px-3 py-2 text-center">{vi ? 'Thông số sản xuất' : 'Production parameters'}</th>
                <th colSpan={3} className="border-r border-line px-3 py-2 text-center">{vi ? 'Thông tin vận hành' : 'Operation information'}</th>
                <th rowSpan={2} className="whitespace-nowrap px-3 py-2">{vi ? 'Tiến độ đơn' : 'Order progress'}</th>
              </tr><tr>
                {(vi ? ['SOP', 'Loại vải', 'Người mua', 'Thiết kế', 'Tốc độ (m/min)', 'Sản lượng (m)', 'Ca', 'Người vận hành', 'ID nhân viên'] : ['SOP', 'Item', 'Buyer', 'Design', 'Speed (m/min)', "Q'ty (m)", 'Shift', 'Operator', 'Employee ID']).map((label, index) => <th key={`${label}-${index}`} className="whitespace-nowrap border-r border-line px-3 py-2">{label}</th>)}
              </tr></thead><tbody>{filtered.map((record) => <tr key={record.id} className="border-b border-line odd:bg-white even:bg-slate-50 hover:bg-hmiHover">
                <td className="whitespace-nowrap border-r border-line px-3 py-2 font-mono font-bold text-industrial">{new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recorded_at))}</td>
                <td className="whitespace-nowrap border-r border-line px-3 py-2 font-mono font-bold text-industrial">{record.order_number || '—'}</td><td className="max-w-[260px] truncate border-r border-line px-3 py-2" title={record.item}>{record.item || '—'}</td><td className="whitespace-nowrap border-r border-line px-3 py-2">{record.buyer || '—'}</td><td className="whitespace-nowrap border-r border-line px-3 py-2">{record.design || '—'}</td>
                <td className="whitespace-nowrap border-r border-line px-3 py-2 text-right font-mono">{record.speed.toLocaleString(vi ? 'vi-VN' : 'en-US')}</td><td className="whitespace-nowrap border-r border-line px-3 py-2 text-right font-mono">{record.quantity_meters.toLocaleString(vi ? 'vi-VN' : 'en-US')}</td><td className="whitespace-nowrap border-r border-line px-3 py-2">{record.shift || '—'}</td><td className="whitespace-nowrap border-r border-line px-3 py-2">{record.operator_name || '—'}</td><td className="whitespace-nowrap border-r border-line px-3 py-2 font-mono">{record.operator_identifier || '—'}</td><td className="px-3 py-2"><ProgressBadge progress={record.order_progress} vi={vi} /></td>
              </tr>)}</tbody></table>}
          </div>
          <footer className="shrink-0 border-t border-line bg-hmiSection px-3 py-1 text-right font-mono text-[10px] font-bold uppercase text-slate-500">{filtered.length} / {records.length}</footer>
        </section>
      </main>
    </div>
  </WS3Shell>;
}
