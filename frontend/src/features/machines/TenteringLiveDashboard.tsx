import { useLanguage } from '../../i18n/LanguageContext';
import { MesDataCell } from '../../components/mes/MesDataCell';
import { MesResizableHeaderCell, MesResizableTable } from '../../components/mes/MesResizableTable';
import { readTenterValue, type TenterRealtimeSample, type TenterRealtimeSnapshot } from './tenteringRealtime';
import './TenteringLiveDashboard.css';
import '../../components/mes/MesDataTable.css';

export type TenteringDashboardOrder = {
  sopNo: string;
  customer: string;
  itemDescription: string;
  operatorName: string;
  shift: string;
  plannedQuantity: number | null;
  actualQuantity: number | null;
  rollCount: number;
  progress: 'IN_PROGRESS' | 'COMPLETED';
};

type TenteringLiveDashboardProps = {
  activeSop: string;
  orderProgress: 'IN_PROGRESS' | 'COMPLETED';
  plannedQuantity: number | null;
  actualQuantity: number | null;
  rollCount: number;
  completedRolls: number;
  finishWidthInch: string;
  customer: string;
  itemDescription: string;
  orders: TenteringDashboardOrder[];
  realtime: TenterRealtimeSnapshot;
  showSignals: boolean;
};

function numberText(value: number | null, language: string, maximumFractionDigits = 1) {
  if (value === null || !Number.isFinite(value)) return '—';
  return value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-GB', { maximumFractionDigits });
}

function asNumber(value: string) {
  const number = value.trim() ? Number(value) : null;
  return number !== null && Number.isFinite(number) ? number : null;
}

function progressOf(actual: number | null, planned: number | null) {
  if (actual === null || planned === null || planned <= 0) return null;
  return (actual / planned) * 100;
}

type TrendKey = 'speed' | 'counterA' | 'counterB' | 'counterTotal' | 'width';

function OperationalTrend({ history, valueKey, label }: { history: TenterRealtimeSample[]; valueKey: TrendKey; label: string }) {
  const cutoff = Date.now() - 30 * 60 * 1000;
  const values = history.filter((sample) => sample.time >= cutoff).map((sample) => sample.values[valueKey]).filter((value): value is number => value !== null && Number.isFinite(value));
  if (values.length < 2) return <span className="tenter-dashboard__trend tenter-dashboard__trend--empty" aria-hidden="true" />;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 22 - ((value - minimum) / range) * 20;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(' ');
  return <svg className="tenter-dashboard__trend" viewBox="0 0 100 24" preserveAspectRatio="none" role="img" aria-label={`${label} — 30 minutes`}><polyline points={points} /></svg>;
}

function OperationalCard({ label, value, unit, language, history, trendKey }: {
  label: string;
  value: number | null;
  unit: string;
  language: string;
  history: TenterRealtimeSample[];
  trendKey: TrendKey;
}) {
  return <article className="tenter-dashboard__metric">
    <span>{label}</span>
    <div className="tenter-dashboard__metric-value"><strong>{numberText(value, language)} <em>{unit}</em></strong><OperationalTrend history={history} valueKey={trendKey} label={label} /></div>
  </article>;
}

