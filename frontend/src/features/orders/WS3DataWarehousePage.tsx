import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getWS3WarehouseRecords, getWS3WarehouseSummary, type WS3WarehousePage, type WS3WarehouseSource, type WS3WarehouseSummary } from './ws3OrderApi';
import { ws3DataSourceLabels } from './ws3DataSourceLabels';
import { WS3DataFlowNav } from './WS3DataFlowNav';
import './WS3DataWarehousePage.css';
import '../../components/mes/MesDataTable.css';
import { MesDataCell } from '../../components/mes/MesDataCell';
import { MesResizableHeaderCell, MesResizableTable } from '../../components/mes/MesResizableTable';

const sourceKeys: WS3WarehouseSource[] = ['order', 'machine', 'worker'];
const pageSize = 50;

export function WS3DataWarehousePage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = useCallback((vi: string, en: string) => language === 'vi' ? vi : en, [language]);
  const [summary, setSummary] = useState<WS3WarehouseSummary | null>(null);
  const [source, setSource] = useState<WS3WarehouseSource>('order');
  const [page, setPage] = useState<WS3WarehousePage | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [date, setDate] = useState('');
  const [offset, setOffset] = useState(0);
  const [sortBy, setSortBy] = useState<number | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    void getWS3WarehouseSummary().then(setSummary).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : tx('Không thể tải tổng quan dữ liệu.', 'Unable to load data summary.')));
  }, [user?.role, tx]);

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    let active = true;
    setLoading(true);
    void getWS3WarehouseRecords({ source, q: search, date, offset, limit: pageSize, sortBy, sortDirection })
      .then((result) => { if (active) { setPage(result); setError(''); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : tx('Không thể tải bản ghi.', 'Unable to load records.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?.role, source, search, date, offset, sortBy, sortDirection, tx]);

  const columns = useMemo(() => page?.records.find((record) => record.raw_data.columns?.length)?.raw_data.columns ?? [], [page]);
  const visibleColumnIndexes = useMemo(() => columns.map((column, index) => ({ column, index })).filter(({ column, index }) => column.trim() || page?.records.some((record) => record.raw_data.row?.[index]?.trim())).map(({ index }) => index), [columns, page]);
  const warehouseColumnWidths = useMemo(() => [
    56,
    ...visibleColumnIndexes.map((index) => Math.min(280, Math.max(120, (columns[index]?.length ?? 12) * 8 + 36))),
    150,
  ], [columns, visibleColumnIndexes]);
  const totalPages = Math.max(1, Math.ceil((page?.total ?? 0) / pageSize));
  if (!user || user.role !== 'ADMIN') return <Navigate to="/ws3" replace />;

  const sortRowsBy = (columnIndex: number) => {
    if (sortBy === columnIndex) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
    else { setSortBy(columnIndex); setSortDirection('asc'); }
    setOffset(0);
  };

  const clearFilters = () => { setSearchInput(''); setSearch(''); setDate(''); setOffset(0); };

  return <WS3MesShell module={tx('Kho dữ liệu', 'Data warehouse')} breadcrumbs={[]} navigation={<WS3DataFlowNav />}>
    <div className="warehouse-mes">
      <section className="warehouse-mes__controlbar">
        <div className="warehouse-mes__sources" aria-label={tx('Nguồn dữ liệu', 'Data sources')}>
          {sourceKeys.map((key) => {
            const info = summary?.[key];
            const selected = source === key;
            return <button key={key} type="button" data-selected={selected || undefined} onClick={() => { setSource(key); setOffset(0); setSortBy(null); setSortDirection('asc'); }}>
              <span>{language === 'vi' ? ws3DataSourceLabels[key].vi : ws3DataSourceLabels[key].en}</span>
              <strong>{info?.count.toLocaleString() ?? '—'}</strong>
            </button>;
          })}
        </div>

        <form className="warehouse-mes__filters" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(searchInput.trim()); }}>
          <label><span>{tx('Tìm', 'Search')}</span><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder={tx('Mã đơn, máy, mã cuộn…', 'Order, machine, roll ID…')} /></label>
          <label><span>{tx('Ngày', 'Date')}</span><input type="date" value={date} onChange={(event) => { setDate(event.target.value); setOffset(0); }} /></label>
          <button type="submit" className="is-primary">{tx('Tìm', 'Search')}</button>
          {(search || date) && <button type="button" onClick={clearFilters}>{tx('Xóa lọc', 'Clear')}</button>}
        </form>
      </section>

      {error && <p className="warehouse-mes__error" role="alert">{error}</p>}

      <section className="warehouse-mes__table-wrap" aria-live="polite">
        <MesResizableTable initialWidths={warehouseColumnWidths} storageKey={`ws3-data-warehouse-${source}`}>
          <caption>{tx('Bản ghi kho dữ liệu', 'Data warehouse records')}</caption>
          <thead><tr>
            <MesResizableHeaderCell index={0}>#</MesResizableHeaderCell>
            {visibleColumnIndexes.map((index, headerIndex) => <MesResizableHeaderCell key={`${index}-${columns[index]}`} index={headerIndex + 1}>
              <button type="button" onClick={() => sortRowsBy(index)} aria-label={tx(`Sắp xếp theo ${columns[index]}`, `Sort by ${columns[index]}`)}><span>{columns[index] || tx('Cột chưa đặt tên', 'Unnamed column')}</span><i aria-hidden="true">{sortBy === index ? sortDirection === 'asc' ? '▲' : '▼' : '↕'}</i></button>
            </MesResizableHeaderCell>)}
            <MesResizableHeaderCell index={warehouseColumnWidths.length - 1}>{tx('Ngày nạp', 'Loaded at')}</MesResizableHeaderCell>
          </tr></thead>
          <tbody>{page?.records.map((record, rowIndex) => <tr key={record.id}><td>{offset + rowIndex + 1}</td>{visibleColumnIndexes.map((index) => { const value = record.raw_data.row?.[index] ?? ''; return <MesDataCell key={index} tooltip={value}>{value || '—'}</MesDataCell>; })}<MesDataCell tooltip={record.created_at ? new Date(record.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') : '—'}>{record.created_at ? new Date(record.created_at).toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') : '—'}</MesDataCell></tr>)}</tbody>
        </MesResizableTable>
        {!loading && page?.records.length === 0 && <p className="warehouse-mes__table-empty">{tx('Không có bản ghi phù hợp.', 'No matching records.')}</p>}
        {loading && <p className="warehouse-mes__table-empty">{tx('Đang tải dữ liệu…', 'Loading data…')}</p>}
      </section>

      <footer className="warehouse-mes__pagination">
        <span>{tx('Bản ghi', 'Records')}: <strong>{page?.total.toLocaleString() ?? '—'}</strong><i>·</i>{tx('Trang', 'Page')} {Math.min(totalPages, Math.floor(offset / pageSize) + 1)} / {totalPages}</span>
        <div>{sortBy !== null && <button type="button" onClick={() => { setSortBy(null); setSortDirection('asc'); setOffset(0); }}>{tx('Xóa sắp xếp', 'Clear sort')}</button>}<button type="button" onClick={() => setOffset((value) => Math.max(0, value - pageSize))} disabled={offset === 0 || loading}>{tx('Trước', 'Previous')}</button><button type="button" className="is-primary" onClick={() => setOffset((value) => value + pageSize)} disabled={!page || offset + pageSize >= page.total || loading}>{tx('Tiếp', 'Next')}</button></div>
      </footer>
    </div>
  </WS3MesShell>;
}
