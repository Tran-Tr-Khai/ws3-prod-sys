import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { MachineNavigation } from '../../components/hmi/MachineNavigation';
import { OperationInfoFields } from '../../components/hmi/OperationInfoFields';
import { MachineOrderProgressField } from '../../components/hmi/MachineOrderProgressField';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { createTransferRecord, deleteTransferRecord, getTransferOrderSource, listTransferRecords, type TransferRecord } from './transferApi';
import { getMachineOrderProgress, saveMachineOrderProgress } from './scouringApi';

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
  const [productionDate] = useState(factoryToday);
  const [orderNumber, setOrderNumber] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [shift, setShift] = useState('');
  const [orderProgress, setOrderProgress] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [entry, setEntry] = useState<EntryValues>(emptyEntry);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [sopLoading, setSopLoading] = useState(false);
  const [knownOrder, setKnownOrder] = useState(false);
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [todayRecords, setTodayRecords] = useState<TransferRecord[]>([]);
  const [todayLoading, setTodayLoading] = useState(true);
  const [todayError, setTodayError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [todayPage, setTodayPage] = useState(1);
  const isOperator = user?.role === 'OPERATOR';
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(todayRecords.length / pageSize));
  const currentPage = Math.min(todayPage, totalPages);
  const pageRecords = todayRecords.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const loadTodayRecords = useCallback(async () => {
    setTodayLoading(true);
    setTodayError('');
    try { setTodayRecords(await listTransferRecords(productionDate)); }
    catch (reason) {
      setTodayError(reason instanceof Error ? reason.message : (vi ? 'Không tải được bản ghi hôm nay.' : 'Unable to load today’s records.'));
    } finally { setTodayLoading(false); }
  }, [productionDate, vi]);

  useEffect(() => { void loadTodayRecords(); }, [loadTodayRecords]);

  useEffect(() => {
    const normalized = orderNumber.trim().toUpperCase();
    if (!normalized) { setSopLoading(false); return; }
    let active = true;
    setSopLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const [sourceResult, progressResult] = await Promise.allSettled([
          getTransferOrderSource(normalized),
          getMachineOrderProgress('HT-01', normalized),
        ]);
        if (sourceResult.status === 'rejected') throw sourceResult.reason;
        if (!active) return;
        const source = sourceResult.value;
        setKnownOrder(Boolean(source));
        setOrderProgress(progressResult.status === 'fulfilled' ? progressResult.value?.orderProgress ?? 'IN_PROGRESS' : 'IN_PROGRESS');
        setProgressError(progressResult.status === 'rejected' ? (progressResult.reason instanceof Error ? progressResult.reason.message : (vi ? 'Không tải được tiến độ đơn.' : 'Unable to load order progress.')) : '');
        if (source) {
          setEntry((current) => ({
            ...current,
            item: source.item ?? current.item,
            buyer: source.buyer ?? current.buyer,
            design: source.design ?? current.design,
          }));
          setMessage(vi ? 'ĐÃ TẢI THÔNG TIN ĐƠN TỪ SOP.' : 'ORDER DETAILS LOADED FROM SOP.');
          setError(null);
        } else {
          setMessage(null);
          setError(vi ? 'Không tìm thấy SOP trong dữ liệu MES.' : 'SOP was not found in MES data.');
        }
      } catch (lookupError) {
        if (active) {
          setKnownOrder(false);
          setMessage(null);
          setError(lookupError instanceof Error ? lookupError.message : (vi ? 'Không tải được thông tin SOP.' : 'Unable to load SOP details.'));
        }
      } finally { if (active) setSopLoading(false); }
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [orderNumber, vi]);

  const changeOrderProgress = async (nextProgress: 'IN_PROGRESS' | 'COMPLETED') => {
    if (!knownOrder || sopLoading || progressSaving || !orderNumber.trim()) return;
    const previousProgress = orderProgress;
    setOrderProgress(nextProgress);
    setProgressSaving(true);
    setProgressError('');
    try {
      await saveMachineOrderProgress('HT-01', orderNumber.trim().toUpperCase(), nextProgress);
    } catch (reason) {
      setOrderProgress(previousProgress);
      setProgressError(reason instanceof Error ? reason.message : (vi ? 'Không lưu được tiến độ đơn.' : 'Unable to save order progress.'));
    } finally { setProgressSaving(false); }
  };

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
      const saved = await createTransferRecord({
        machine_id: 'HT-01', production_date: productionDate, order_number: orderNumber.trim().toUpperCase(),
        operator_name: operatorName.trim(), operator_identifier: employeeId.trim(), shift,
        order_progress: orderProgress, item: entry.item.trim(), buyer: entry.buyer.trim(), design: entry.design.trim(),
        temperature: numericValue(entry.temperature), speed: numericValue(entry.speed), quantity_meters: numericValue(entry.quantityMeters),
      });
      setOrderProgress(saved.order_progress);
      setTodayPage(1);
      setEntry((current) => ({ ...current, temperature: '', speed: '', quantityMeters: '' }));
      await loadTodayRecords();
      setMessage(vi ? 'ĐÃ LƯU BẢN GHI.' : 'RECORD SAVED.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : (vi ? 'Không lưu được báo cáo máy ép.' : 'Unable to save the transfer report.'));
    } finally {
      setSaving(false);
    }
  };

  const removeTodayRecord = async (record: TransferRecord) => {
    const prompt = vi ? `Xóa bản ghi SOP ${record.order_number} đã lưu lúc ${new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recorded_at))}?` : `Delete the record for SOP ${record.order_number}?`;
    if (!window.confirm(prompt)) return;
    setDeletingId(record.id);
    setTodayError('');
    try {
      await deleteTransferRecord(record.id);
      setTodayRecords((current) => current.filter((row) => row.id !== record.id));
    } catch (reason) {
      setTodayError(reason instanceof Error ? reason.message : (vi ? 'Không xóa được bản ghi.' : 'Unable to delete the record.'));
    } finally { setDeletingId(null); }
  };

  return (
    <WS3Shell title="WS3 / Transfer" subtitle={vi ? 'Nhập báo cáo hằng ngày · Máy ép' : 'Daily report entry · Transfer'} machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'Transfer'} status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={!isOperator}>
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
        <MachineNavigation machineId="HT-01" machineLabel={vi ? 'Máy ép' : 'Transfer'} basePath="/machine/HT-01" trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{vi ? 'TRANG CHỦ' : 'HOME'}</HMIButton>} />
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto p-2 lg:flex-row lg:overflow-hidden">
            <aside className="flex min-h-0 min-w-0 flex-col border-2 border-industrialDark bg-white lg:w-[320px] lg:shrink-0">
              <header className="flex min-h-10 items-center border-b-2 border-industrialDark bg-industrialDark px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-white">{vi ? 'THÔNG TIN VẬN HÀNH' : 'OPERATION INFORMATION'}</header>
              <div className="grid content-start">
              <OperationInfoFields
                orderNumber={orderNumber}
                onOrderNumberChange={(value) => { setOrderNumber(value.toUpperCase()); setEntry(emptyEntry); setOrderProgress('IN_PROGRESS'); setKnownOrder(false); setProgressError(''); setMessage(null); setError(null); }}
                operatorName={operatorName}
                onOperatorNameChange={setOperatorName}
                employeeId={employeeId}
                onEmployeeIdChange={setEmployeeId}
                shift={shift}
                onShiftChange={setShift}
                orderStatus={<MachineOrderProgressField value={orderProgress} language={language} automatic={isOperator} disabled={!knownOrder || sopLoading} saving={progressSaving} error={progressError} onChange={(progress) => void changeOrderProgress(progress)} />}
              />
              </div>
            </aside>
            <section className="flex min-h-[70dvh] min-w-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-white lg:min-h-0">
              <header className="sticky top-0 z-10 flex min-h-10 flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-white">
                <h1 className="text-[10px] font-bold uppercase tracking-wider">{vi ? 'THÔNG SỐ VẬN HÀNH' : 'OPERATION PARAMETERS'}</h1>
              </header>
              <section className="shrink-0 bg-white">
                <div className="grid gap-x-3 gap-y-2 p-3 sm:grid-cols-2 2xl:grid-cols-3">
                <label className={labelClass}>{vi ? 'Loại vải' : 'Item'}<input className={fieldClass} value={entry.item} onChange={(event) => updateEntry('item', event.target.value)} maxLength={300} /></label>
                <label className={labelClass}>{vi ? 'Người mua' : 'Buyer'}<input className={fieldClass} value={entry.buyer} onChange={(event) => updateEntry('buyer', event.target.value)} maxLength={160} /></label>
                <label className={labelClass}>{vi ? 'Thiết kế' : 'Design'}<input className={fieldClass} value={entry.design} onChange={(event) => updateEntry('design', event.target.value)} maxLength={160} /></label>
                <label className={labelClass}>{vi ? 'Nhiệt độ (°C)' : 'Temperature (°C)'}<input className={fieldClass} type="number" min="0" step="0.1" inputMode="decimal" value={entry.temperature} onChange={(event) => updateEntry('temperature', event.target.value)} /></label>
                <label className={labelClass}>{vi ? 'Tốc độ (m/min)' : 'Speed (m/min)'}<input className={fieldClass} type="number" min="0" step="0.1" inputMode="decimal" value={entry.speed} onChange={(event) => updateEntry('speed', event.target.value)} /></label>
                <label className={labelClass}>{vi ? 'Sản lượng (m)' : "Q'ty (m)"}<input className={fieldClass} type="number" min="0" step="0.001" inputMode="decimal" value={entry.quantityMeters} onChange={(event) => updateEntry('quantityMeters', event.target.value)} /></label>
              </div>
              <div className="flex min-h-12 items-center justify-end bg-white px-3 py-2">
                {sopLoading && <span className="mr-auto text-[10px] font-semibold text-slate-500">{vi ? 'ĐANG TẢI THÔNG TIN SOP…' : 'LOADING SOP DETAILS…'}</span>}
                <HMIButton variant="primary" disabled={!canSave} onClick={() => void saveRecord()}>{saving ? (vi ? 'ĐANG LƯU…' : 'SAVING…') : (vi ? 'LƯU BẢN GHI' : 'SAVE RECORD')}</HMIButton>
              </div>
              </section>
              {(message || error) && <p role={error ? 'alert' : 'status'} className={`mx-3 mt-2 border p-2 text-xs font-semibold ${error ? 'border-alarm bg-hmiAlarm text-alarm' : 'border-success bg-hmiNormal text-success'}`}>{error ?? message}</p>}
              <section className="flex min-h-0 flex-1 flex-col bg-white">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-industrial px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-white">
                  <h2>{vi ? 'HÔM NAY' : 'TODAY'}</h2>
                  <span className="text-right text-[9px] tracking-normal">{pageRecords.length} / {todayRecords.length}</span>
                </header>
                <div className="flex min-h-0 flex-1 flex-col bg-white p-2">
                  <div className="min-h-0 flex-1 overflow-auto">
                  {todayError ? <p role="alert" className="p-4 text-center text-xs font-semibold text-alarm">{todayError}</p> : todayLoading ? <p className="p-4 text-center text-xs text-slate-500">{vi ? 'Đang tải bản ghi…' : 'Loading records…'}</p> : todayRecords.length === 0 ? <p className="flex min-h-32 items-center justify-center p-4 text-center text-xs font-semibold uppercase text-slate-500">{vi ? 'Chưa có bản ghi trong ngày hôm nay.' : 'No records for today yet.'}</p> :
                    <table className="w-full min-w-[1240px] border-collapse text-left text-[10px]">
                      <thead className="sticky top-0 z-10 border-b border-line bg-white text-[9px] uppercase tracking-wider text-industrialDark">
                        <tr>{(vi ? ['Thời gian', 'SOP', 'Loại vải', 'Người mua', 'Thiết kế', 'Nhiệt độ °C', 'Tốc độ m/min', 'Sản lượng m', 'Người vận hành', 'ID nhân viên', 'Ca', ''] : ['Time', 'SOP', 'Item', 'Buyer', 'Design', 'Temp °C', 'Speed m/min', "Q'ty m", 'Operator', 'Employee ID', 'Shift', '']).map((heading, index) => <th key={`${heading}-${index}`} className={`px-3 py-2 font-bold ${index === 11 ? 'w-12 text-center' : ''}`}>{heading}</th>)}</tr>
                      </thead>
                      <tbody>{pageRecords.map((record) => <tr key={record.id} className="border-b border-line hover:bg-hmiHover">
                        <td className="whitespace-nowrap px-3 py-2 font-mono font-bold text-industrial">{new Intl.DateTimeFormat(vi ? 'vi-VN' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(record.recorded_at))}</td>
                        <td className="px-3 py-2 font-mono font-semibold text-industrialDark">{record.order_number}</td><td className="px-3 py-2">{record.item}</td><td className="px-3 py-2">{record.buyer}</td><td className="px-3 py-2">{record.design}</td>
                        <td className="px-3 py-2 text-right font-mono">{record.temperature}</td><td className="px-3 py-2 text-right font-mono">{record.speed}</td><td className="px-3 py-2 text-right font-mono">{record.quantity_meters}</td>
                        <td className="px-3 py-2 font-semibold text-industrialDark">{record.operator_name}</td><td className="px-3 py-2 font-mono">{record.operator_identifier}</td><td className="px-3 py-2">{record.shift}</td>
                        <td className="px-2 py-2 text-center"><button type="button" className="inline-flex h-7 w-7 items-center justify-center border border-alarm text-alarm hover:bg-red-50 disabled:cursor-wait disabled:opacity-50" title={vi ? 'Xóa bản ghi' : 'Delete record'} aria-label={vi ? 'Xóa bản ghi' : 'Delete record'} disabled={deletingId === record.id} onClick={() => void removeTodayRecord(record)}>
                          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M9 7l1-2h4l1 2M6 7l1 13h10l1-13" /></svg>
                        </button></td>
                      </tr>)}</tbody>
                    </table>}
                  </div>
                  {totalPages > 1 && <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-white px-2 py-2">
                    <span className="mr-2 text-[10px] font-semibold text-slate-500">{vi ? `TRANG ${currentPage} / ${totalPages}` : `PAGE ${currentPage} / ${totalPages}`}</span>
                    <HMIButton size="compact" disabled={currentPage <= 1} onClick={() => setTodayPage((page) => Math.max(1, page - 1))}>{vi ? 'TRƯỚC' : 'PREVIOUS'}</HMIButton>
                    <HMIButton size="compact" disabled={currentPage >= totalPages} onClick={() => setTodayPage((page) => Math.min(totalPages, page + 1))}>{vi ? 'SAU' : 'NEXT'}</HMIButton>
                  </footer>}
                </div>
              </section>
            </section>
        </div>
      </div>
    </WS3Shell>
  );
}