function SummaryValue({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return <div className={`tenter-dashboard__summary-value ${tone}`}><dt>{label}</dt><dd>{value}</dd></div>;
}

type Translate = (vietnamese: string, english: string) => string;

function ShiftOrders({ orders, language, tx }: { orders: TenteringDashboardOrder[]; language: string; tx: Translate }) {
  const headings = [
    tx('STT', 'No.'), tx('SOP', 'SOP'), tx('Khách hàng', 'Customer'), tx('Mặt hàng', 'Item'), tx('Người vận hành', 'Operator'), tx('Ca', 'Shift'),
    tx('Cuộn', 'Rolls'), tx('Kế hoạch', 'Planned'), tx('Thực tế', 'Actual'), tx('Chênh lệch', 'Variance'), tx('Trạng thái', 'Status'),
  ];
  return <section className="tenter-dashboard__panel tenter-dashboard__orders">
    <div className="tenter-dashboard__table-wrap"><MesResizableTable initialWidths={[42, 90, 124, 218, 108, 60, 50, 90, 90, 94, 108]} storageKey="tenter-dashboard-shift-orders-v4" className="tenter-dashboard__table mes-data-table"><thead><tr>
      {headings.map((heading, index) => <MesResizableHeaderCell key={heading} index={index}>{heading}</MesResizableHeaderCell>)}
    </tr></thead><tbody>{orders.length ? orders.map((order, index) => {
      const variance = order.actualQuantity !== null && order.plannedQuantity !== null ? order.actualQuantity - order.plannedQuantity : null;
      return <tr key={`${order.sopNo}-${order.shift}`}>
        <MesDataCell className="is-index">{index + 1}</MesDataCell><MesDataCell className="is-sop" tooltip={order.sopNo}>{order.sopNo}</MesDataCell><MesDataCell tooltip={order.customer || '—'}>{order.customer || '—'}</MesDataCell><MesDataCell className="is-item" tooltip={order.itemDescription || '—'}>{order.itemDescription || '—'}</MesDataCell><MesDataCell tooltip={order.operatorName || '—'}>{order.operatorName || '—'}</MesDataCell><MesDataCell tooltip={order.shift || '—'}>{order.shift || '—'}</MesDataCell><MesDataCell className="is-number" tooltip={String(order.rollCount)}>{order.rollCount}</MesDataCell><MesDataCell className="is-number" tooltip={`${numberText(order.plannedQuantity, language)} m`}>{numberText(order.plannedQuantity, language)} m</MesDataCell><MesDataCell className="is-number" tooltip={`${numberText(order.actualQuantity, language)} m`}>{numberText(order.actualQuantity, language)} m</MesDataCell>
        <MesDataCell className={`is-number ${variance === null ? '' : variance < 0 ? 'is-negative' : 'is-positive'}`} tooltip={variance === null ? '—' : `${variance > 0 ? '+' : ''}${numberText(variance, language)} m`}>{variance === null ? '—' : `${variance > 0 ? '+' : ''}${numberText(variance, language)} m`}</MesDataCell>
        <MesDataCell className={`tenter-dashboard__order-state ${order.progress === 'COMPLETED' ? 'is-completed' : 'is-progress'}`} tooltip={order.progress === 'COMPLETED' ? tx('Hoàn thành', 'Completed') : tx('Đang xử lý', 'In progress')}>{order.progress === 'COMPLETED' ? tx('Hoàn thành', 'Completed') : tx('Đang xử lý', 'In progress')}</MesDataCell>
      </tr>;
    }) : <tr><td colSpan={11} className="tenter-dashboard__table-empty" aria-label={tx('Chưa có dữ liệu đơn hàng.', 'No order data yet.')} /></tr>}</tbody></MesResizableTable></div>
  </section>;
}

export function TenteringLiveDashboard({ activeSop, orderProgress, plannedQuantity, actualQuantity, rollCount, completedRolls, finishWidthInch, customer, itemDescription, orders, realtime, showSignals }: TenteringLiveDashboardProps) {
  const { language } = useLanguage();
  const tx: Translate = (vietnamese, english) => language === 'vi' ? vietnamese : english;
  const readings = realtime.machine?.readingValues ?? {};
  const speed = readTenterValue(readings, [['speed_and_width', 'speed'], ['speed_and_width', 'Tốc độ']]);
  const counterA = readTenterValue(readings, [['speed_and_width', 'Counter A']]);
  const counterB = readTenterValue(readings, [['speed_and_width', 'Counter B']]);
  const counterTotal = readTenterValue(readings, [['speed_and_width', 'Counter Total']]);
  const widthProfile = readTenterValue(readings, [
    ['speed_and_width', 'width'],
    ['speed_and_width', 'Width'],
    ['speed_and_width', 'Width profile'],
    ['speed_and_width', 'Width Profile'],
  ]);
  const actual = actualQuantity;
  const completion = progressOf(actual, plannedQuantity);
  const variance = actual !== null && plannedQuantity !== null ? actual - plannedQuantity : null;
  const width = asNumber(finishWidthInch);
  const progressTone = completion === null
    ? 'is-neutral'
    : orderProgress === 'COMPLETED' && completion < 100
      ? 'is-alert'
      : orderProgress === 'COMPLETED'
        ? 'is-complete'
        : 'is-progress';

  return <section className="tenter-dashboard" aria-label={tx('Theo dõi vận hành Tentering', 'Tentering operations monitor')}>
    {showSignals && <section className="tenter-dashboard__signals" aria-label={tx('Thông số máy realtime', 'Realtime machine signals')}>
      <div className="tenter-dashboard__metrics">
        <OperationalCard label={tx('Tốc độ', 'Speed')} value={speed} unit="m/phút" language={language} history={realtime.history} trendKey="speed" />
        <OperationalCard label="Counter A" value={counterA} unit="m" language={language} history={realtime.history} trendKey="counterA" />
        <OperationalCard label="Counter B" value={counterB} unit="m" language={language} history={realtime.history} trendKey="counterB" />
        <OperationalCard label="Counter Total" value={counterTotal} unit="m" language={language} history={realtime.history} trendKey="counterTotal" />
        <OperationalCard label="Width profile" value={widthProfile} unit="mm" language={language} history={realtime.history} trendKey="width" />
      </div>
    </section>
    }

    <section className={`tenter-dashboard__sop ${activeSop ? 'has-sop' : 'is-empty'}`}>
      {activeSop ? <>
        <div className={`tenter-dashboard__progress ${progressTone}`}><span>{tx('Tiến độ SOP', 'SOP progress')}</span><strong>{completion === null ? '—' : `${numberText(completion, language, 0)}%`}</strong><i><b style={{ width: `${Math.min(100, Math.max(0, completion ?? 0))}%` }} /></i></div>
        <dl>
          <SummaryValue label={tx('Mã SOP', 'SOP number')} value={activeSop} />
          <SummaryValue label={tx('Khách hàng / mặt hàng', 'Customer / item')} value={[customer, itemDescription].filter(Boolean).join(' · ') || '—'} />
          <SummaryValue label={tx('Kế hoạch', 'Planned')} value={`${numberText(plannedQuantity, language)} m`} />
          <SummaryValue label={tx('Thực tế', 'Actual')} value={`${numberText(actual, language)} m`} />
          <SummaryValue label={tx('Chênh lệch', 'Variance')} value={variance === null ? '—' : `${variance > 0 ? '+' : ''}${numberText(variance, language)} m`} tone={variance === null ? '' : variance < 0 ? 'is-negative' : 'is-positive'} />
          <SummaryValue label={tx('Cuộn hoàn tất', 'Completed rolls')} value={`${completedRolls} / ${rollCount}`} />
          <SummaryValue label={tx('Khổ thành phẩm', 'Finish width')} value={width === null ? '—' : `${numberText(width, language)} in`} />
        </dl>
      </> : <p>{tx('Nhập mã SOP ở phần thông tin vận hành để liên kết counter và theo dõi kế hoạch sản xuất.', 'Enter an SOP in the operation panel to link the counters and monitor the production plan.')}</p>}
    </section>

    <ShiftOrders orders={orders} language={language} tx={tx} />

  </section>;
}
