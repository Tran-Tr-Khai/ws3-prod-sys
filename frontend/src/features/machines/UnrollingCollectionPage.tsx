import { useCallback, useEffect, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getUnrollingOrders, recordUnrollingRollAction, type UnrollingOrder, type UnrollingRoll, type UnrollingWorkerProfile } from './unrollingApi';

const factoryTimeZone = 'Asia/Ho_Chi_Minh';
function today() {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: factoryTimeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return ['year', 'month', 'day'].map((type) => parts.find((part) => part.type === type)?.value).join('-');
}
function collectedTime(value: string | null, language: 'vi' | 'en') {
  if (!value) return '—';
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', {
    timeZone: factoryTimeZone, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}

export function UnrollingCollectionPage() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const tx = useCallback((vi: string, en: string) => language === 'vi' ? vi : en, [language]);
  const canRecord = user?.role === 'OPERATOR' && user.machineIds.some((id) => id.trim().toUpperCase().startsWith('UN-'));
  const [orders, setOrders] = useState<UnrollingOrder[]>([]);
  const [selectedPk, setSelectedPk] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [orderDate, setOrderDate] = useState(today);
  const [workerName, setWorkerName] = useState('');
  const [workerId, setWorkerId] = useState('');
  const [workerShift, setWorkerShift] = useState('');
  const [loading, setLoading] = useState(true);
  const [actingRollId, setActingRollId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadVersion, setReloadVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      void getUnrollingOrders(search, controller.signal, orderDate).then((result) => {
        if (controller.signal.aborted) return;
        setOrders(result);
        setSelectedPk((current) => result.some((order) => order.pk_no === current) ? current : result[0]?.pk_no ?? null);
      }).catch(() => {
        if (!controller.signal.aborted) {
          setOrders([]);
          setError(tx('Không tải được danh sách đơn. Vui lòng thử lại.', 'Unable to load orders. Please retry.'));
        }
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [reloadVersion, search, orderDate, tx]);

  const selectedOrder = orders.find((order) => order.pk_no === selectedPk) ?? null;
  const resetSelection = () => { setOrders([]); setSelectedPk(null); setLoading(true); };
  const busy = loading || Boolean(actingRollId);
  const workerProfileReady = Boolean(workerName.trim() && workerId.trim() && workerShift.trim());
  const workerProfile: UnrollingWorkerProfile = {
    worker_name: workerName.trim(), worker_id: workerId.trim(), worker_shift: workerShift.trim(),
  };
  const performAction = async (roll: UnrollingRoll, action: 'COLLECT' | 'UNDO_COLLECTION' | 'TRANSFER_TO_PRODUCTION') => {
    if (!selectedOrder || busy || !canRecord || !workerProfileReady) return;
    setActingRollId(roll.roll_id);
    setError(null);
    try {
      await recordUnrollingRollAction(selectedOrder.pk_no, roll.roll_id, action, workerProfile);
      // Reload through the same cancellable request path used by filters.
      setReloadVersion((version) => version + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : tx('Không thể lưu. Vui lòng thử lại.', 'Unable to save. Please retry.'));
    } finally {
      setActingRollId(null);
    }
  };

  const rollStatus = (roll: UnrollingRoll) => roll.collection_status === 'TRANSFERRED'
    ? tx('Đã chuyển SX', 'Transferred') : roll.collection_status === 'COLLECTED'
      ? tx('Đã gom', 'Collected') : tx('Chờ gom', 'Waiting');
  const meters = (roll: UnrollingRoll) => roll.length_meters === null ? '—'
    : roll.length_meters.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') + ' m';
  const rollAction = (roll: UnrollingRoll) => {
    if (!canRecord) return <span className="text-xs text-slate-500">—</span>;
    if (roll.collection_status === 'TRANSFERRED') return <span className="text-xs font-semibold text-success">{tx('Đã bàn giao', 'Handed off')}</span>;
    if (roll.collection_status === 'COLLECTED') return <div className="flex justify-end gap-2">
      <HMIButton size="compact" variant="ghost" disabled={busy || !workerProfileReady} title={tx('Gỡ ghi nhận gom nếu bấm nhầm', 'Undo the collection record if it was a mistake')}
        onClick={() => void performAction(roll, 'UNDO_COLLECTION')}>
        {actingRollId === roll.roll_id ? tx('Đang lưu…', 'Saving…') : tx('Hoàn tác gom', 'Undo collection')}
      </HMIButton>
      <HMIButton size="compact" variant="primary" disabled={busy || !workerProfileReady} onClick={() => void performAction(roll, 'TRANSFER_TO_PRODUCTION')}>
        {tx('Chuyển SX', 'Transfer')}
      </HMIButton>
    </div>;
    return <HMIButton size="normal" variant={roll.collection_status === 'WAITING' ? 'primary' : 'secondary'}
      className="min-w-32" disabled={busy || !workerProfileReady} onClick={() => void performAction(roll, 'COLLECT')}>
      {actingRollId === roll.roll_id ? tx('Đang lưu…', 'Saving…')
        : tx('Gom cuộn', 'Collect roll')}
    </HMIButton>;
  };
  const orderStatus = (order: UnrollingOrder) => order.transferred_rolls === order.matched_rolls && order.matched_rolls > 0
    ? tx('Đã chuyển SX', 'Transferred to production')
    : order.collection_complete ? tx('Hoàn tất gom', 'Collection complete')
      : order.collected_rolls > 0 ? tx('Đang gom', 'Collecting') : tx('Chờ gom', 'Waiting');
  const progress = selectedOrder && selectedOrder.expected_rolls > 0
    ? Math.min(100, Math.round(selectedOrder.collected_rolls / selectedOrder.expected_rolls * 100)) : 0;

  return <WS3Shell title={tx('WS3 / GOM CUỘN', 'WS3 / UNROLLING')} machineId="UN-01" machineLabel="Unrolling" status="info">
    <div className="h-[111.111%] w-[111.111%] origin-top-left scale-[.9] flex min-h-0 flex-col overflow-auto bg-hmiConsole p-2 sm:p-3 lg:overflow-hidden">
      {error && <div role="alert" className="mb-3 flex items-center justify-between gap-3 border border-alarm bg-hmiAlarm p-3 text-sm text-alarm">
        <span>{error}</span>
        <HMIButton disabled={busy} onClick={() => setReloadVersion((v) => v + 1)}>{tx('Tải lại', 'Retry')}</HMIButton>
      </div>}
      {canRecord ? <section aria-label={tx('Thông tin người gom', 'Worker details')} className="mb-3 shrink-0 border-2 border-industrialDark bg-white">
        <header className="flex items-center justify-between border-b border-line bg-hmiSection px-3 py-1.5">
          <h2 className="text-[10px] font-bold uppercase tracking-wide text-industrialDark">{tx('THÔNG TIN NGƯỜI GOM', 'WORKER DETAILS')}</h2>
          <span className="text-[10px] font-semibold text-industrial">UN-01</span>
        </header>
        <div className="grid grid-cols-1 gap-2 p-2 sm:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            {tx('Tên công nhân', 'Worker name')}<input required maxLength={160} autoComplete="name" value={workerName} onChange={(event) => setWorkerName(event.target.value)}
              className="h-8 w-full border border-line bg-white px-2 text-xs font-medium normal-case text-slate-800 focus:border-industrialDark focus:outline-none focus:ring-1 focus:ring-industrialDark" placeholder={tx('Nhập họ tên', 'Enter full name')} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            {tx('Ca làm', 'Shift')}<input required maxLength={80} value={workerShift} onChange={(event) => setWorkerShift(event.target.value)}
              className="h-8 w-full border border-line bg-white px-2 text-xs font-medium normal-case text-slate-800 focus:border-industrialDark focus:outline-none focus:ring-1 focus:ring-industrialDark" placeholder="CA A" />
          </label>
          <label className="flex min-w-0 flex-col gap-1 text-[9px] font-semibold uppercase tracking-wide text-slate-600">
            {tx('ID công nhân', 'Worker ID')}<input required maxLength={80} value={workerId} onChange={(event) => setWorkerId(event.target.value)}
              className="h-8 w-full border border-line bg-white px-2 text-xs font-medium normal-case text-slate-800 focus:border-industrialDark focus:outline-none focus:ring-1 focus:ring-industrialDark" placeholder={tx('Nhập mã nhân viên', 'Enter employee ID')} />
          </label>
        </div>
        {!workerProfileReady && <p className="border-t border-warning bg-hmiWarning px-3 py-1.5 text-[10px] text-warning">{tx('Nhập đủ tên, ca và ID để bật thao tác gom cuộn.', 'Enter worker name, shift, and ID to enable roll actions.')}</p>}
      </section> : <div className="mb-3 grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 border-2 border-industrialDark bg-white px-3 py-2 sm:grid-cols-4">
        {[
          [tx('Vận hành', 'Process'), 'UNROLLING'],
          [tx('Máy', 'Machine'), 'UN-01'],
          [tx('Người vận hành', 'Operator'), user?.displayName || '—'],
          [tx('ID nhân viên', 'Operator ID'), user?.username || '—'],
        ].map(([label, value]) => <div key={label} className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-0.5 truncate text-xs font-semibold text-industrialDark">{value}</p>
        </div>)}
      </div>}
      <div className="grid flex-none items-stretch gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[360px_minmax(0,1fr)] lg:grid-rows-1">
        <aside className="flex min-h-[18rem] min-w-0 flex-col overflow-hidden border-2 border-industrialDark bg-white lg:min-h-0">
          <header className="flex items-center justify-between border-b-2 border-industrialDark bg-white px-3 py-2.5 text-industrialDark">
            <h2 className="text-xs font-bold uppercase tracking-wide">{tx('DANH SÁCH ĐƠN', 'ORDERS')}</h2>
            <span className="text-xs font-medium tabular-nums text-slate-600">{loading ? '…' : orders.length}</span>
          </header>
          <div className="grid shrink-0 gap-2 border-b border-line p-3">
            <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {tx('Ngày ra đơn', 'Order date')}
              <input type="date" value={orderDate} disabled={Boolean(actingRollId)} onChange={(e) => { setOrderDate(e.target.value); resetSelection(); }}
                className="h-8 w-full min-w-0 border border-line bg-white px-2 text-xs font-medium normal-case text-slate-800 focus:border-industrialDark focus:outline-none focus:ring-1 focus:ring-industrialDark" />
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
              {tx('Tìm mã PKP', 'Find PKP')}
              <input type="search" value={search} disabled={Boolean(actingRollId)} onChange={(e) => { setSearch(e.target.value); resetSelection(); }}
                placeholder={tx('Nhập mã đơn…', 'Enter order…')} className="h-8 w-full min-w-0 border border-line bg-white px-2 text-xs font-medium normal-case text-slate-800 focus:border-industrialDark focus:outline-none focus:ring-1 focus:ring-industrialDark" />
            </label>
          </div>
          <div className="max-h-72 overflow-auto lg:max-h-none lg:min-h-0 lg:flex-1" aria-busy={loading}>
            {loading && <p className="p-4 text-sm text-slate-500">{tx('Đang tải đơn…', 'Loading orders…')}</p>}
            {!loading && !error && !orders.length && <p className="p-4 text-sm text-slate-500">{tx('Không có đơn trong bộ lọc này. Chọn ngày khác hoặc Mọi ngày để tìm đơn cũ.', 'No orders match. Choose another date or All dates to find older orders.')}</p>}
            {orders.map((order) => <button key={order.pk_no} type="button" disabled={busy}
              onClick={() => { setSelectedPk(order.pk_no); }} aria-pressed={selectedPk === order.pk_no}
              className={`flex min-h-[4.5rem] w-full items-center justify-between gap-2 border-b border-line border-l-4 px-3 py-2.5 text-left transition-colors ${selectedPk === order.pk_no ? 'border-l-industrialDark bg-hmiSelected' : 'border-l-transparent bg-white hover:bg-hmiHover'}`}>
              <span className="min-w-0"><strong className={`block truncate text-xs text-industrialDark sm:text-sm ${selectedPk === order.pk_no ? 'font-bold' : 'font-semibold'}`}>{order.pk_no}</strong>
                <small className="mt-1 block truncate text-[10px] text-slate-600">{order.item_code} · {order.production_date}</small></span>
              <span className={`shrink-0 text-right ${order.collection_complete ? 'text-success' : 'text-warning'}`}>
                <strong className="block text-sm font-bold tabular-nums">{order.collected_rolls}/{order.expected_rolls}</strong>
                <small className={`mt-0.5 inline-block border px-1.5 py-0.5 font-bold text-[9px] uppercase tracking-[0.06em] ${order.collection_complete ? 'border-success bg-success text-white' : 'border-warning bg-warning text-white'}`}>{orderStatus(order)}</small>
              </span>
            </button>)}
          </div>
        </aside>
        <section className="flex min-h-[20rem] min-w-0 flex-col overflow-hidden border-2 border-industrialDark bg-white lg:min-h-0">
          {!selectedOrder ? <p className="p-8 text-center text-sm text-slate-500">{loading ? tx('Đang tải đơn…', 'Loading orders…') : tx('Chọn đơn bên trái để gom cuộn.', 'Choose an order to collect rolls.')}</p> : <>
            <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 bg-white px-4 py-3">
              <h1 className="text-xl font-bold tracking-wide text-industrialDark">{selectedOrder.pk_no}</h1>
              <div className="flex flex-wrap items-center gap-2">
              <span role="status" className={`inline-flex items-center gap-2 border px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${selectedOrder.collection_complete ? 'border-success bg-hmiNormal text-success' : 'border-warning bg-hmiWarning text-warning'}`}>
                <span className="text-[9px]">●</span>{orderStatus(selectedOrder)}
              </span>
              </div>
            </header>
            <div className="shrink-0 bg-white px-4 pb-3 pt-0">
              <p className="text-xs font-medium text-industrial">{selectedOrder.production_date} · {tx('Mã hàng', 'Item')}: {selectedOrder.item_code || '—'} · LOT: {selectedOrder.lot_no || '—'}</p>
              <p className="mt-1 break-words text-[11px] font-normal leading-snug text-slate-500">{selectedOrder.item_name || '—'}</p>
            </div>
            <div className="shrink-0 bg-white px-4 py-3">
              <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4">
              <div className="leading-none"><strong className="text-3xl font-bold tracking-tight tabular-nums text-industrialDark">{selectedOrder.collected_rolls}<span className="px-1 text-xl font-normal text-slate-400">/</span>{selectedOrder.expected_rolls}</strong>
                <p className="mt-1.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">{tx('Cuộn đã gom', 'Rolls collected')}</p>
              </div>
              <div className="h-2 w-full bg-hmiRail" role="progressbar" aria-label={tx('Tiến độ gom', 'Collection progress')} aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-industrial transition-[width]" style={{ width: progress + '%' }} />
              </div>
              <div className="text-right leading-tight"><strong className="text-xl font-semibold tabular-nums text-industrial">{selectedOrder.transferred_rolls}</strong>
                <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{tx('Đã chuyển SX', 'Sent to production')}</p>
              </div>
              </div>
            </div>
            {selectedOrder.matched_rolls !== selectedOrder.expected_rolls && <p role="status" className="shrink-0 border-y border-warning/30 bg-hmiWarning px-4 py-2 text-xs text-warning">
              {tx('Danh sách cuộn chưa khớp số lượng đơn. Có thể gom cuộn đã xác minh; chưa đánh dấu hoàn thành.', 'Roll count differs from the order. Collect verified rolls; completion is not yet available.')}
            </p>}
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <h2 className="mb-3 text-sm font-semibold text-slate-800">{tx('Cuộn trong đơn', 'Order rolls')}</h2>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                  <thead className="border-b border-industrialDark bg-industrial text-[10px] font-bold uppercase tracking-wide text-white"><tr>
                    {[tx('Mã cuộn', 'Roll'), tx('Máy', 'Machine'), tx('Chiều dài', 'Length'), tx('Trạng thái', 'Status'), tx('Người gom · ca · ID', 'Worker · shift · ID'), tx('Ngày giờ gom', 'Collected at'), ...(canRecord ? [tx('Thao tác', 'Action')] : [])].map((label, index) => <th key={label} className={`px-3 py-2.5 ${index === 2 || (canRecord && index === 6) ? 'text-right' : 'text-left'}`}>{label}</th>)}
                  </tr></thead>
                  <tbody>{selectedOrder.rolls.map((roll) => <tr key={roll.roll_id} className="border-b border-slate-200 last:border-0 hover:bg-hmiHover">
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-800">{roll.roll_id}</td>
                    <td className="px-3 py-2.5 text-xs font-medium">{roll.machine_no || '—'}</td><td className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-medium tabular-nums">{meters(roll)}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs"><span className={`inline-flex items-center gap-1.5 ${roll.collection_status === 'WAITING' ? 'text-warning' : 'font-semibold text-success'}`}><span className="text-[8px]">●</span>{rollStatus(roll)}</span></td>
                    <td className="px-3 py-2.5 text-xs">{roll.collected_by ? <><span className="block font-semibold text-industrialDark">{roll.collected_by}</span><span className="mt-0.5 block text-[10px] text-slate-500">{[roll.collected_shift, roll.collected_worker_id].filter(Boolean).join(' · ') || '—'}</span></> : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">{collectedTime(roll.collected_at, language)}</td>
                    {canRecord && <td className="px-3 py-2.5 text-right">{rollAction(roll)}</td>}
                  </tr>)}</tbody>
                </table>
              </div>
              <div className="grid gap-3 md:hidden">{selectedOrder.rolls.map((roll) => <article key={roll.roll_id} className="border border-line p-3">
                <strong className="break-all text-sm font-semibold text-slate-800">{roll.roll_id}</strong>
                <p className="mt-2 text-xs text-slate-500">{roll.machine_no} · {meters(roll)} · {rollStatus(roll)}</p>
                {roll.collected_by && <p className="mt-2 text-xs font-medium text-industrialDark">{roll.collected_by} · {roll.collected_shift || '—'} · {roll.collected_worker_id || '—'}</p>}
                <p className="my-3 text-xs text-slate-600">{tx('Ngày giờ gom', 'Collected at')}: {collectedTime(roll.collected_at, language)}</p>
                {canRecord && rollAction(roll)}
              </article>)}</div>
            </div>
          </>}
        </section>
      </div>
    </div>
  </WS3Shell>;
}
