import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { formatShiftLabel } from '../../components/hmi/ShiftSelect';
import { WS3DataFlowNav } from '../orders/WS3DataFlowNav';
import { MesDataCell } from '../../components/mes/MesDataCell';
import { MesResizableHeaderCell, MesResizableTable } from '../../components/mes/MesResizableTable';
import type { MachineOverviewSummary, OverviewField, OverviewTone } from './MachineOverviewCard';
import { useMachineOverview } from './useMachineOverview';
import './WS3OverviewPage.css';
import '../../components/mes/MesDataTable.css';

type ProcessDefinition = { name: string; code: string; available: boolean; actionAvailable?: boolean };
type DashboardRow = {
  process: ProcessDefinition;
  machineId: string;
  summary: MachineOverviewSummary;
  href: string;
  actionLabel: string;
};
type RowStatus = { label: string; tone: OverviewTone };

const processes: ProcessDefinition[] = [
  { name: 'Unrolling', code: 'UN-01', available: true },
  { name: 'Buffing', code: 'BU-01', available: true },
  { name: 'Scouring', code: 'SC-01', available: true, actionAvailable: false },
  { name: 'Dyeing', code: 'DY-01', available: false },
  { name: 'Washing', code: 'WA-01', available: false },
  { name: 'Skachar', code: 'SK-01', available: false },
  { name: 'Tentering', code: 'TE-01', available: true },
  { name: 'Calendaring', code: 'CA-01', available: false },
  { name: 'Raising', code: 'RA-01', available: false },
  { name: 'Sueding', code: 'SU-01', available: false },
  { name: 'Transfer', code: 'TR-01', available: true, actionAvailable: false },
  { name: 'Print', code: 'PR-01', available: true, actionAvailable: false },
];

const overviewMachineFilterKey = 'ws3.overview.selected-machines.v4';
const legacyOverviewMachineFilterKeys = ['ws3.overview.selected-machines.v3', 'ws3.overview.selected-machines.v2', 'ws3.overview.selected-machines'];
const defaultOverviewMachineCodes = ['UN-01', 'BU-01', 'SC-01', 'TE-01', 'TR-01', 'PR-01'];
const overviewFilterProcesses = processes.filter((process) => process.available);

function getInitialOverviewMachineSelection(): string[] {
  try {
    const currentValue = window.localStorage.getItem(overviewMachineFilterKey);
    const migratingLegacySelection = currentValue === null;
    const legacyValue = legacyOverviewMachineFilterKeys.map((key) => window.localStorage.getItem(key)).find((value) => value !== null);
    const stored: unknown = JSON.parse(currentValue ?? legacyValue ?? 'null');
    if (Array.isArray(stored) && stored.every((code) => typeof code === 'string')) {
      const validCodes = new Set(overviewFilterProcesses.map((process) => process.code));
      const normalizedStored = stored.map((code) => code === 'HT-01' ? 'TR-01' : code);
      const selection = normalizedStored.filter((code): code is string => validCodes.has(code));
      if (stored.includes('TE-02') && !selection.includes('TE-01')) selection.push('TE-01');
      if (migratingLegacySelection && !selection.includes('TR-01')) selection.push('TR-01');
      if (!selection.includes('PR-01')) selection.push('PR-01');
      return selection;
    }
  } catch {
    // Use operational defaults when saved preferences are unavailable.
  }
  return defaultOverviewMachineCodes;
}

function field(summary: MachineOverviewSummary, key: string): OverviewField | undefined {
  return [...summary.operation, ...summary.production, ...(summary.statuses ?? [])].find((item) => item.key === key);
}

function text(value: OverviewField['value']): string {
  return value == null || value === '' ? '—' : String(value);
}

function sentenceCase(value: OverviewField['value']): string {
  const label = text(value);
  if (label === '—') return label;
  const lower = label.toLocaleLowerCase('vi-VN');
  return lower.charAt(0).toLocaleUpperCase('vi-VN') + lower.slice(1);
}

