import { Fragment, useEffect, useMemo, useState } from 'react';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { TenteringMachineSelect, TenteringNavigation, TENTERING_MACHINES } from './TenteringNavigation';
import { HMIButton } from '../../components/hmi/HMIButton';
import { downloadTenteringReport, getTenteringOrders, type TenteringOrder } from './tenteringApi';

function dateText(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(locale);
}

function dateTimeText(value: string | null | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  const parts = new Intl.DateTimeFormat(locale, {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '00';
  return `${part('day')}/${part('month')}/${part('year')} - ${part('hour')}:${part('minute')}`;
}

function quantityText(entries: TenteringOrder['entries'], field: 'planned_quantity' | 'actual_quantity', locale: string): string {
  const values = entries.map((entry) => entry[field]).filter((value): value is number => value !== null);
  if (!values.length) return '—';
  return values.reduce((total, value) => total + value, 0).toLocaleString(locale, { maximumFractionDigits: 3 });
}

function savedDateKey(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '' : new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function numberText(value: number | null, locale: string): string {
  return value === null ? '—' : value.toLocaleString(locale, { maximumFractionDigits: 3 });
}

function widthText(value: number | null, locale: string): string {
  if (value === null) return '—';
  const inches = value.toLocaleString(locale, { maximumFractionDigits: 2 });
  const centimeters = (value * 2.54).toLocaleString(locale, { maximumFractionDigits: 1 });
  return `${inches} IN · ${centimeters} CM`;
}

export function TenteringHistoryPage({ machineId: routeMachineId = 'TE-01' }: { machineId?: string }) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const locale = vi ? 'vi-VN' : 'en-GB';
  const machineId = TENTERING_MACHINES.some((machine) => machine.id === routeMachineId.toUpperCase()) ? routeMachineId.toUpperCase() : 'TE-01';
  const machine = TENTERING_MACHINES.find((item) => item.id === machineId)!;
  const [orders, setOrders] = useState<TenteringOrder[]>([]);
  const [query, setQuery] = useState('');
  const [savedDate, setSavedDate] = useState('');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
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

  const filteredOrders = useMemo(() => orders.filter((order) => {
    const text = `${order.sop_no} ${order.customer ?? ''} ${order.item_description ?? ''} ${order.entries.map((entry) => `${entry.roll_id ?? ''} ${entry.note ?? ''}`).join(' ')}`;
    const matchesQuery = !query.trim() || text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    return matchesQuery && (!savedDate || savedDateKey(order.updated_at) === savedDate);
  }), [orders, query, savedDate]);

  const fieldClass = 'min-h-9 w-full border-2 border-line bg-white px-2 font-sans text-xs font-medium text-industrialDark outline-none focus:border-industrial';
  const exportExcel = async () => {
    if (loading || exporting || !filteredOrders.length) return;
    setExporting(true);
    setExportError('');
    try {
      const blob = await downloadTenteringReport({ machineId, savedDate, query, language: vi ? 'vi' : 'en' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tentering-report-${machineId.toLowerCase()}-${savedDate || 'all'}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setExportError(reason instanceof Error ? reason.message : (vi ? 'Không thể tải báo cáo Excel.' : 'Unable to download Excel report.'));
    } finally {
      setExporting(false);
    }
  };
  const headers = [
    vi ? 'CẬP NHẬT GẦN NHẤT' : 'LAST UPDATED', vi ? 'MÃ SOP' : 'SOP',
    vi ? 'KHÁCH HÀNG' : 'CUSTOMER', vi ? 'LOẠI MẶT HÀNG' : 'ITEM',
    vi ? 'SỐ CUỘN ĐÃ GHI' : 'ROLLS RECORDED', vi ? 'SL THEO ĐƠN' : 'PLANNED TOTAL',
    vi ? 'SL THỰC TẾ' : 'ACTUAL TOTAL', vi ? 'NGƯỜI VẬN HÀNH' : 'OPERATOR',
    vi ? 'CA' : 'SHIFT', vi ? 'CHI TIẾT' : 'DETAILS', vi ? 'TIẾN ĐỘ' : 'PROGRESS',
  ];
  const detailHeaders = [
    vi ? 'CUỘN' : 'ROLL', vi ? 'MÃ ROLL' : 'ROLL ID', vi ? 'NGÀY DỆT' : 'WEAVING DATE',
    vi ? 'SL THEO ĐƠN' : 'PLANNED QTY', vi ? 'SL THỰC TẾ' : 'ACTUAL QTY', vi ? 'GHI CHÚ' : 'NOTE',
  ];

  return <WS3Shell title="WS3 / TENTERING" subtitle={machine.label} machineId={machineId} machineLabel="Tentering" status="info" showGlobalNavigation={false} showMachineNavigation={false} showSupportWidget={user?.role !== 'OPERATOR'}>
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-hmiConsole text-slate-800">
      <TenteringNavigation machineId={machineId} history showMachineSelector={false} />
      <main className="min-h-0 flex-1 overflow-auto p-2">
        <section className="flex min-h-full flex-col border-2 border-industrialDark bg-white">
          <header className="flex flex-wrap items-center justify-between gap-2 bg-industrialDark px-3 py-2 text-white">
            <h1 className="text-xs font-bold uppercase tracking-wider">{vi ? 'LỊCH SỬ' : 'HISTORY'}</h1>
            <div className="flex items-center gap-2"><span className="text-[10px] font-mono">{filteredOrders.length} {vi ? 'đơn' : 'orders'}</span><HMIButton size="compact" variant="secondary" onClick={() => void exportExcel()} disabled={loading || exporting || !filteredOrders.length}>{exporting ? (vi ? 'ĐANG XUẤT…' : 'EXPORTING…') : `${vi ? 'BÁO CÁO' : 'REPORT'} EXCEL`}</HMIButton></div>
          </header>
          <div className="flex flex-wrap items-end gap-3 border-b border-line bg-hmiSection p-3">
            <TenteringMachineSelect machineId={machineId} history visibleLabel className="min-h-9 w-36 appearance-none border-2 border-line bg-white px-2 pr-8 font-sans text-xs font-medium text-industrialDark outline-none focus:border-industrial focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-hmiSection" />
            <label className="grid min-w-40 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'NGÀY CẬP NHẬT ĐƠN' : 'ORDER UPDATED DATE'}
              <input type="date" value={savedDate} onChange={(event) => setSavedDate(event.target.value)} className={fieldClass} />
            </label>
            <label className="grid min-w-[min(100%,18rem)] flex-1 gap-1 text-[9px] font-bold uppercase tracking-wide text-slate-600">{vi ? 'TÌM SOP / KHÁCH HÀNG / MẶT HÀNG / MÃ ROLL' : 'SEARCH SOP / CUSTOMER / ITEM / ROLL ID'}
              <input value={query} onChange={(event) => setQuery(event.target.value)} className={fieldClass} placeholder={vi ? 'Nhập mã SOP hoặc từ khóa…' : 'Enter SOP or keyword…'} />
            </label>
          </div>
          {exportError && <p role="alert" className="border-b border-alarm bg-hmiWarning px-3 py-2 text-[10px] font-semibold text-alarm">{vi ? 'Không thể xuất báo cáo Excel:' : 'Unable to export Excel report:'} {exportError}</p>}
          {error && <p role="alert" className="m-3 border border-alarm bg-hmiAlarm p-3 text-xs font-semibold text-alarm">{error}</p>}
          {loading ? <p className="p-6 text-center text-xs text-slate-500">{vi ? 'ĐANG TẢI LỊCH SỬ…' : 'LOADING HISTORY…'}</p>
            : !error && !filteredOrders.length ? <p className="p-6 text-center text-xs text-slate-500">{vi ? 'CHƯA CÓ BẢN GHI TENTERING.' : 'NO TENTERING RECORDS YET.'}</p>
              : !error && <div className="min-w-0 flex-1 overflow-auto">
                <table className="w-full min-w-[1050px] border-collapse text-left text-[10px]">
                  <thead className="sticky top-0 z-10 bg-industrial text-[9px] uppercase tracking-wide text-white"><tr>
                    {headers.map((label) => <th key={label} className="border-r border-line px-2 py-2">{label}</th>)}
                  </tr></thead>
                  <tbody>{filteredOrders.map((order) => {
                    const expanded = expandedOrders.has(order.id);
                    return <Fragment key={order.id}>
                      <tr key={order.id} className="border-b border-line bg-white hover:bg-slate-50">
                        <td className="whitespace-nowrap px-2 py-2">{dateTimeText(order.updated_at, locale)}</td>
                        <td className="whitespace-nowrap px-2 py-2 font-mono font-bold text-industrialDark">{order.sop_no}</td>
                        <td className="px-2 py-2">{order.customer || '—'}</td>
                        <td className="max-w-56 px-2 py-2">{order.item_description || '—'}</td>
                        <td className="px-2 py-2 text-center font-mono">{order.entries.length}</td>
                        <td className="px-2 py-2 text-right font-mono">{quantityText(order.entries, 'planned_quantity', locale)}</td>
                        <td className="px-2 py-2 text-right font-mono">{quantityText(order.entries, 'actual_quantity', locale)}</td>
                        <td className="px-2 py-2">{order.operator_name || '—'}</td>
                        <td className="px-2 py-2">{order.shift || '—'}</td>
                        <td className="px-2 py-2"><button type="button" aria-expanded={expanded} onClick={() => setExpandedOrders((current) => {
                          const next = new Set(current);
                          if (next.has(order.id)) next.delete(order.id); else next.add(order.id);
                          return next;
                        })} className="whitespace-nowrap border border-industrial px-2 py-1 font-bold text-industrialDark hover:bg-hmiSection">{expanded ? (vi ? 'THU GỌN' : 'COLLAPSE') : (vi ? 'XEM CUỘN' : 'VIEW ROLLS')}</button></td>
                        <td className="whitespace-nowrap px-2 py-2"><span className={`inline-flex border px-2 py-1 text-[9px] font-bold ${order.order_progress === 'COMPLETED' ? 'border-success bg-hmiNormal text-success' : 'border-info bg-sky-50 text-info'}`}>{order.order_progress === 'COMPLETED' ? (vi ? 'HOÀN THÀNH' : 'COMPLETED') : (vi ? 'ĐANG XỬ LÝ' : 'IN PROGRESS')}</span></td>
                      </tr>
                      {expanded && <tr key={`${order.id}-details`} className="border-b-2 border-industrial bg-hmiSection"><td colSpan={headers.length} className="p-2">
                        <div className="mb-1 flex flex-wrap justify-between gap-1 text-[9px] font-bold uppercase text-slate-600"><span>{vi ? 'CHI TIẾT CUỘN' : 'ROLL DETAILS'} · {order.sop_no}</span></div>
                        <div className="mb-2 grid gap-2 lg:grid-cols-3">
                          <section className="border border-line bg-white p-2">
                            <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase text-industrialDark">{vi ? 'ĐƠN HÀNG' : 'ORDER'}</h3>
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Khách hàng' : 'Customer'}</div><div className="text-[10px]">{order.customer || '—'}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Loại mặt hàng' : 'Item'}</div><div className="text-[10px]">{order.item_description || '—'}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Sợi dọc' : 'Warp yarn'}</div><div className="text-[10px]">{order.warp_yarn || '—'}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Sợi ngang' : 'Weft yarn'}</div><div className="text-[10px]">{order.weft_yarn || '—'}</div></div>
                            </div>
                          </section>
                          <section className="border border-line bg-white p-2">
                            <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase text-industrialDark">{vi ? 'MẬT ĐỘ' : 'DENSITY'}</h3>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Mật độ mộc' : 'Greige density'}</div><div className="text-[10px]">{order.greige_density_pick === null ? '—' : `${numberText(order.greige_density_pick, locale)} PICK`}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Mật độ thành phẩm' : 'Finish density'}</div><div className="text-[10px]">{order.finish_density_pick === null ? '—' : `${numberText(order.finish_density_pick, locale)} PICK`}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Co rút' : 'Shrinkage'}</div><div className="text-[10px]">{order.shrink_percent === null ? '—' : `${numberText(order.shrink_percent, locale)}%`}</div></div>
                            </div>
                          </section>
                          <section className="border border-line bg-white p-2">
                            <h3 className="mb-2 border-b border-line pb-1 text-[9px] font-bold uppercase text-industrialDark">{vi ? 'KHỔ RỘNG' : 'WIDTH'}</h3>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Khổ mộc' : 'Greige width'}</div><div className="text-[10px]">{widthText(order.greige_width_inch, locale)}</div></div>
                              <div><div className="text-[8px] font-bold uppercase text-slate-500">{vi ? 'Khổ thành phẩm' : 'Finish width'}</div><div className="text-[10px]">{widthText(order.finish_width_inch, locale)}</div></div>
                            </div>
                          </section>
                        </div>
                        <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-left text-[9px]">
                          <thead className="bg-slate-200 text-[9px] uppercase text-industrialDark"><tr>{detailHeaders.map((label) => <th key={label} className="border border-line px-2 py-1.5">{label}</th>)}</tr></thead>
                          <tbody>{order.entries.map((entry) => <tr key={entry.id} className="bg-white">
                            <td className="border border-line px-2 py-1.5 text-center font-mono">{entry.roll_number}</td>
                            <td className="whitespace-nowrap border border-line px-2 py-1.5 font-mono">{entry.roll_id || '—'}</td>
                            <td className="whitespace-nowrap border border-line px-2 py-1.5">{dateText(entry.weaving_date, locale)}</td>
                            <td className="border border-line px-2 py-1.5 text-right font-mono">{entry.planned_quantity ?? '—'}</td>
                            <td className="border border-line px-2 py-1.5 text-right font-mono">{entry.actual_quantity ?? '—'}</td>
                            <td className="max-w-64 border border-line px-2 py-1.5">{entry.note || '—'}</td>
                          </tr>)}</tbody>
                        </table></div>
                      </td></tr>}
                    </Fragment>;
                  })}</tbody>
                </table>
              </div>}
        </section>
      </main>
    </div>
  </WS3Shell>;
}
