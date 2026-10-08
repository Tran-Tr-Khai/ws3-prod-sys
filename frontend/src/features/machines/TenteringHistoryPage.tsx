import { useEffect, useMemo, useState } from 'react';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TenteringMachineSelect, TenteringNavigation, TENTERING_MACHINES } from './TenteringNavigation';
import { getTenteringOrders, type TenteringOrder } from './tenteringApi';

function dateText(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(locale);
}

function dateTimeText(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' });
}

export function TenteringHistoryPage({ machineId: routeMachineId = 'TE-01' }: { machineId?: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const machineId = TENTERING_MACHINES.some((machine) => machine.id === routeMachineId.toUpperCase()) ? routeMachineId.toUpperCase() : 'TE-01';
  const machine = TENTERING_MACHINES.find((item) => item.id === machineId)!;
  const [orders, setOrders] = useState<TenteringOrder[]>([]);
  const [query, setQuery] = useState('');
  const [savedDate, setSavedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getTenteringOrders(machineId).then((items) => { if (active) setOrders(items); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : (vi ? 'Không tải được lịch sử Tentering.' : 'Unable to load Tentering history.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [machineId, vi]);

  const rows = useMemo(() => orders.flatMap((order) => order.entries.map((entry) => ({ order, entry })))
    .filter(({ order, entry }) => {
      const matchesQuery = !query.trim() || `${order.sop_no} ${order.customer ?? ''} ${order.item_description ?? ''} ${entry.note ?? ''}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
      const date = new Date(order.updated_at);
      const localSavedDate = Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
      return matchesQuery && (!savedDate || localSavedDate === savedDate);
    }), [orders, query, savedDate]);
  const fieldClass = 'min-h-9 w-full border-2 border-line bg-white px-2 font-sans text-xs font-medium text-industrialDark outline-none focus:border-industrial';

  return <WS3Shell title="WS3 / TENTERING" subtitle={machine.label} machineId={machineId} machineLabel="Tentering" status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={user?.role !== 'OPERATOR'}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <TenteringNavigation machineId={machineId} history showMachineSelector={false} />
      <main className="min-h-0 flex-1 overflow-auto p-2">
        <section className="flex min-h-full flex-col border-2 border-industrialDark bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-white">
            <h1 className="text-xs font-bold uppercase tracking-wider">{vi ? 'LỊCH SỬ' : 'HISTORY'}</h1>
            <span className="text-[10px] font-mono">{rows.length} {vi ? 'dòng' : 'rows'}</span>
          </header>
          <div className="flex flex-wrap items-end gap-3 border-b border-line bg-hmiSection p-3">
            <TenteringMachineSelect machineId={machineId} history visibleLabel className="min-h-9 w-36 appearance-none border-2 border-line bg-white px-2 pr-8 font-sans text-xs font-medium text-industrialDark outline-none focus:border-industrial focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-hmiSection" />
            <label className="grid min-w-40 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'NGÀY LƯU' : 'SAVED DATE'}
              <input type="date" value={savedDate} onChange={(event) => setSavedDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="grid min-w-[min(100%,18rem)] flex-1 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'TÌM SOP / KHÁCH HÀNG / MẶT HÀNG' : 'SEARCH SOP / CUSTOMER / ITEM'}
              <input value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass} placeholder={vi ? 'Nhập mã SOP hoặc từ khóa…' : 'Enter SOP or keyword…'} />
            </label>
          </div>
          {error && <p role="alert" className="m-3 border border-alarm bg-hmiAlarm p-3 text-xs font-semibold text-alarm">{error}</p>}
          {loading ? <p className="p-6 text-center text-xs text-slate-500">{vi ? 'ĐANG TẢI LỊCH SỬ…' : 'LOADING HISTORY…'}</p>
            : !error && !rows.length ? <p className="p-6 text-center text-xs text-slate-500">{vi ? 'CHƯA CÓ BẢN GHI TENTERING.' : 'NO TENTERING RECORDS YET.'}</p>
              : !error && <div className="min-w-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left text-[10px]">
                  <thead className="sticky top-0 bg-industrial text-[9px] uppercase tracking-wide text-white"><tr>
                    {[vi ? 'MÃ SOP' : 'SOP', vi ? 'TIẾN ĐỘ ĐƠN' : 'ORDER PROGRESS', vi ? 'KHÁCH HÀNG' : 'CUSTOMER', vi ? 'CUỘN' : 'ROLL', vi ? 'MÃ ROLL' : 'ROLL ID', vi ? 'THỜI GIAN LƯU' : 'SAVED AT', vi ? 'NGÀY DỆT' : 'WEAVING DATE', vi ? 'SẢN LƯỢNG THEO ĐƠN' : 'PLANNED QTY', vi ? 'SẢN LƯỢNG THỰC TẾ' : 'ACTUAL QTY', vi ? 'NGƯỜI VẬN HÀNH' : 'OPERATOR', vi ? 'CA' : 'SHIFT', vi ? 'GHI CHÚ' : 'NOTE'].map((label) => <th key={label} className="border-r border-line px-2 py-2">{label}</th>)}
                  </tr></thead>
                  <tbody>{rows.map(({ order, entry }) => <tr key={entry.id} className="border-b border-line odd:bg-white even:bg-slate-50">
                    <td className="whitespace-nowrap px-2 py-2 font-mono font-bold text-industrialDark">{order.sop_no}</td>
                    <td className="whitespace-nowrap px-2 py-2"><span className={`inline-flex border px-2 py-1 text-[9px] font-bold ${order.order_progress === 'COMPLETED' ? 'border-success bg-hmiNormal text-success' : 'border-info bg-sky-50 text-info'}`}>{order.order_progress === 'COMPLETED' ? (vi ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : (vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS')}</span></td>
                    <td className="px-2 py-2">{order.customer || '—'}</td>
                    <td className="px-2 py-2 text-center font-mono">{entry.roll_number}</td>
                    <td className="whitespace-nowrap px-2 py-2 font-mono">{entry.roll_id || '—'}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dateTimeText(order.updated_at, vi ? 'vi-VN' : 'en-GB')}</td>
                    <td className="whitespace-nowrap px-2 py-2">{dateText(entry.weaving_date, vi ? 'vi-VN' : 'en-GB')}</td>
                    <td className="px-2 py-2 text-right font-mono">{entry.planned_quantity ?? '—'}</td>
                    <td className="px-2 py-2 text-right font-mono">{entry.actual_quantity ?? '—'}</td>
                    <td className="px-2 py-2">{order.operator_name || entry.recorded_by_name || '—'}</td>
                    <td className="px-2 py-2">{order.shift || '—'}</td>
                    <td className="max-w-64 px-2 py-2">{entry.note || '—'}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
        </section>
      </main>
    </div>
  </WS3Shell>;
}