function rowStatus(summary: MachineOverviewSummary, tx: (vi: string, en: string) => string): RowStatus {
  const checks = field(summary, 'checks');
  const inspection = field(summary, 'inspection');
  const progress = field(summary, 'progress');
  if (checks?.tone === 'alarm') return { label: tx('Cần xử lý', 'Needs attention'), tone: 'alarm' };
  if (inspection?.tone === 'warning') return { label: tx('Cảnh báo', 'Warning'), tone: 'warning' };
  if (progress?.value && progress.tone === 'success') return { label: sentenceCase(progress.value), tone: 'success' };
  if (progress?.value && progress.tone === 'info') return { label: sentenceCase(progress.value), tone: 'info' };
  if (field(summary, 'recorded')?.value) return { label: tx('Đã cập nhật', 'Updated'), tone: 'normal' };
  return { label: tx('Chờ dữ liệu', 'Waiting for data'), tone: 'muted' };
}

function orderReference(summary: MachineOverviewSummary): string {
  const sop = text(field(summary, 'sop')?.value);
  const item = text(field(summary, 'item')?.value);
  const lot = text(field(summary, 'lot')?.value);
  const identifiers = [item, lot].filter((value) => value !== '—');
  return [sop, identifiers.join(' · ')].filter((value) => value !== '—' && value !== '').join(' / ') || '—';
}

function outputSummary(summary: MachineOverviewSummary): string {
  const input = text(field(summary, 'input')?.value);
  const output = text(field(summary, 'output')?.value);
  const rolls = text(field(summary, 'rolls')?.value);
  const quantity = input !== '—' && output !== '—' ? `${input} → ${output}` : output !== '—' ? output : input;
  return [quantity, rolls !== '—' ? rolls : null].filter(Boolean).join(' · ') || '—';
}

function operatorSummary(summary: MachineOverviewSummary, language: string): string {
  return [formatShiftLabel(text(field(summary, 'shift')?.value), language), text(field(summary, 'operator')?.value)]
    .filter((value) => value && value !== '—').join(' · ') || '—';
}

function alertSummary(summary: MachineOverviewSummary): { value: string; tone: OverviewTone } {
  const checks = field(summary, 'checks');
  const inspection = field(summary, 'inspection');
  if (checks?.tone === 'alarm') return { value: text(checks.value), tone: 'alarm' };
  if (inspection?.tone === 'warning') return { value: text(inspection.value), tone: 'warning' };
  return { value: '—', tone: 'muted' };
}

function DashboardDetail({ row, onClose, operationLabel, productionLabel, closeLabel }: {
  row: DashboardRow;
  onClose: () => void;
  operationLabel: string;
  productionLabel: string;
  closeLabel: string;
}) {
  const section = (title: string, fields: OverviewField[], message: MachineOverviewSummary['operationMessage']) => <section className="ws3-dashboard__detail-section">
    <h3>{title}</h3>
    {fields.length > 0 && <dl className="ws3-dashboard__detail-fields">
      {fields.map((item) => <div key={item.key} className={item.fullWidth ? 'is-wide' : undefined}>
        <dt>{item.label}</dt><dd data-tone={item.tone ?? 'normal'}>{text(item.value)}</dd>
      </div>)}
    </dl>}
    {message && <p className="ws3-dashboard__detail-message" data-tone={message.tone ?? 'muted'}>{message.text}</p>}
  </section>;

  return <aside className="ws3-dashboard__detail" aria-label={`${row.process.name} details`}>
    <header className="ws3-dashboard__detail-header">
      <div><p>{row.machineId}</p><h2>{row.process.name}</h2></div>
      <button type="button" aria-label={closeLabel} onClick={onClose}>×</button>
    </header>
    <div className="ws3-dashboard__detail-content">
      {section(operationLabel, row.summary.operation, row.summary.operationMessage)}
      {section(productionLabel, [...row.summary.production, ...(row.summary.statuses ?? [])], row.summary.productionMessage)}
    </div>
    <footer><Link to={row.href}>{row.actionLabel}</Link></footer>
  </aside>;
}

