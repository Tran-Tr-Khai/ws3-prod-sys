import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { getWS3ProductionReport, type WS3ProductionReport } from './ws3OrderApi';
import { printProductionOrder } from './printProductionOrder';
import { WS3DataFlowNav } from './WS3DataFlowNav';
import './WS3ProductionOrdersPage.css';

function statusLabel(status: 'READY' | 'CHECK', language: 'vi' | 'en') {
  if (status === 'READY') return language === 'vi' ? 'Đủ thông tin' : 'Ready';
  return language === 'vi' ? 'Cần kiểm tra' : 'Needs review';
}

export function WS3ProductionOrdersPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = useCallback((vi: string, en: string) => language === 'vi' ? vi : en, [language]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [report, setReport] = useState<WS3ProductionReport | null>(null);
  const [selected, setSelected] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const allowed = Boolean(user && ['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role));
  const order = useMemo(() => report?.orders.find((item) => item.pk_no === selected) ?? null, [report, selected]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const result = await getWS3ProductionReport(date);
      setReport(result);
      setSelected((current) => result.orders.some((item) => item.pk_no === current) ? current : '');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : tx('Không thể tải báo cáo đơn.', 'Unable to load the production report.'));
    } finally {
      setLoading(false);
    }
  }, [date, tx]);

  useEffect(() => { void load(); }, [load]);

  return <WS3MesShell module={tx('Đơn Unrolling', 'Unrolling orders')} breadcrumbs={[]} navigation={<WS3DataFlowNav />}>
    <div className="unrolling-mes">
      {!allowed ? <section className="unrolling-mes__empty" role="alert">
        {tx('Bạn không có quyền xem thông tin đơn Unrolling.', 'You are not allowed to view Unrolling order information.')}
      </section> : <div className="unrolling-mes__content">
        <section className="unrolling-mes__controlbar" aria-label={tx('Điều khiển danh sách đơn', 'Order-list controls')}>
          <div className="unrolling-mes__overview" aria-label={tx('Tổng quan đơn sản xuất', 'Production-order overview')}>
            <span className="unrolling-mes__view-label">{tx('Lệnh sản xuất', 'Production orders')}</span>
            <span><small>{tx('Tổng', 'Total')}</small><strong>{report?.summary.orders ?? '—'}</strong></span>
            <span data-tone="success"><small>{tx('Sẵn sàng', 'Ready')}</small><strong>{report?.summary.ready ?? '—'}</strong></span>
            <span data-tone={report?.summary.check ? 'warning' : 'normal'}><small>{tx('Rà soát', 'Review')}</small><strong>{report?.summary.check ?? '—'}</strong></span>
          </div>
          <div className="unrolling-mes__filters">
            <label><span>{tx('Ngày', 'Date')}</span><input type="date" value={date} disabled={loading} onChange={(event) => setDate(event.target.value)} /></label>
            <button type="button" className="is-primary" onClick={() => void load()} disabled={loading}>
              {loading ? tx('Đang tải…', 'Loading…') : tx('Làm mới', 'Refresh')}
            </button>
          </div>
        </section>

        {message && <p className="unrolling-mes__error" role="alert">{message}</p>}

        <div className="unrolling-mes__workspace" data-detail={order ? 'open' : undefined}>
          <section className="unrolling-mes__orders" aria-label={tx('Danh sách đơn', 'Order list')} aria-busy={loading}>
            <table>
              <caption>{tx('Danh sách đơn Unrolling', 'Unrolling order list')}</caption>
              <thead><tr>
                <th>{tx('Mã đơn', 'Order')}</th>
                <th>{tx('Ngày', 'Date')}</th>
                <th>{tx('Mã hàng', 'Item code')}</th>
                <th>LOT</th>
                <th className="is-number">{tx('Cuộn khớp', 'Matched rolls')}</th>
                <th>{tx('Trạng thái', 'Status')}</th>
                <th aria-label={tx('Thao tác', 'Action')} />
              </tr></thead>
              <tbody>
                {report?.orders.map((item) => <tr key={item.pk_no} data-selected={order?.pk_no === item.pk_no || undefined}>
                  <td><button className="unrolling-mes__order-link" type="button" onClick={() => setSelected(item.pk_no)}>{item.pk_no}</button></td>
                  <td>{item.production_date}</td>
                  <td>{item.item_code || '—'}</td>
                  <td>{item.lot_no || '—'}</td>
                  <td className="is-number">{item.matched_rolls}/{item.expected_rolls}</td>
                  <td><span className="unrolling-mes__status" data-tone={item.status === 'READY' ? 'success' : 'warning'}>{statusLabel(item.status, language)}</span></td>
                  <td><button className="unrolling-mes__open-detail" type="button" onClick={() => setSelected(item.pk_no)}>{tx('Chi tiết', 'Details')}</button></td>
                </tr>)}
              </tbody>
            </table>
            {loading && <p className="unrolling-mes__table-empty">{tx('Đang tải dữ liệu đơn…', 'Loading orders…')}</p>}
            {!loading && !report?.orders.length && <p className="unrolling-mes__table-empty">{tx('Không có đơn theo ngày đã chọn.', 'No orders for the selected date.')}</p>}
          </section>

          {order && <aside className="unrolling-mes__detail" aria-live="polite" aria-label={tx('Chi tiết đơn sản xuất', 'Production-order details')}>
            <header className="unrolling-mes__detail-header">
              <div>
                <h1>{order.pk_no}</h1>
                <p>{order.production_date} <span>·</span> SOP: {order.sop_no || '—'}</p>
              </div>
              <div className="unrolling-mes__detail-actions">
                <span data-tone={order.status === 'READY' ? 'success' : 'warning'}>{statusLabel(order.status, language)}</span>
                <button type="button" disabled={order.matched_rolls === 0} onClick={() => printProductionOrder(order, language)}>{tx('In phiếu', 'Print slips')}</button>
                <button className="unrolling-mes__close-detail" type="button" onClick={() => setSelected('')} aria-label={tx('Đóng chi tiết', 'Close details')}>×</button>
              </div>
            </header>

            <dl className="unrolling-mes__order-context">
              <div><dt>{tx('Mã hàng', 'Item code')}</dt><dd>{order.item_code || '—'}</dd></div>
              <div><dt>{tx('Tên hàng', 'Item name')}</dt><dd>{order.item_name || '—'}</dd></div>
              <div><dt>LOT</dt><dd>{order.lot_no || '—'}</dd></div>
              <div><dt>{tx('Cuộn khớp', 'Matched rolls')}</dt><dd>{order.matched_rolls}/{order.expected_rolls}</dd></div>
            </dl>

            {order.warnings.length > 0 && <div className="unrolling-mes__warning" role="status">
              <strong>{tx('Cần kiểm tra dữ liệu nguồn', 'Source data needs review')}</strong>
              <ul>{order.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
            </div>}

            <div className="unrolling-mes__rolls">
              <table>
                <caption>{tx('Danh sách cuộn theo đơn', 'Order roll list')}</caption>
                <thead><tr>
                  <th>{tx('Mã cuộn', 'Roll ID')}</th>
                  <th>{tx('Máy', 'Machine')}</th>
                  <th>{tx('Ca', 'Shift')}</th>
                  <th className="is-number">{tx('Mét', 'Meters')}</th>
                </tr></thead>
                <tbody>{order.rolls.map((roll, index) => <tr key={`${roll.out_no}-${index}`}>
                  <td className="is-strong">{roll.roll_id || '—'}</td>
                  <td>{roll.machine_no || '—'}</td>
                  <td>{roll.shift || '—'}</td>
                  <td className="is-number">{roll.length_meters?.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB') ?? '—'}</td>
                </tr>)}</tbody>
              </table>
              {!order.rolls.length && <p className="unrolling-mes__table-empty">{tx('Đơn chưa có dữ liệu cuộn.', 'This order has no roll data.')}</p>}
            </div>
          </aside>}
        </div>
      </div>}
    </div>
  </WS3MesShell>;
}
