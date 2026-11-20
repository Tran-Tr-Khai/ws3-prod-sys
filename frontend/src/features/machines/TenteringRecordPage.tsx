import { useCallback } from 'react';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { MachineOperationSidebar } from '../../components/mes/operations/MachineOperationSidebar';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { MachineOperationalNoticeDock } from '../support/MachineOperationalNoticeDock';
import { isOperatorAssignedToMachine } from '../support/machineAssignment';
import {
  TENTERING_MACHINES,
  TenteringMachineSelect,
  TenteringNavigation,
} from './TenteringNavigation';
import { TenteringLiveDashboard } from './TenteringLiveDashboard';
import type { HeaderDraft } from './tenteringRecordTypes';
import { displayDate, toCentimeters } from './tenteringRecordUtils';
import { useOperationPanelResize } from './useOperationPanelResize';
import { useTenteringRecord } from './useTenteringRecord';
import './TenteringPage.css';

export function TenteringRecordPage({
  machineId: routeMachineId = 'TE-01',
}: {
  machineId?: string;
}) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const vi = language === 'vi';
  const tx = useCallback(
    (vietnamese: string, english: string) => (vi ? vietnamese : english),
    [vi],
  );
  const machineId = TENTERING_MACHINES.some(
    (machine) => machine.id === routeMachineId.toUpperCase(),
  )
    ? routeMachineId.toUpperCase()
    : 'TE-01';
  const machine = TENTERING_MACHINES.find((item) => item.id === machineId) ?? TENTERING_MACHINES[0];
  const {
    sopInput,
    activeSop,
    header,
    setHeader,
    rolls,
    loading,
    saving,
    error,
    saved,
    newOrder,
    showNewOrderNotice,
    knownOrder,
    orderProgress,
    progressSaving,
    progressError,
    recordMode,
    setRecordMode,
    showMachineSignals,
    setShowMachineSignals,
    realtime,
    plannedQuantity,
    actualQuantity,
    completedRolls,
    dashboardOrders,
    stateText,
    resetForSop,
    changeOrderProgress,
    save,
    updateRoll,
  } = useTenteringRecord({ machineId, tx });
  const {
    operationCollapsed,
    operationWidth,
    operationLayoutRef,
    workspaceStyle,
    handleDividerPointerDown,
    handleDividerPointerMove,
    handleDividerPointerUp,
    handleDividerPointerCancel,
    handleDividerKeyDown,
  } = useOperationPanelResize();
  const isOperator = user?.role === 'OPERATOR';
  const isTenteringOperator = isOperatorAssignedToMachine(user, machineId);
  const field = (
    key: keyof HeaderDraft,
    label: string,
    type: 'text' | 'number' = 'text',
    unit?: string,
  ) => (
    <label key={key} className="tentering-field">
      <span>{label}</span>
      {unit ? (
        <span className="tentering-unit-control">
          <input
            type={type}
            step="any"
            value={header[key]}
            onChange={(event) =>
              setHeader((current) => ({ ...current, [key]: event.target.value }))
            }
          />
          <span>{unit}</span>
        </span>
      ) : (
        <input
          type={type}
          step={type === 'number' ? 'any' : undefined}
          value={header[key]}
          onChange={(event) => setHeader((current) => ({ ...current, [key]: event.target.value }))}
          className="tentering-control"
        />
      )}
    </label>
  );

  return (
    <WS3MesShell
      module={tx('Định hình', 'Tentering')}
      breadcrumbs={[]}
      navigation={<TenteringNavigation machineId={machineId} showMachineSelector />}
      showSupportWidget={!isOperator}
    >
      <div className="tentering-mes entering-mes-page">
        <header className="tentering-page__heading">
          <div>
            <p className="tentering-page__eyebrow">WS3 / TENTERING</p>
            <h1>
              {machine.id} · {machine.label}
            </h1>
            <p>{tx('Phiếu sản lượng theo SOP và cuộn vải', 'Production sheet by SOP and roll')}</p>
          </div>
          <span className="tentering-page__status">{stateText}</span>
        </header>
        <div
          ref={(element) => {
            operationLayoutRef.current = element;
          }}
          className={`tentering-record__layout${isTenteringOperator ? ' has-notices' : ''}${operationCollapsed ? ' tentering-record__layout--operation-collapsed' : ''}`}
          style={workspaceStyle}
        >
          <MachineOperationSidebar
            className={`tentering-record__sidebar tentering-mes__operation${operationCollapsed ? ' is-collapsed' : ''}`}
            beforeFields={<TenteringMachineSelect machineId={machineId} visibleLabel />}
            orderNumber={sopInput}
            onOrderNumberChange={resetForSop}
            orderNumberFeedback={
              error || stateText ? (
                <span className={`tentering-sop-state${error ? ' is-error' : ''}`}>
                  {error || stateText}
                </span>
              ) : undefined
            }
            operatorName={header.operatorName}
            onOperatorNameChange={(value) =>
              setHeader((current) => ({ ...current, operatorName: value }))
            }
            employeeId={header.operatorIdentifier}
            onEmployeeIdChange={(value) =>
              setHeader((current) => ({ ...current, operatorIdentifier: value }))
            }
            shift={header.shift}
            onShiftChange={(value) => setHeader((current) => ({ ...current, shift: value }))}
            orderStatus={
              <div className="tentering-progress">
                <span className="tentering-progress__label">
                  {tx('Tiến độ đơn', 'Order progress')}
                </span>
                <select
                  className="tentering-progress__select"
                  value={orderProgress}
                  disabled={!knownOrder || loading || isOperator || progressSaving}
                  onChange={(event) =>
                    void changeOrderProgress(event.target.value as 'IN_PROGRESS' | 'COMPLETED')
                  }
                >
                  <option value="IN_PROGRESS">{tx('Đang xử lý', 'In progress')}</option>
                  <option value="COMPLETED">{tx('Đã hoàn thành', 'Completed')}</option>
                </select>
                {progressError && (
                  <small className="tentering-sop-state is-error">{progressError}</small>
                )}
              </div>
            }
          >
            {saved && (
              <p role="status" className="tentering-inline-success">
                {tx('Đã lưu phiếu Tentering.', 'Tentering sheet saved.')}
              </p>
            )}
            <div
              className="buffing-mes__operation-divider"
              role="separator"
              tabIndex={0}
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={420}
              aria-valuenow={operationCollapsed ? 0 : operationWidth}
              aria-label={
                vi
                  ? 'Thu gọn hoặc thay đổi độ rộng thông tin vận hành'
                  : 'Collapse or resize operation details'
              }
              onPointerDown={handleDividerPointerDown}
              onPointerMove={handleDividerPointerMove}
              onPointerUp={handleDividerPointerUp}
              onPointerCancel={handleDividerPointerCancel}
              onKeyDown={handleDividerKeyDown}
            />
          </MachineOperationSidebar>

          <main className="tentering-record__content">
            <div className="tentering-record__content-body">
              <div
                className="tentering-record__mode-switch"
                role="group"
                aria-label={tx('Chế độ ghi nhận', 'Record mode')}
              >
                <button
                  type="button"
                  className={recordMode === 'AUTO' ? 'is-active' : ''}
                  aria-pressed={recordMode === 'AUTO'}
                  onClick={() => setRecordMode('AUTO')}
                >
                  {tx('Tự động', 'Automatic')}
                </button>
                <button
                  type="button"
                  className={recordMode === 'MANUAL' ? 'is-active' : ''}
                  aria-pressed={recordMode === 'MANUAL'}
                  onClick={() => setRecordMode('MANUAL')}
                >
                  {tx('Thủ công', 'Manual')}
                </button>
                {recordMode === 'AUTO' && (
                  <button
                    type="button"
                    className="tentering-record__signal-toggle"
                    aria-expanded={showMachineSignals}
                    aria-label={tx(
                      'Hiện hoặc ẩn thông số máy realtime',
                      'Show or hide realtime machine signals',
                    )}
                    onClick={() => setShowMachineSignals((current) => !current)}
                  >
                    {showMachineSignals ? tx('Ẩn', 'Hide') : tx('Hiện', 'Show')}
                  </button>
                )}
              </div>
              {recordMode === 'AUTO' && (
                <TenteringLiveDashboard
                  activeSop={activeSop}
                  orderProgress={orderProgress}
                  plannedQuantity={plannedQuantity}
                  actualQuantity={actualQuantity}
                  rollCount={rolls.length}
                  completedRolls={completedRolls}
                  finishWidthInch={header.finishWidthInch}
                  customer={header.customer}
                  itemDescription={header.itemDescription}
                  orders={dashboardOrders}
                  realtime={realtime}
                  showSignals={showMachineSignals}
                />
              )}
              {activeSop && newOrder && showNewOrderNotice && (
                <p role="status" className="tentering-inline-notice">
                  {tx(
                    'SOP mới. Kiểm tra thông tin và lưu phiếu để tạo bản ghi.',
                    'New SOP. Review the details and save to create a record.',
                  )}
                </p>
              )}
              {recordMode === 'MANUAL' && activeSop && (
                <section className="tentering-order-card">
                  <div className="tentering-order-card__fields">
                    <section className="tentering-order-card__section">
                      <h4>{tx('Đơn hàng', 'Order')}</h4>
                      {field('customer', tx('Khách hàng', 'Customer'))}
                      {field('itemDescription', tx('Loại mặt hàng', 'Item'))}
                      {field('warpYarn', tx('Sợi dọc', 'Warp yarn'))}
                      {field('weftYarn', tx('Sợi ngang', 'Weft yarn'))}
                    </section>
                    <section className="tentering-order-card__section">
                      <h4>{tx('Mật độ và co rút', 'Density and shrinkage')}</h4>
                      {field(
                        'greigeDensityPick',
                        tx('Mật độ mộc', 'Greige density'),
                        'number',
                        'pick',
                      )}
                      {field(
                        'finishDensityPick',
                        tx('Mật độ thành phẩm', 'Finish density'),
                        'number',
                        'pick',
                      )}
                      {field('shrinkPercent', tx('Co rút', 'Shrinkage'), 'number', '%')}
                    </section>
                    <section className="tentering-order-card__section">
                      <h4>{tx('Khổ rộng', 'Width')}</h4>
                      {field('greigeWidthInch', tx('Khổ mộc', 'Greige width'), 'number', 'in')}
                      {
                        <span className="tentering-sop-state">
                          {toCentimeters(header.greigeWidthInch)}
                        </span>
                      }
                      {field(
                        'finishWidthInch',
                        tx('Khổ thành phẩm', 'Finish width'),
                        'number',
                        'in',
                      )}
                      {
                        <span className="tentering-sop-state">
                          {toCentimeters(header.finishWidthInch)}
                        </span>
                      }
                    </section>
                  </div>
                </section>
              )}
              {recordMode === 'MANUAL' && activeSop && (
                <section className="tentering-rolls">
                  {rolls.length === 0 ? (
                    <p className="tentering-rolls__empty">
                      {tx(
                        'Chưa tìm thấy cuộn của SOP này trong dữ liệu MES.',
                        'No rolls were found for this SOP in the MES data.',
                      )}
                    </p>
                  ) : (
                    <div className="tentering-rolls__table-wrap">
                      <table>
                        <thead>
                          <tr>
                            {[
                              tx('STT', 'NO.'),
                              tx('Mã cuộn', 'ROLL ID'),
                              tx('Ngày dệt', 'WEAVING DATE'),
                              tx('Theo đơn', 'PLANNED'),
                              tx('Thực tế', 'ACTUAL'),
                              tx('Ghi chú', 'NOTE'),
                            ].map((label) => (
                              <th key={label}>{label}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rolls.map((row, index) => (
                            <tr key={row.rollNumber}>
                              <td className="is-mono">{String(row.rollNumber).padStart(2, '0')}</td>
                              <td className="is-mono">{row.rollId || '—'}</td>
                              <td>{displayDate(row.weavingDate, language)}</td>
                              <td className="is-number">
                                <input
                                  aria-label={`${tx('Sản lượng theo đơn cuộn', 'Planned quantity roll')} ${row.rollNumber}`}
                                  value={row.plannedQuantity}
                                  readOnly
                                />
                              </td>
                              <td className="is-number">
                                <input
                                  aria-label={`${tx('Sản lượng thực tế cuộn', 'Actual quantity roll')} ${row.rollNumber}`}
                                  type="number"
                                  min="0"
                                  step="any"
                                  value={row.actualQuantity}
                                  onChange={(event) =>
                                    updateRoll(index, 'actualQuantity', event.target.value)
                                  }
                                />
                              </td>
                              <td>
                                <input
                                  aria-label={`${tx('Ghi chú cuộn', 'Roll note')} ${row.rollNumber}`}
                                  value={row.note}
                                  onChange={(event) =>
                                    updateRoll(index, 'note', event.target.value)
                                  }
                                  maxLength={1000}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </div>
            {recordMode === 'MANUAL' && (
              <div className="tentering-record__manual-actions">
                <button
                  type="button"
                  className="tentering-action"
                  disabled={!activeSop || saving || loading}
                  onClick={() => void save()}
                >
                  {saving ? tx('Đang lưu…', 'Saving…') : tx('Lưu phiếu', 'Save sheet')}
                </button>
              </div>
            )}
          </main>
          {isTenteringOperator && (
            <aside className="tentering-record__notices">
              <MachineOperationalNoticeDock machineId={machineId} />
            </aside>
          )}
        </div>
      </div>
    </WS3MesShell>
  );
}
