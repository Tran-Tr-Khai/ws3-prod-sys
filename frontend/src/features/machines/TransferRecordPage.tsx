import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { createTransferRecord, downloadTransferReport, listTransferRecords, type TransferRecord } from './transferApi';

type EntryValues = { item: string; buyer: string; design: string; temperature: string; speed: string; quantityMeters: string };
const emptyEntry: EntryValues = { item: '', buyer: '', design: '', temperature: '', speed: '', quantityMeters: '' };
const factoryToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const fieldClass = 'min-h-10 w-full min-w-0 border-2 border-line bg-white px-3 text-sm font-semibold text-industrialDark outline-none focus:border-industrial focus:ring-2 focus:ring-slate-300';
const labelClass = 'grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600';

function numericValue(value: string): number {
  return Number(value);
}

export function TransferRecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const [productionDate, setProductionDate] = useState(factoryToday);
  const [orderNumber, setOrderNumber] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [shift, setShift] = useState('');
  const [orderProgress, setOrderProgress] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [entry, setEntry] = useState<EntryValues>(emptyEntry);
  const [records, setRecords] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const isOperator = user?.role === 'OPERATOR';

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRecords(await listTransferRecords(productionDate));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : (vi ? 'Không tải được báo cáo máy ép.' : 'Unable to load the transfer report.'));
    } finally {
      setLoading(false);
    }
  }, [productionDate, vi]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const updateEntry = (key: keyof EntryValues, value: string) => setEntry((current) => ({ ...current, [key]: value }));
  const canSave = Boolean(!saving && productionDate && orderNumber.trim() && operatorName.trim() && employeeId.trim() && shift
    && entry.item.trim() && entry.buyer.trim() && entry.design.trim()
    && entry.temperature !== '' && entry.speed !== '' && entry.quantityMeters !== ''
    && [entry.temperature, entry.speed, entry.quantityMeters].every((value) => Number.isFinite(numericValue(value)) && numericValue(value) >= 0));

  const saveRecord = async () => {
    if (!canSave) {
      setMessage(vi ? 'Vui lòng nhập đủ thông tin và các giá trị số không âm.' : 'Complete all fields and use nonnegative numeric values.');
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await createTransferRecord({
        machine_id: 'HT-01', production_date: productionDate, order_number: orderNumber.trim().toUpperCase(),
        operator_name: operatorName.trim(), operator_identifier: employeeId.trim(), shift,
        order_progress: orderProgress, item: entry.item.trim(), buyer: entry.buyer.trim(), design: entry.design.trim(),
        temperature: numericValue(entry.temperature), speed: numericValue(entry.speed), quantity_meters: numericValue(entry.quantityMeters),
      });
      setEntry(emptyEntry);
      await loadRecords();
      setMessage(vi ? 'ĐÃ LƯU DÒNG BÁO CÁO H/T TRANSFER.' : 'H/T TRANSFER REPORT ROW SAVED.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (vi ? 'Không lưu được báo cáo máy ép.' : 'Unable to save the transfer report.'));
    } finally {
      setSaving(false);
    }
  };

  const exportReport = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await downloadTransferReport(productionDate, language);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `ht-transfer-daily-report-${productionDate}.xlsx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : (vi ? 'Không xuất được Excel.' : 'Unable to export Excel.'));
    } finally {
      setExporting(false);
    }
  };

  return (
    <WS3Shell title="WS3 / H/T Transfer" subtitle={vi ? 'Nhập báo cáo hằng ngày · Máy ép' : 'Daily report entry · Heat transfer'} machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'H/T Transfer'} status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={!isOperator}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'H/T Transfer'} basePath="/machine/HT-01" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{vi ? 'TRANG CHỦ' : 'HOME'}</HMIButton>} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 lg:flex-row lg:overflow-hidden">
            <aside className="flex min-h-0 min-w-0 flex-col border-2 border-industrialDark bg-white lg:w-[320px] lg:shrink-0">
              <header className="flex min-h-10 items-center border-b-2 border-industrialDark bg-industrialDark px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white">{vi ? 'THÔNG TIN VẬN HÀNH' : 'OPERATION INFORMATION'}</header>
              <div className="grid content-start">
              <OperationInfoFields
                orderNumber={orderNumber}
                onOrderNumberChange={(value) => { setOrderNumber(value.toUpperCase()); setOrderProgress('IN_PROGRESS'); }}
                operatorName={operatorName}
                onOperatorNameChange={setOperatorName}
                employeeId={employeeId}
                onEmployeeIdChange={setEmployeeId}
                shift={shift}
                onShiftChange={setShift}
                orderStatus={(
                  <label className={labelClass}>{vi ? 'Tiến độ đơn' : 'Order progress'}
                    <select className={fieldClass} value={orderProgress} onChange={(event) => setOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')}>
                      <option value="IN_PROGRESS">{vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS'}</option>
                      <option value="COMPLETED">{vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED'}</option>
                    </select>
                  </label>
                )}
              />
              </div>
            </aside>
            <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-white lg:min-h-0">
              <header className="sticky top-0 z-10 flex min-h-10 flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-white">
                <h1 className="text-[10px] font-bold uppercase tracking-wider">{vi ? 'THÔNG SỐ VẬN HÀNH · H/T TRANSFER' : 'OPERATION PARAMETERS · H/T TRANSFER'}</h1>
                <label className="flex items-center gap-2 text-[10px]">{vi ? 'Ngày sản xuất' : 'Production date'}
                  <input type="date" value={productionDate} onChange={(event) => setProductionDate(event.target.value)} className="min-h-8 border border-line bg-white px-2 text-xs font-semibold text-industrialDark" />
                </label>
              </header>
              <section className="shrink-0 border-b border-line">
                <header className="border-b border-line bg-hmiSection px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-industrialDark">{vi ? 'H/T TRANSFER DAILY REPORT' : 'H/T TRANSFER DAILY REPORT'}</header>
                <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-2 2xl:grid-cols-3">
                <label className={labelClass}>{vi ? 'Loại vải' : 'Item'}<input className={fieldClass} value={entry.item} onChange={(event) => updateEntry('item', event.target.value)} maxLength={300} /></label>
                <label className={labelClass}>{vi ? 'Người mua' : 'Buyer'}<input className={fieldClass} value={entry.buyer} onChange={(event) => updateEntry('buyer', event.target.value)} maxLength={160} /></label>
                <label className={labelClass}>{vi ? 'Thiết kế' : 'Design'}<input className={fieldClass} value={entry.design} onChange={(event) => updateEntry('design', event.target.value)} maxLength={160} /></label>
                <label className={labelClass}>{vi ? 'Nhiệt độ (°C)' : 'Temperature (°C)'}<input className={fieldClass} type="number" min="0" step="0.1" inputMode="decimal" value={entry.temperature} onChange={(event) => updateEntry('temperature', event.target.value)} /></label>
                <label className={labelClass}>{vi ? 'Tốc độ (m/min)' : 'Speed (m/min)'}<input className={fieldClass} type="number" min="0" step="0.1" inputMode="decimal" value={entry.speed} onChange={(event) => updateEntry('speed', event.target.value)} /></label>
                <label className={labelClass}>{vi ? 'Sản lượng (m)' : "Q'ty (m)"}<input className={fieldClass} type="number" min="0" step="0.001" inputMode="decimal" value={entry.quantityMeters} onChange={(event) => updateEntry('quantityMeters', event.target.value)} /></label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-hmiConsole px-3 py-2">
                <span className="text-[10px] font-semibold text-slate-500">{vi ? 'SOP và ca lấy từ Thông tin vận hành.' : 'SOP and shift come from Operation Details.'}</span>
                <HMIButton variant="primary" disabled={!canSave} onClick={() => void saveRecord()}>{saving ? (vi ? 'ĐANG LƯU…' : 'SAVING…') : (vi ? 'LƯU DÒNG BÁO CÁO' : 'SAVE REPORT ROW')}</HMIButton>
              </div>
              </section>
              {(message || error) && <p role={error ? 'alert' : 'status'} className={`mx-3 mt-2 border p-2 text-xs font-semibold ${error ? 'border-alarm bg-hmiAlarm text-alarm' : 'border-success bg-hmiNormal text-success'}`}>{error ?? message}</p>}
              <section className="flex min-h-0 flex-1 flex-col">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-3 py-2">
                <h2 className="text-[10px] font-bold uppercase tracking-wider text-industrialDark">{vi ? `BÁO CÁO TRONG NGÀY · ${records.length} DÒNG` : `DAILY REPORT · ${records.length} ROWS`}</h2>
                <HMIButton variant="secondary" size="compact" disabled={exporting} onClick={() => void exportReport()}>{exporting ? (vi ? 'ĐANG XUẤT…' : 'EXPORTING…') : 'EXCEL'}</HMIButton>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
              {loading ? <p className="flex min-h-48 h-full items-center justify-center p-6 text-center text-xs text-slate-500">{vi ? 'Đang tải báo cáo…' : 'Loading report…'}</p> : records.length === 0 ? <div className="flex min-h-48 h-full flex-col items-center justify-center gap-2 p-6 text-center"><span className="text-2xl text-slate-300">—</span><p className="text-xs text-slate-500">{vi ? 'Chưa có dòng báo cáo trong ngày này.' : 'No report rows for this date.'}</p></div> : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1100px] border-collapse text-left text-[11px]">
                    <thead className="sticky top-0 bg-hmiSection text-[9px] uppercase tracking-wide text-industrialDark"><tr>{(vi ? ['Giờ', 'Loại vải', 'Người mua', 'Thiết kế', 'Nhiệt độ °C', 'Tốc độ m/min', 'Sản lượng m', 'SOP#', 'Ca', 'Người vận hành'] : ['Time', 'Item', 'Buyer', 'Design', 'Temp °C', 'Speed m/min', "Q'ty m", 'SOP#', 'Shift', 'Operator']).map((heading) => <th key={heading} className="border-b border-r border-line px-2 py-2 font-bold">{heading}</th>)}</tr></thead>
                    <tbody>{records.map((record) => <tr key={record.id} className="border-b border-line odd:bg-white even:bg-slate-50"><td className="whitespace-nowrap px-2 py-2 font-mono">{new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recorded_at))}</td><td className="px-2 py-2">{record.item}</td><td className="px-2 py-2">{record.buyer}</td><td className="px-2 py-2">{record.design}</td><td className="px-2 py-2 text-right font-mono">{record.temperature}</td><td className="px-2 py-2 text-right font-mono">{record.speed}</td><td className="px-2 py-2 text-right font-mono">{record.quantity_meters}</td><td className="px-2 py-2 font-mono font-bold">{record.order_number}</td><td className="px-2 py-2">{record.shift}</td><td className="px-2 py-2">{record.operator_name} · {record.operator_identifier}</td></tr>)}</tbody>
                  </table>
                </div>
              )}
              </div>
              </section>
            </section>
        </div>
      </div>
    </WS3Shell>
  );
}