export function WS3OverviewPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const canManageOrders = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [selectedMachineCodes, setSelectedMachineCodes] = useState<string[]>(getInitialOverviewMachineSelection);
  const [selectedDetail, setSelectedDetail] = useState<string | null>(null);
  const availableTenteringMachines = user?.role === 'OPERATOR'
    ? ['TE-01', 'TE-02'].filter((machineId) => user.machineIds.includes(machineId)) : ['TE-01', 'TE-02'];
  const { summaries, error } = useMachineOverview();
  const prefix = (code: string) => code.split('-')[0];
  const visibleProcesses = canManageOrders ? processes : [
    ...processes.filter((process) => process.available && (user?.machineIds.includes(process.code) || (process.name === 'Tentering' && availableTenteringMachines.length > 0))),
    ...(user?.machineIds ?? []).flatMap((machineId) => {
      const definition = processes.find((process) => !process.available && prefix(process.code) === prefix(machineId));
      return definition ? [{ ...definition, code: machineId }] : [];
    }),
  ];
  const displayedProcesses = canManageOrders
    ? visibleProcesses.filter((process) => process.name === 'Tentering' || selectedMachineCodes.includes(process.code))
    : visibleProcesses;
  const expandedProcesses = displayedProcesses.flatMap((process) => process.name === 'Tentering'
    ? availableTenteringMachines.map((machineId) => ({ ...process, code: machineId }))
    : [process]);
  const genericSummary = (machineId: string, isTransfer: boolean): MachineOverviewSummary => ({
    operation: [{ key: 'machine', label: t('machine'), value: machineId }],
    operationMessage: { text: tx('Chưa có thông tin vận hành.', 'No operation information yet.') },
    production: [],
    productionMessage: { text: isTransfer
      ? tx('Ghi nhiệt độ, tốc độ và sản lượng theo từng mã SOP.', 'Record temperature, speed, and output for each SOP.')
      : tx('Nội dung riêng của máy sẽ được bổ sung sau.', 'Machine-specific content will be added later.') },
  });
  const entryPaths: Record<string, string> = { Buffing: '/machine/buffing/record', Scouring: '/machine/scouring/record/operation', Unrolling: '/machine/unrolling/record' };
  const actionLabels: Record<string, string> = {
    Unrolling: tx('Xem đơn & in phiếu', 'View orders & print slips'), Buffing: t('openBuffing'), Scouring: t('openScouring'),
    Tentering: tx('Mở máy', 'Open machine'),
    Transfer: tx('Mở Transfer', 'Open Transfer'), Print: tx('Mở Print', 'Open Print'),
  };
  const rows: DashboardRow[] = expandedProcesses.map((process) => {
    const machineId = process.code;
    return {
      process,
      machineId,
      summary: summaries[machineId] ?? genericSummary(machineId, process.name === 'Transfer'),
      href: entryPaths[process.name] ?? `/machine/${machineId}/record`,
      actionLabel: actionLabels[process.name] ?? tx('Nhập vận hành', 'Enter operation'),
    };
  });
  const detailRow = rows.find((row) => row.machineId === selectedDetail) ?? null;
  const statuses = rows.map((row) => rowStatus(row.summary, tx));
  const attentionCount = statuses.filter((status) => status.tone === 'alarm' || status.tone === 'warning').length;
  const activeCount = statuses.filter((status) => status.tone === 'info' || status.tone === 'normal').length;
  const waitingCount = statuses.filter((status) => status.tone === 'muted').length;
  const setAllMachinesSelected = (selected: boolean) => setSelectedMachineCodes(selected ? overviewFilterProcesses.map((process) => process.code) : []);

  useEffect(() => {
    window.localStorage.setItem(overviewMachineFilterKey, JSON.stringify(selectedMachineCodes));
  }, [selectedMachineCodes]);
  useEffect(() => {
    if (selectedDetail && !rows.some((row) => row.machineId === selectedDetail)) setSelectedDetail(null);
  }, [rows, selectedDetail]);

  return <WS3MesShell module={tx('Máy móc', 'Machinery')} breadcrumbs={[]} navigation={<WS3DataFlowNav />}>
    <div className="ws3-dashboard">
      {error && <div role="status" className="ws3-dashboard__error">{error}</div>}
      <section className="ws3-dashboard__controlbar" aria-label={tx('Tổng quan trạng thái', 'Status overview')}>
        <div className="ws3-dashboard__overview">
          <span className="ws3-dashboard__view-label">{tx('Thiết bị', 'Equipment')}</span>
          <span><small>{tx('Hiển thị', 'Shown')}</small><strong>{rows.length}</strong></span>
          <span data-tone="info"><small>{tx('Vận hành', 'Operating')}</small><strong>{activeCount}</strong></span>
          <span data-tone={attentionCount ? 'warning' : 'normal'}><small>{tx('Cần chú ý', 'Attention')}</small><strong>{attentionCount}</strong></span>
          <span data-tone="muted"><small>{tx('Chờ dữ liệu', 'Awaiting data')}</small><strong>{waitingCount}</strong></span>
        </div>
        <div className="ws3-dashboard__command-actions">
          {canManageOrders && <details className="ws3-dashboard__filter">
            <summary>{tx('Lọc máy', 'Filter machines')} <span aria-hidden="true">▾</span></summary>
            <div>
              <header><button type="button" onClick={() => setAllMachinesSelected(true)}>{tx('Chọn tất cả', 'Select all')}</button><button type="button" onClick={() => setAllMachinesSelected(false)}>{tx('Bỏ chọn', 'Clear')}</button></header>
              {overviewFilterProcesses.map((process) => <label key={process.code}><input type="checkbox" checked={selectedMachineCodes.includes(process.code)} onChange={(event) => setSelectedMachineCodes((current) => event.target.checked ? [...current, process.code] : current.filter((code) => code !== process.code))} />{process.name}</label>)}
            </div>
          </details>}
        </div>
      </section>

      <div className={`ws3-dashboard__workspace${detailRow ? ' has-detail' : ''}`}>
        <div className="ws3-dashboard__table-wrap">
          <MesResizableTable
            className="ws3-dashboard__table"
            initialWidths={[130, 120, 285, 125, 135, 135, 90, 100]}
            storageKey="ws3-overview"
          >
            <caption className="sr-only">{tx('Bảng thông tin máy móc', 'Machine information table')}</caption>
            <thead><tr>
              <MesResizableHeaderCell index={0}>{t('machine')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={1}>{tx('Trạng thái', 'Status')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={2}>{tx('Đơn hàng / vật tư', 'Order / material')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={3}>{tx('Sản lượng', 'Output')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={4}>{tx('Ca / vận hành', 'Shift / operator')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={5}>{tx('Cập nhật cuối', 'Last update')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={6}>{tx('Cảnh báo', 'Alert')}</MesResizableHeaderCell>
              <MesResizableHeaderCell index={7}><span className="sr-only">{tx('Thao tác', 'Actions')}</span></MesResizableHeaderCell>
            </tr></thead>
            <tbody>{rows.map((row) => {
              const status = rowStatus(row.summary, tx);
              const alert = alertSummary(row.summary);
              const actionAvailable = row.process.actionAvailable !== false;
              return <tr key={row.machineId} data-selected={detailRow?.machineId === row.machineId || undefined}>
                <td>{actionAvailable
                  ? <button type="button" className="ws3-dashboard__machine" onClick={() => setSelectedDetail(row.machineId)}><span>{row.process.name}</span><small>{row.machineId}</small></button>
                  : <span className="ws3-dashboard__machine is-disabled" aria-label={tx('Máy chưa sẵn sàng', 'Machine not ready')}><span>{row.process.name}</span><small>{row.machineId}</small></span>}</td>
                <td><span className="ws3-dashboard__status" data-tone={status.tone}><i aria-hidden="true" />{status.label}</span></td>
                <MesDataCell className="ws3-dashboard__reference" tooltip={orderReference(row.summary)}>{orderReference(row.summary)}</MesDataCell>
                <MesDataCell className="ws3-dashboard__numeric" tooltip={outputSummary(row.summary)}>{outputSummary(row.summary)}</MesDataCell>
                <MesDataCell tooltip={operatorSummary(row.summary, language)}>{operatorSummary(row.summary, language)}</MesDataCell>
                <MesDataCell className="ws3-dashboard__numeric" tooltip={text(field(row.summary, 'recorded')?.value)}>{text(field(row.summary, 'recorded')?.value)}</MesDataCell>
                <td><span className="ws3-dashboard__alert" data-tone={alert.tone}>{alert.value}</span></td>
                <td className="ws3-dashboard__actions">{actionAvailable
                  ? <Link to={row.href}>{tx('Mở', 'Open')}</Link>
                  : <span className="ws3-dashboard__action-disabled" aria-label={tx('Chưa sẵn sàng', 'Not ready')}>{tx('Mở', 'Open')}</span>}</td>
              </tr>;
            })}</tbody>
          </MesResizableTable>
          {rows.length === 0 && <p className="ws3-dashboard__empty">{tx('Chưa chọn máy nào để hiển thị.', 'No machines are selected for display.')}</p>}
        </div>
        {detailRow && <DashboardDetail row={detailRow} onClose={() => setSelectedDetail(null)} operationLabel={t('operation')} productionLabel={t('production')} closeLabel={tx('Đóng chi tiết', 'Close details')} />}
      </div>
    </div>
  </WS3MesShell>;
}
