import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { formatShiftLabel } from '../../components/mes/operations/shiftLabels';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { downloadTenteringReport, getTenteringOrders, type TenteringOrder } from './tenteringApi';
import { TENTERING_MACHINES, TenteringNavigation } from './TenteringNavigation';
import { MesDataCell } from '../../components/mes/MesDataCell';
import { MesResizableHeaderCell, MesResizableTable } from '../../components/mes/MesResizableTable';
import './TenteringPage.css';
import '../../components/mes/MesDataTable.css';

function dateText(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? value : date.toLocaleDateString(locale);
}

function dateTimeText(value: string | null | undefined, locale: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(date)
    .replace(',', ' -');
}

function quantityText(
  entries: TenteringOrder['entries'],
  field: 'planned_quantity' | 'actual_quantity',
  locale: string,
) {
  const values = entries
    .map((entry) => entry[field])
    .filter((value): value is number => value !== null);
  return values.length
    ? values
        .reduce((total, value) => total + value, 0)
        .toLocaleString(locale, { maximumFractionDigits: 3 })
    : '—';
}

function savedDateKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? ''
    : new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
}

function numberText(value: number | null, locale: string) {
  return value === null ? '—' : value.toLocaleString(locale, { maximumFractionDigits: 3 });
}

function widthText(value: number | null, locale: string) {
  if (value === null) return '—';
  return `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} in · ${(value * 2.54).toLocaleString(locale, { maximumFractionDigits: 1 })} cm`;
}

