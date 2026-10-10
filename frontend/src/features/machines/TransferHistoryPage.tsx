import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { downloadTransferReport, listTransferRecords, type TransferRecord } from './transferApi';

export function TransferHistoryPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const [date, setDate] = useState('');
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listTransferRecords(date || undefined).then((rows) => { if (active) setRecords(rows); })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : (vi ? 'Không tải được lịch sử máy ép.' : 'Unable to load transfer history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [date, vi]);

  const filtered = records;
  const exportExcel = async () => {
    setExporting(true);
    setError('');
    try {
      const blob = await downloadTransferReport(date || undefined, language);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ht-transfer-report-${date || 'all'}.xlsx`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : (vi ? 'Không xuất được Excel.' : 'Unable to export Excel.')); }
    finally { setExporting(false); }
  };

  return <WS3Shell title="WS3 / Transfer" subtitle={vi ? 'Lịch sử sản xuất · Máy ép' : 'Production history · Transfer'} machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'Transfer'} status="info" showGlobalNavigation={false} showMachineNavigation={false}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <MachineNavigation machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'Transfer'} basePath="/machine/HT-01" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{vi ? 'TRANG CHỦ' : 'HOME'}</HMIButton>} />
      <main className="min-h-0 flex-1 p-2">
        <section className="mx-auto flex h-full max-w-[1600px] flex-col overflow-hidden border-2 border-industrialDark bg-white">
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-xs font-bold uppercase tracking-wide text-white">
            <h1>{vi ? 'LỊCH SỬ SẢN XUẤT' : 'PRODUCTION HISTORY'}</h1>
            <div className="flex items-center gap-2"><span className="hidden sm:inline">{vi ? 'Mới nhất trước' : 'Newest first'}</span><HMIButton size="compact" variant="secondary" disabled={loading || exporting || filtered.length === 0} onClick={() => void exportExcel()}>{exporting ? (vi ? 'ĐANG XUẤT…' : 'EXPORTING…') : 'EXCEL'}</HMIButton></div>
          </header>
          <section className="shrink-0 border-b-2 border-industrialDark bg-hmiSection p-2">
            <div className="grid grid-cols-[minmax(0,360px)_40px] items-end gap-2">
              <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'Ngày sản xuất' : 'Production date'}<input type="date" className="min-h-10 min-w-0 border-2 border-line bg-white px-2 text-xs font-semibold text-industrialDark" value={date} onChange={(event) => setDate(event.target.value)} /></label>
              <button type="button" aria-label={vi ? 'Xem tất cả' : 'Show all'} title={vi ? 'Xem tất cả' : 'Show all'} onClick={() => setDate('')} className="inline-flex h-10 w-10 items-center justify-center border-2 border-line bg-white text-lg font-bold text-industrial hover:bg-hmiHover">×</button>
            </div>
          </section>
          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? <p className="p-8 text-center text-xs font-bold uppercase text-slate-500">{vi ? 'Đang tải lịch sử…' : 'Loading history…'}</p> : error ? <p role="alert" className="p-8 text-center text-xs font-semibold text-alarm">{error}</p> : filtered.length === 0 ? <p className="p-8 text-center text-xs font-semibold uppercase text-slate-500">{vi ? 'Chưa có bản ghi phù hợp.' : 'No matching records.'}</p> :
              <table className="w-full min-w-[1100px] border-collapse text-left text-[10px]"><thead><tr>{(vi ? ['Ngày giờ', 'SOP', 'Loại vải', 'Người mua', 'Thiết kế', 'Nhiệt độ °C', 'Tốc độ m/min', 'Sản lượng m', 'Ca', 'Người vận hành'] : ['Date & time', 'SOP', 'Item', 'Buyer', 'Design', 'Temp °C', 'Speed m/min', "Q'ty m", 'Shift', 'Operator']).map((label) => <th key={label} className="sticky top-0 z-10 border-r border-b border-line bg-hmiSection px-2 py-2 text-[9px] font-bold uppercase">{label}</th>)}</tr></thead><tbody>{filtered.map((record) => <tr key={record.id} className="border-b border-line odd:bg-white even:bg-slate-50"><td className="whitespace-nowrap px-2 py-2 font-mono">{new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recorded_at))}</td><td className="px-2 py-2 font-mono font-bold">{record.order_number}</td><td className="px-2 py-2">{record.item}</td><td className="px-2 py-2">{record.buyer}</td><td className="px-2 py-2">{record.design}</td><td className="px-2 py-2 text-right font-mono">{record.temperature}</td><td className="px-2 py-2 text-right font-mono">{record.speed}</td><td className="px-2 py-2 text-right font-mono">{record.quantity_meters}</td><td className="px-2 py-2">{record.shift}</td><td className="px-2 py-2">{record.operator_name} · {record.operator_identifier}</td></tr>)}</tbody></table>}
          </div>
          <footer className="shrink-0 border-t border-line bg-hmiSection px-3 py-1 text-right font-mono text-[10px] font-bold uppercase text-slate-500">{filtered.length} / {records.length} {vi ? 'bản ghi' : 'records'}</footer>
        </section>
      </main>
    </div>
  </WS3Shell>;
}
