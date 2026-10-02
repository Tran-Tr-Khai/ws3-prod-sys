import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { WS3SupervisorNav } from './WS3SupervisorNav';
import { getWS3WarehouseRecords, getWS3WarehouseSummary, type WS3WarehousePage, type WS3WarehouseSource, type WS3WarehouseSummary } from './ws3OrderApi';

const sourceKeys: WS3WarehouseSource[] = ['plan', 'order', 'machine', 'worker'];
const sourceNames: Record<WS3WarehouseSource, [string, string]> = {
  plan: ['Kế hoạch sản xuất', 'Production plan'],
  order: ['Đơn sản xuất WS3', 'WS3 production orders'],
  machine: ['Roll từ máy dệt', 'Weaving machine rolls'],
  worker: ['Ca và công nhân', 'Shifts and workers'],
};
const pageSize = 50;
const columnOrderStorageKey = 'ws3-data-warehouse-column-order-v1';

export function WS3DataWarehousePage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const [summary, setSummary] = useState<WS3WarehouseSummary | null>(null);
  const [source, setSource] = useState<WS3WarehouseSource>('plan');
  const [page, setPage] = useState<WS3WarehousePage | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [columnOrders, setColumnOrders] = useState<Partial<Record<WS3WarehouseSource, number[]>>>(() => {
    try {
      const saved = window.localStorage.getItem(columnOrderStorageKey);
      return saved ? JSON.parse(saved) as Partial<Record<WS3WarehouseSource, number[]>> : {};
    } catch { return {}; }
  });
  const [draggingColumn, setDraggingColumn] = useState<number | null>(null);
  const [dropTargetColumn, setDropTargetColumn] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    void getWS3WarehouseSummary().then(setSummary).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : language === 'vi' ? 'Không thể tải tổng quan dữ liệu.' : 'Unable to load data summary.'));
  }, [user?.role, language]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let active = true;
    setLoading(true);
    void getWS3WarehouseRecords({ source, q: search, date, offset, limit: pageSize })
      .then((result) => { if (active) { setPage(result); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : language === 'vi' ? 'Không thể tải bản ghi.' : 'Unable to load records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, source, search, date, offset, language]);

  useEffect(() => {
    window.localStorage.setItem(columnOrderStorageKey, JSON.stringify(columnOrders));
  }, [columnOrders]);

  const columns = useMemo(() => page?.records.find((record) => record.raw_data.columns?.length)?.raw_data.columns ?? [], [page]);
  const visibleColumnIndexes = useMemo(() => columns.map((column, index) => ({ column, index })).filter(({ column, index }) => column.trim() || page?.records.some((record) => record.raw_data.row?.[index]?.trim())).map(({ index }) => index), [columns, page]);
  const orderedColumnIndexes = useMemo(() => {
    const saved = columnOrders[source] ?? [];
    return [...saved.filter((index) => visibleColumnIndexes.includes(index)), ...visibleColumnIndexes.filter((index) => !saved.includes(index))];
  }, [columnOrders, source, visibleColumnIndexes]);
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));
  if (!user || user.role !== 'ADMIN') return <Navigate to="/ws3" replace />;

  const moveColumn = (fromIndex: number, toIndex: number) => {
    const next = [...orderedColumnIndexes];
    const from = next.indexOf(fromIndex);
    const to = next.indexOf(toIndex);
    if (from < 0 || to < 0 || from === to) return;
    next.splice(to, 0, ...next.splice(from, 1));
    setColumnOrders((current) => ({ ...current, [source]: next }));
  };

  const moveColumnByStep = (columnIndex: number, direction: -1 | 1) => {
    const position = orderedColumnIndexes.indexOf(columnIndex);
    const target = orderedColumnIndexes[position + direction];
    if (target !== undefined) moveColumn(columnIndex, target);
  };

  const resetColumnOrder = () => setColumnOrders((current) => {
    const next = { ...current };
    delete next[source];
    return next;
  });

  return <WS3Shell showGlobalNavigation={false} showMachineNavigation={false} navigation={<WS3SupervisorNav />} title={tx('WS3 / KHO DỮ LIỆU', 'WS3 / DATA WAREHOUSE')} subtitle={tx('Tra cứu snapshot hiện tại', 'Inspect current snapshots')} status="info">
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-navy p-2 text-industrialDark">
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-white">
        <header className="flex min-h-8 shrink-0 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-3 text-white">
          <h1 className="text-[11px] font-bold uppercase tracking-[0.14em]">{tx('Kho dữ liệu sản xuất', 'Production data warehouse')}</h1>
        </header>
        <div className="grid shrink-0 gap-px border-b border-line bg-line sm:grid-cols-2 xl:grid-cols-4">
          {sourceKeys.map((key) => {
            const info = summary?.[key];
            return <button key={key} type="button" onClick={() => { setSource(key); setOffset(0); }} className={`min-w-0 border-b-2 p-3 text-left transition-colors ${source === key ? 'border-industrialDark bg-hmiSection' : 'border-transparent bg-white hover:bg-hmiHover'}`}>
              <span className="block text-[11px] font-bold uppercase tracking-wide">{sourceNames[key][language === 'vi' ? 0 : 1]}</span>
              <strong className="mt-1 block font-mono text-xl tabular-nums">{info?.count.toLocaleString() ?? '—'}</strong>
              <span className="mt-1 block text-[10px] text-slate-500">{info?.first_date || '—'}{info?.last_date && info.last_date !== info.first_date ? ` → ${info.last_date}` : ''}</span>
              <span className="mt-1 block truncate text-[9px] text-slate-400">{tx('Cập nhật', 'Updated')}: {info?.updated_at ? new Date(info.updated_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') : '—'}</span>
            </button>;
          })}
        </div>
        <form className="flex shrink-0 flex-wrap items-end gap-2 border-b border-line bg-hmiSection p-2" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(searchInput.trim()); }}>
          <label className="flex min-w-48 flex-1 flex-col gap-1 text-[9px] font-bold uppercase tracking-wide">{tx('Tìm trong dữ liệu', 'Search data')}<input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} className="h-8 border-2 border-line bg-white px-2 text-xs font-normal normal-case tracking-normal outline-none focus:border-industrial" placeholder={tx('Mã đơn, máy, mã roll...', 'Order, machine, roll ID...')} /></label>
          <label className="flex flex-col gap-1 text-[9px] font-bold uppercase tracking-wide">{tx('Ngày', 'Date')}<input type="date" value={date} onChange={(event) => { setDate(event.target.value); setOffset(0); }} className="h-8 border-2 border-line bg-white px-2 text-xs font-normal" /></label>
          <HMIButton type="submit" size="compact" variant="primary">{tx('TÌM', 'SEARCH')}</HMIButton>
          {(search || date) && <HMIButton size="compact" variant="secondary" onClick={() => { setSearchInput(''); setSearch(''); setDate(''); setOffset(0); }}>{tx('XÓA LỌC', 'CLEAR FILTER')}</HMIButton>}
        </form>
        {error && <div role="alert" className="shrink-0 border-b border-alarm px-3 py-2 text-xs text-alarm">{error}</div>}
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-max border-collapse text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-hmiSection text-[9px] uppercase tracking-wide text-industrialDark"><tr><th className="border-b-2 border-line px-2 py-2">#</th>{orderedColumnIndexes.map((index, position) => <th key={`${index}-${columns[index]}`} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', String(index)); setDraggingColumn(index); }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTargetColumn(index); }} onDrop={(event) => { event.preventDefault(); const from = Number(event.dataTransfer.getData('text/plain')); if (Number.isInteger(from)) moveColumn(from, index); setDraggingColumn(null); setDropTargetColumn(null); }} onDragEnd={() => { setDraggingColumn(null); setDropTargetColumn(null); }} title={tx('Kéo hoặc dùng nút mũi tên để đổi vị trí cột', 'Drag or use arrows to reorder columns')} className={`w-64 max-w-64 select-none border-b-2 px-2 py-1 ${dropTargetColumn === index ? 'border-dashed border-industrial bg-hmiHover' : 'border-line'} ${draggingColumn === index ? 'opacity-40' : ''}`}><div className="flex w-full items-center gap-2"><span className="min-w-0 flex-1 truncate text-left">{columns[index] || tx('Cột chưa đặt tên', 'Unnamed column')}</span><span className="ml-auto flex shrink-0 items-center gap-1"><button type="button" draggable={false} disabled={position === 0} aria-label={tx(`Chuyển ${columns[index]} sang trái`, `Move ${columns[index]} left`)} title={tx('Chuyển cột sang trái', 'Move column left')} onClick={(event) => { event.stopPropagation(); moveColumnByStep(index, -1); }} className="min-h-6 min-w-6 border border-line bg-white text-xs font-bold enabled:hover:bg-hmiHover disabled:opacity-30">←</button><button type="button" draggable={false} disabled={position === orderedColumnIndexes.length - 1} aria-label={tx(`Chuyển ${columns[index]} sang phải`, `Move ${columns[index]} right`)} title={tx('Chuyển cột sang phải', 'Move column right')} onClick={(event) => { event.stopPropagation(); moveColumnByStep(index, 1); }} className="min-h-6 min-w-6 border border-line bg-white text-xs font-bold enabled:hover:bg-hmiHover disabled:opacity-30">→</button></span></div></th>)}<th className="border-b-2 border-line px-2 py-2">{tx('Ngày nạp', 'Loaded at')}</th></tr></thead>
            <tbody>{page?.records.map((record, rowIndex) => <tr key={record.id} className="odd:bg-white even:bg-slate-50 hover:bg-hmiHover"><td className="border-b border-line px-2 py-2 font-mono text-slate-400">{offset + rowIndex + 1}</td>{orderedColumnIndexes.map((index) => <td key={index} title={record.raw_data.row?.[index] ?? ''} className="max-w-64 truncate border-b border-line px-2 py-2">{record.raw_data.row?.[index] || '—'}</td>)}<td className="border-b border-line px-2 py-2 text-slate-500">{record.created_at ? new Date(record.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') : '—'}</td></tr>)}</tbody>
          </table>
          {!loading && page?.records.length === 0 && <p className="p-8 text-center text-xs text-slate-500">{tx('Không có bản ghi phù hợp.', 'No matching records.')}</p>}
          {loading && <p className="p-8 text-center text-xs font-bold uppercase text-slate-500">{tx('Đang tải...', 'Loading...')}</p>}
        </div>
        <footer className="flex shrink-0 items-center justify-between border-t-2 border-industrialDark bg-hmiSection px-3 py-2 text-[10px]">
          <span>{tx('Bản ghi', 'Records')}: <b>{page?.total.toLocaleString() ?? '—'}</b> · {tx('Trang', 'Page')} {Math.min(totalPages, Math.floor(offset / pageSize) + 1)} / {totalPages}</span>
          <div className="flex gap-2">{columnOrders[source]?.length ? <HMIButton size="compact" onClick={resetColumnOrder}>{tx('ĐẶT LẠI CỘT', 'RESET COLUMNS')}</HMIButton> : null}<HMIButton size="compact" onClick={() => setOffset((value) => Math.max(0, value - pageSize))} disabled={offset === 0 || loading}>{tx('TRƯỚC', 'PREVIOUS')}</HMIButton><HMIButton size="compact" onClick={() => setOffset((value) => value + pageSize)} disabled={!page || offset + pageSize >= page.total || loading}>{tx('TIẾP', 'NEXT')}</HMIButton></div>
        </footer>
      </section>
    </main>
  </WS3Shell>;
}