export function TenteringHistoryPage({
  machineId: routeMachineId = 'TE-01',
}: {
  machineId?: string;
}) {
  const { user } = useAuth();
  const { language } = useLanguage();
  const vi = language === 'vi';
  const tx = useCallback(
    (vietnamese: string, english: string) => (vi ? vietnamese : english),
    [vi],
  );
  const locale = vi ? 'vi-VN' : 'en-GB';
  const machineId = TENTERING_MACHINES.some(
    (machine) => machine.id === routeMachineId.toUpperCase(),
  )
    ? routeMachineId.toUpperCase()
    : 'TE-01';
  const [orders, setOrders] = useState<TenteringOrder[]>([]);
  const [query, setQuery] = useState('');
  const [savedDate, setSavedDate] = useState('');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [expandedOrders, setExpandedOrders] = useState<Set<number>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void getTenteringOrders(machineId)
      .then((items) => {
        if (active) setOrders(items);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : tx('Không tải được lịch sử Tentering.', 'Unable to load Tentering history.'),
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [machineId, tx]);

  const filteredOrders = useMemo(
    () =>
      orders
        .filter((order) => {
          const text = `${order.sop_no} ${order.customer ?? ''} ${order.item_description ?? ''} ${order.entries.map((entry) => `${entry.roll_id ?? ''} ${entry.note ?? ''}`).join(' ')}`;
          return (
            (!query.trim() ||
              text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) &&
            (!savedDate || savedDateKey(order.updated_at) === savedDate)
          );
        })
        .sort((left, right) => {
          const leftTime = Date.parse(left.updated_at);
          const rightTime = Date.parse(right.updated_at);
          const safeLeft = Number.isNaN(leftTime) ? 0 : leftTime;
          const safeRight = Number.isNaN(rightTime) ? 0 : rightTime;
          return sortDirection === 'desc' ? safeRight - safeLeft : safeLeft - safeRight;
        }),
    [orders, query, savedDate, sortDirection],
  );

  const exportExcel = async () => {
    if (loading || exporting || !filteredOrders.length) return;
    setExporting(true);
    setExportError('');
    try {
      const blob = await downloadTenteringReport({
        machineId,
        savedDate,
        query,
        language: vi ? 'vi' : 'en',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tentering-report-${machineId.toLowerCase()}-${savedDate || 'all'}.xlsx`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setExportError(
        reason instanceof Error
          ? reason.message
          : tx('Không thể xuất báo cáo Excel.', 'Unable to download Excel report.'),
      );
    } finally {
      setExporting(false);
    }
  };

  const headers = [
    tx('Cập nhật gần nhất', 'Last updated'),
    tx('Mã SOP', 'SOP'),
    tx('Khách hàng', 'Customer'),
    tx('Loại mặt hàng', 'Item'),
    tx('Số cuộn đã ghi', 'Rolls recorded'),
    tx('SL theo đơn', 'Planned total'),
    tx('SL thực tế', 'Actual total'),
    tx('Người vận hành', 'Operator'),
    tx('Ca', 'Shift'),
    tx('Tiến độ', 'Progress'),
    tx('Chi tiết', 'Details'),
  ];
  const detailHeaders = [
    tx('Cuộn', 'Roll'),
    tx('Mã cuộn', 'Roll ID'),
    tx('Ngày dệt', 'Weaving date'),
    tx('Theo đơn', 'Planned'),
    tx('Thực tế', 'Actual'),
    tx('Ghi chú', 'Note'),
  ];

  return (
    <WS3MesShell
      module={tx('Định hình', 'Tentering')}
      breadcrumbs={[]}
      navigation={<TenteringNavigation machineId={machineId} history showMachineSelector />}
      showSupportWidget={user?.role !== 'OPERATOR'}
    >
      <div className="tentering-history-page">
        <section className="tentering-history__filterbar">
          <div className="tentering-history__filter-fields">
            <label className="tentering-history__search-field">
              <span>{tx('Tìm kiếm', 'Search')}</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={tx(
                  'Nhập SOP, khách hàng, mặt hàng hoặc mã cuộn…',
                  'Enter SOP, customer, item or roll ID…',
                )}
              />
            </label>
            <label className="tentering-history__date-field">
              <span>{tx('Ngày', 'Date')}</span>
              <input
                type="date"
                value={savedDate}
                onChange={(event) => setSavedDate(event.target.value)}
              />
            </label>
            <label className="tentering-history__sort-field">
              <span>{tx('Sắp xếp', 'Sort')}</span>
              <select
                value={sortDirection}
                onChange={(event) => setSortDirection(event.target.value as 'desc' | 'asc')}
              >
                <option value="desc">{tx('Mới nhất', 'Newest')}</option>
                <option value="asc">{tx('Cũ nhất', 'Oldest')}</option>
              </select>
            </label>
          </div>
          <div className="tentering-history__actions">
            <button
              type="button"
              className="tentering-history__export"
              onClick={() => void exportExcel()}
              disabled={loading || exporting || !filteredOrders.length}
            >
              {exporting ? tx('Đang xuất…', 'Exporting…') : tx('Xuất Excel', 'Export Excel')}
            </button>
          </div>
        </section>
        {exportError && (
          <p role="alert" className="tentering-history__error">
            {tx('Không thể xuất Excel:', 'Unable to export Excel:')} {exportError}
          </p>
        )}
        {error && (
          <p role="alert" className="tentering-history__error">
            {error}
          </p>
        )}
        {loading ? (
          <p className="tentering-history__message">
            {tx('Đang tải lịch sử…', 'Loading history…')}
          </p>
        ) : !error && !filteredOrders.length ? (
          <p className="tentering-history__message">
            {tx('Chưa có bản ghi Tentering phù hợp.', 'No matching Tentering records.')}
          </p>
        ) : (
          !error && (
            <div className="tentering-history__table-wrap">
              <MesResizableTable
                initialWidths={[146, 118, 136, 150, 88, 106, 106, 122, 68, 108, 92]}
                storageKey={`tentering-history-v2-${machineId}`}
                className="tentering-history__table mes-data-table"
              >
                <thead>
                  <tr>
                    {headers.map((heading, index) => (
                      <MesResizableHeaderCell key={heading} index={index}>
                        {heading}
                      </MesResizableHeaderCell>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => {
                    const expanded = expandedOrders.has(order.id);
                    return (
                      <Fragment key={order.id}>
                        <tr>
                          <MesDataCell tooltip={dateTimeText(order.updated_at, locale)}>
                            {dateTimeText(order.updated_at, locale)}
                          </MesDataCell>
                          <MesDataCell className="is-mono" tooltip={order.sop_no}>
                            {order.sop_no}
                          </MesDataCell>
                          <MesDataCell tooltip={order.customer || '—'}>
                            {order.customer || '—'}
                          </MesDataCell>
                          <MesDataCell tooltip={order.item_description || '—'}>
                            {order.item_description || '—'}
                          </MesDataCell>
                          <MesDataCell className="is-number" tooltip={String(order.entries.length)}>
                            {order.entries.length}
                          </MesDataCell>
                          <MesDataCell
                            className="is-number"
                            tooltip={quantityText(order.entries, 'planned_quantity', locale)}
                          >
                            {quantityText(order.entries, 'planned_quantity', locale)}
                          </MesDataCell>
                          <MesDataCell
                            className="is-number"
                            tooltip={quantityText(order.entries, 'actual_quantity', locale)}
                          >
                            {quantityText(order.entries, 'actual_quantity', locale)}
                          </MesDataCell>
                          <MesDataCell tooltip={order.operator_name || '—'}>
                            {order.operator_name || '—'}
                          </MesDataCell>
                          <MesDataCell tooltip={formatShiftLabel(order.shift, language)}>
                            {formatShiftLabel(order.shift, language) || '—'}
                          </MesDataCell>
                          <MesDataCell
                            tooltip={
                              order.order_progress === 'COMPLETED'
                                ? tx('Đã hoàn thành', 'Completed')
                                : tx('Đang xử lý', 'In progress')
                            }
                          >
                            <span
                              className={`tentering-history__progress ${order.order_progress === 'COMPLETED' ? 'is-completed' : 'is-progress'}`}
                            >
                              {order.order_progress === 'COMPLETED'
                                ? tx('Đã hoàn thành', 'Completed')
                                : tx('Đang xử lý', 'In progress')}
                            </span>
                          </MesDataCell>
                          <td>
                            <button
                              type="button"
                              className="tentering-history__detail-button"
                              aria-expanded={expanded}
                              onClick={() =>
                                setExpandedOrders((current) => {
                                  const next = new Set(current);
                                  if (next.has(order.id)) next.delete(order.id);
                                  else next.add(order.id);
                                  return next;
                                })
                              }
                            >
                              {expanded ? tx('Thu gọn', 'Collapse') : tx('Xem cuộn', 'View rolls')}
                            </button>
                          </td>
                        </tr>
                        {expanded && (
                          <tr className="tentering-history__detail-row">
                            <td colSpan={headers.length}>
                              <div className="tentering-history__detail-grid">
                                <section className="tentering-history__detail-card">
                                  <h3>{tx('Đơn hàng', 'Order')}</h3>
                                  <dl>
                                    <div>
                                      <dt>{tx('Khách hàng', 'Customer')}</dt>
                                      <dd>{order.customer || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Loại mặt hàng', 'Item')}</dt>
                                      <dd>{order.item_description || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Sợi dọc', 'Warp yarn')}</dt>
                                      <dd>{order.warp_yarn || '—'}</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Sợi ngang', 'Weft yarn')}</dt>
                                      <dd>{order.weft_yarn || '—'}</dd>
                                    </div>
                                  </dl>
                                </section>
                                <section className="tentering-history__detail-card">
                                  <h3>{tx('Mật độ', 'Density')}</h3>
                                  <dl>
                                    <div>
                                      <dt>{tx('Mật độ mộc', 'Greige density')}</dt>
                                      <dd>{numberText(order.greige_density_pick, locale)} pick</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Mật độ thành phẩm', 'Finish density')}</dt>
                                      <dd>{numberText(order.finish_density_pick, locale)} pick</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Co rút', 'Shrinkage')}</dt>
                                      <dd>
                                        {order.shrink_percent === null
                                          ? '—'
                                          : `${numberText(order.shrink_percent, locale)}%`}
                                      </dd>
                                    </div>
                                  </dl>
                                </section>
                                <section className="tentering-history__detail-card">
                                  <h3>{tx('Khổ rộng', 'Width')}</h3>
                                  <dl>
                                    <div>
                                      <dt>{tx('Khổ mộc', 'Greige width')}</dt>
                                      <dd>{widthText(order.greige_width_inch, locale)}</dd>
                                    </div>
                                    <div>
                                      <dt>{tx('Khổ thành phẩm', 'Finish width')}</dt>
                                      <dd>{widthText(order.finish_width_inch, locale)}</dd>
                                    </div>
                                  </dl>
                                </section>
                              </div>
                              <div className="tentering-history__table-wrap">
                                <MesResizableTable
                                  initialWidths={[72, 150, 116, 108, 108, 220]}
                                  storageKey={`tentering-rolls-${machineId}`}
                                  className="tentering-history__roll-table mes-data-table"
                                >
                                  <thead>
                                    <tr>
                                      {detailHeaders.map((heading, index) => (
                                        <MesResizableHeaderCell key={heading} index={index}>
                                          {heading}
                                        </MesResizableHeaderCell>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.entries.map((entry) => (
                                      <tr key={entry.id}>
                                        <td>{entry.roll_number}</td>
                                        <MesDataCell tooltip={entry.roll_id || '—'}>
                                          {entry.roll_id || '—'}
                                        </MesDataCell>
                                        <td>{dateText(entry.weaving_date, locale)}</td>
                                        <MesDataCell
                                          className="is-number"
                                          tooltip={
                                            entry.planned_quantity === null
                                              ? '—'
                                              : String(entry.planned_quantity)
                                          }
                                        >
                                          {entry.planned_quantity ?? '—'}
                                        </MesDataCell>
                                        <MesDataCell
                                          className="is-number"
                                          tooltip={
                                            entry.actual_quantity === null
                                              ? '—'
                                              : String(entry.actual_quantity)
                                          }
                                        >
                                          {entry.actual_quantity ?? '—'}
                                        </MesDataCell>
                                        <MesDataCell tooltip={entry.note || '—'}>
                                          {entry.note || '—'}
                                        </MesDataCell>
                                      </tr>
                                    ))}
                                  </tbody>
                                </MesResizableTable>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </MesResizableTable>
            </div>
          )
        )}
        <footer className="tentering-history__footer">
          {filteredOrders.length} / {orders.length} {tx('bản ghi', 'records')}
        </footer>
      </div>
    </WS3MesShell>
  );
}
