import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { WS3MesShell } from '../../components/mes/WS3MesShell';
import { MachineOperationSidebar } from '../../components/mes/operations/MachineOperationSidebar';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { MachineOperationalNoticeDock } from '../support/MachineOperationalNoticeDock';
import { isOperatorAssignedToMachine } from '../support/machineAssignment';
import { getMachineOrderProgress, saveMachineOrderProgress } from './machineOrderProgressApi';
import { MACHINE_NOTICE_DURATION_MS } from './noticeTiming';
import {
  getTenteringOrder,
  getTenteringOrders,
  getTenteringOrderSource,
  saveTenteringOrder,
  type TenteringOrder,
  type TenteringOrderInput,
} from './tenteringApi';
import {
  TENTERING_MACHINES,
  TenteringMachineSelect,
  TenteringNavigation,
} from './TenteringNavigation';
import { TenteringLiveDashboard, type TenteringDashboardOrder } from './TenteringLiveDashboard';
import { readTenterValue, useTenterRealtime } from './tenteringRealtime';
import { useExistingMachineRecord } from './useExistingMachineRecord';
import './TenteringPage.css';

type RollDraft = {
  rollNumber: number;
  savedEntryId?: number;
  rollId: string;
  tenterDate: string;
  weavingDate: string;
  plannedQuantity: string;
  actualQuantity: string;
  note: string;
};

type HeaderDraft = {
  operatorName: string;
  operatorIdentifier: string;
  shift: string;
  customer: string;
  itemDescription: string;
  warpYarn: string;
  weftYarn: string;
  greigeDensityPick: string;
  finishDensityPick: string;
  shrinkPercent: string;
  greigeWidthInch: string;
  finishWidthInch: string;
};

const emptyHeader: HeaderDraft = {
  operatorName: '',
  operatorIdentifier: '',
  shift: '',
  customer: '',
  itemDescription: '',
  warpYarn: '',
  weftYarn: '',
  greigeDensityPick: '',
  finishDensityPick: '',
  shrinkPercent: '',
  greigeWidthInch: '',
  finishWidthInch: '',
};

const emptyRolls = (count = 0): RollDraft[] =>
  Array.from({ length: count }, (_, index) => ({
    rollNumber: index + 1,
    savedEntryId: undefined,
    rollId: '',
    tenterDate: '',
    weavingDate: '',
    plannedQuantity: '',
    actualQuantity: '',
    note: '',
  }));

const numeric = (value: string) => (value.trim() ? Number(value) : null);

function displayDate(value: string, language: string) {
  if (!value) return '—';
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : date.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-GB');
}

function toCentimeters(value: string) {
  const inches = numeric(value);
  return inches === null || !Number.isFinite(inches)
    ? '—'
    : `${(inches * 2.54).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} cm`;
}

function headerFromOrder(order: TenteringOrder): HeaderDraft {
  return {
    operatorName: order.operator_name ?? '',
    operatorIdentifier: order.operator_identifier ?? '',
    shift: order.shift ?? '',
    customer: order.customer ?? '',
    itemDescription: order.item_description ?? '',
    warpYarn: order.warp_yarn ?? '',
    weftYarn: order.weft_yarn ?? '',
    greigeDensityPick: order.greige_density_pick?.toString() ?? '',
    finishDensityPick: order.finish_density_pick?.toString() ?? '',
    shrinkPercent: order.shrink_percent?.toString() ?? '',
    greigeWidthInch: order.greige_width_inch?.toString() ?? '',
    finishWidthInch: order.finish_width_inch?.toString() ?? '',
  };
}

function rollsFromOrder(order: TenteringOrder): RollDraft[] {
  const lastSavedRoll = Math.max(0, ...order.entries.map((entry) => entry.roll_number));
  const result = emptyRolls(lastSavedRoll);
  for (const entry of order.entries) {
    result[entry.roll_number - 1] = {
      rollNumber: entry.roll_number,
      savedEntryId: entry.id,
      rollId: entry.roll_id ?? '',
      tenterDate: entry.tenter_date ?? '',
      weavingDate: entry.weaving_date ?? '',
      plannedQuantity: entry.planned_quantity?.toString() ?? '',
      actualQuantity: entry.actual_quantity?.toString() ?? '',
      note: entry.note ?? '',
    };
  }
  return result;
}

function applySourceRolls(
  rolls: RollDraft[],
  source: Awaited<ReturnType<typeof getTenteringOrderSource>>,
) {
  if (!source) return rolls;
  const rollCount = Math.max(
    rolls.length,
    source.total_rolls,
    ...source.rolls.map((roll) => roll.roll_number),
  );
  const expanded =
    rollCount > rolls.length ? [...rolls, ...emptyRolls(rollCount).slice(rolls.length)] : rolls;
  return source.rolls.reduce(
    (current, sourceRoll) =>
      current.map((row) =>
        row.rollNumber === sourceRoll.roll_number
          ? {
              ...row,
              rollId: sourceRoll.roll_id ?? row.rollId,
              weavingDate: sourceRoll.weaving_date ?? row.weavingDate,
              plannedQuantity: sourceRoll.length_meters?.toString() ?? row.plannedQuantity,
            }
          : row,
      ),
    expanded,
  );
}

function inputFromDraft(
  header: HeaderDraft,
  rolls: RollDraft[],
  orderProgress: 'IN_PROGRESS' | 'COMPLETED',
): TenteringOrderInput {
  return {
    operator_name: header.operatorName.trim() || null,
    operator_identifier: header.operatorIdentifier.trim() || null,
    shift: header.shift || null,
    order_progress: orderProgress,
    customer: header.customer.trim() || null,
    item_description: header.itemDescription.trim() || null,
    warp_yarn: header.warpYarn.trim() || null,
    weft_yarn: header.weftYarn.trim() || null,
    greige_density_pick: numeric(header.greigeDensityPick),
    finish_density_pick: numeric(header.finishDensityPick),
    shrink_percent: numeric(header.shrinkPercent),
    greige_width_inch: numeric(header.greigeWidthInch),
    finish_width_inch: numeric(header.finishWidthInch),
    fabric_received_date: null,
    entries: rolls
      .filter(
        (row) =>
          row.rollId ||
          row.tenterDate ||
          row.weavingDate ||
          row.plannedQuantity ||
          row.actualQuantity ||
          row.note.trim(),
      )
      .map((row) => ({
        roll_number: row.rollNumber,
        roll_id: row.rollId || null,
        tenter_date: row.tenterDate || null,
        weaving_date: row.weavingDate || null,
        planned_quantity: numeric(row.plannedQuantity),
        actual_quantity: numeric(row.actualQuantity),
        note: row.note.trim() || null,
      })),
  };
}

function dashboardOrderFromOrder(order: TenteringOrder): TenteringDashboardOrder {
  const plannedValues = order.entries
    .map((entry) => entry.planned_quantity)
    .filter((value): value is number => value !== null);
  const actualValues = order.entries
    .map((entry) => entry.actual_quantity)
    .filter((value): value is number => value !== null);
  return {
    sopNo: order.sop_no,
    customer: order.customer ?? '',
    itemDescription: order.item_description ?? '',
    operatorName: order.operator_name ?? '',
    shift: order.shift ?? '',
    plannedQuantity: plannedValues.length
      ? plannedValues.reduce((sum, value) => sum + value, 0)
      : null,
    actualQuantity: actualValues.length
      ? actualValues.reduce((sum, value) => sum + value, 0)
      : null,
    rollCount: order.entries.length,
    progress: order.order_progress,
  };
}

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
  const [sopInput, setSopInput] = useState('');
  const [activeSop, setActiveSop] = useState('');
  const [header, setHeader] = useState<HeaderDraft>({ ...emptyHeader });
  const [rolls, setRolls] = useState<RollDraft[]>(emptyRolls());
  const [shiftOrders, setShiftOrders] = useState<TenteringOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [newOrder, setNewOrder] = useState(false);
  const [showNewOrderNotice, setShowNewOrderNotice] = useState(false);
  const [knownOrder, setKnownOrder] = useState(false);
  const [orderProgress, setOrderProgress] = useState<'IN_PROGRESS' | 'COMPLETED'>('IN_PROGRESS');
  const [progressSaving, setProgressSaving] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [operationCollapsed, setOperationCollapsed] = useState(false);
  const [operationWidth, setOperationWidth] = useState(272);
  const [recordMode, setRecordMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [showMachineSignals, setShowMachineSignals] = useState(false);
  const [autoCounterBaseline, setAutoCounterBaseline] = useState<number | null>(null);
  const operationLayoutRef = useRef<HTMLDivElement>(null);
  const operationDragRef = useRef<{
    startX: number;
    startWidth: number;
    moved: boolean;
    width: number;
    collapsed: boolean;
    frame: number | null;
  } | null>(null);
  const isOperator = user?.role === 'OPERATOR';
  const isTenteringOperator = isOperatorAssignedToMachine(user, machineId);
  const realtime = useTenterRealtime(machineId, recordMode === 'AUTO');
  const liveCounterTotal = readTenterValue(realtime.machine?.readingValues ?? {}, [
    ['speed_and_width', 'Counter Total'],
  ]);
  const autoActualQuantity =
    liveCounterTotal !== null && autoCounterBaseline !== null
      ? Math.max(0, liveCounterTotal - autoCounterBaseline)
      : null;

  useEffect(() => {
    if (recordMode !== 'AUTO' || !activeSop) {
      setAutoCounterBaseline(null);
      return;
    }
    if (liveCounterTotal !== null) setAutoCounterBaseline((current) => current ?? liveCounterTotal);
  }, [activeSop, liveCounterTotal, recordMode]);
  const findExistingOrder = useCallback(
    (normalizedSop: string) => getTenteringOrder(machineId, normalizedSop),
    [machineId],
  );
  // The optional realtime fixture must never disable MES production data.
  // ?mock=tenter only changes the machine signal source, while SOP lookup stays real.
  const existingLookup = useExistingMachineRecord(sopInput, findExistingOrder, 300);
  const workspaceStyle = {
    '--tentering-operation-width': `${operationCollapsed ? 10 : operationWidth}px`,
  } as CSSProperties;

  useEffect(() => {
    if (!header.shift) {
      setShiftOrders([]);
      return undefined;
    }
    const controller = new AbortController();
    void getTenteringOrders(machineId, '', { signal: controller.signal })
      .then((orders) => setShiftOrders(orders.filter((order) => order.shift === header.shift)))
      .catch(() => {
        if (!controller.signal.aborted) setShiftOrders([]);
      });
    return () => controller.abort();
  }, [header.shift, machineId]);

  const handleOperationDividerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    operationDragRef.current = {
      startX: event.clientX,
      startWidth: operationCollapsed ? 40 : operationWidth,
      moved: false,
      width: operationCollapsed ? 10 : operationWidth,
      collapsed: operationCollapsed,
      frame: null,
    };
  };
  const handleOperationDividerPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    if (!drag) return;
    const delta = event.clientX - drag.startX;
    if (Math.abs(delta) > 4) drag.moved = true;
    if (!drag.moved) return;
    const nextWidth = drag.startWidth + delta;
    const nextCollapsed = nextWidth <= 10;
    // Keep the drag continuous all the way to the collapsed width. The old 220px
    // floor made the sidebar stick, then jump when it crossed the collapse point.
    const width = nextCollapsed ? 10 : Math.min(420, Math.max(10, nextWidth));
    drag.width = width;
    if (drag.collapsed !== nextCollapsed) {
      drag.collapsed = nextCollapsed;
      setOperationCollapsed(nextCollapsed);
      setOperationWidth(nextCollapsed ? 10 : width);
    }
    if (drag.frame === null) {
      drag.frame = window.requestAnimationFrame(() => {
        drag.frame = null;
        operationLayoutRef.current?.style.setProperty(
          '--tentering-operation-width',
          `${drag.width}px`,
        );
      });
    }
  };
  const handleOperationDividerPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    operationDragRef.current = null;
    if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
    if (drag && !drag.moved) {
      const collapsed = !operationCollapsed;
      setOperationCollapsed(collapsed);
      setOperationWidth(collapsed ? 10 : operationWidth);
      operationLayoutRef.current?.style.setProperty(
        '--tentering-operation-width',
        `${collapsed ? 10 : operationWidth}px`,
      );
    } else if (drag) {
      setOperationCollapsed(drag.collapsed);
      setOperationWidth(drag.collapsed ? 10 : drag.width);
      operationLayoutRef.current?.style.setProperty(
        '--tentering-operation-width',
        `${drag.collapsed ? 10 : drag.width}px`,
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleOperationDividerPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = operationDragRef.current;
    operationDragRef.current = null;
    if (drag?.frame !== null && drag?.frame !== undefined) window.cancelAnimationFrame(drag.frame);
    if (drag?.moved) {
      setOperationCollapsed(drag.collapsed);
      setOperationWidth(drag.collapsed ? 10 : drag.width);
      operationLayoutRef.current?.style.setProperty(
        '--tentering-operation-width',
        `${drag.collapsed ? 10 : drag.width}px`,
      );
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleOperationDividerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOperationCollapsed((current) => !current);
      return;
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowRight' ? 16 : -16;
    setOperationCollapsed(false);
    setOperationWidth((current) => Math.min(420, Math.max(220, current + delta)));
  };

  useEffect(() => {
    if (!saved) return undefined;
    const timer = window.setTimeout(() => setSaved(false), MACHINE_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  useEffect(() => {
    if (!newOrder) {
      setShowNewOrderNotice(false);
      return undefined;
    }
    setShowNewOrderNotice(true);
    const timer = window.setTimeout(() => setShowNewOrderNotice(false), MACHINE_NOTICE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [newOrder]);

  useEffect(() => {
    const normalized = sopInput.trim().toUpperCase();
    if (!normalized || normalized === activeSop) {
      setLoading(false);
      return;
    }
    if (existingLookup.loading) {
      setLoading(true);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        if (existingLookup.error) throw new Error(existingLookup.error);
        const result = existingLookup.record;
        const [sourceResult, progressResult] = await Promise.allSettled([
          getTenteringOrderSource(machineId, normalized),
          getMachineOrderProgress(machineId as 'TE-01' | 'TE-02', normalized),
        ]);
        if (!result && sourceResult.status === 'rejected') throw sourceResult.reason;
        if (!active) return;
        const source = sourceResult.status === 'fulfilled' ? sourceResult.value : null;
        setActiveSop(normalized);
        setNewOrder(!result);
        setKnownOrder(Boolean(result || source));
        setHeader(
          result
            ? headerFromOrder(result)
            : {
                ...emptyHeader,
                customer: source?.customer ?? '',
                itemDescription: source?.item_description ?? '',
              },
        );
        setRolls(applySourceRolls(result ? rollsFromOrder(result) : emptyRolls(), source));
        setOrderProgress(
          progressResult.status === 'fulfilled'
            ? (progressResult.value?.orderProgress ?? result?.order_progress ?? 'IN_PROGRESS')
            : (result?.order_progress ?? 'IN_PROGRESS'),
        );
        setProgressError('');
      } catch (reason) {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : tx('Không tải được dữ liệu Tentering.', 'Unable to load Tentering data.'),
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [
    activeSop,
    existingLookup.error,
    existingLookup.loading,
    existingLookup.record,
    machineId,
    sopInput,
    tx,
  ]);

  const resetForSop = (value: string) => {
    setSopInput(value.toUpperCase());
    setActiveSop('');
    setKnownOrder(false);
    setHeader({ ...emptyHeader });
    setRolls(emptyRolls());
    setNewOrder(false);
    setSaved(false);
    setLoading(false);
    setOrderProgress('IN_PROGRESS');
    setProgressError('');
    setError('');
  };

  const changeOrderProgress = async (nextProgress: 'IN_PROGRESS' | 'COMPLETED') => {
    if (!activeSop || !knownOrder || progressSaving || loading) return;
    const previousProgress = orderProgress;
    setOrderProgress(nextProgress);
    setProgressSaving(true);
    setProgressError('');
    try {
      await saveMachineOrderProgress(machineId as 'TE-01' | 'TE-02', activeSop, nextProgress);
    } catch (reason) {
      setOrderProgress(previousProgress);
      setProgressError(
        reason instanceof Error
          ? reason.message
          : tx('Không lưu được tiến độ đơn.', 'Unable to save order progress.'),
      );
    } finally {
      setProgressSaving(false);
    }
  };

  const save = async () => {
    if (!activeSop || saving) return;
    if (!header.operatorName.trim() || !header.operatorIdentifier.trim() || !header.shift) {
      setError(
        tx(
          'Nhập người vận hành, ID nhân viên và ca làm trước khi lưu.',
          'Enter the operator, employee ID, and shift before saving.',
        ),
      );
      return;
    }
    const invalidHeader = [
      header.greigeDensityPick,
      header.finishDensityPick,
      header.shrinkPercent,
      header.greigeWidthInch,
      header.finishWidthInch,
    ].find((value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0));
    if (invalidHeader !== undefined) {
      setError(
        tx(
          'Thông tin mật độ, co rút hoặc khổ vải phải là số không âm.',
          'Density, shrinkage, and width must be non-negative numbers.',
        ),
      );
      return;
    }
    const invalidRow = rolls.find((row) =>
      [row.plannedQuantity, row.actualQuantity].some(
        (value) => value.trim() && (!Number.isFinite(Number(value)) || Number(value) < 0),
      ),
    );
    if (invalidRow) {
      setError(
        tx(
          `Số mét ở cuộn ${invalidRow.rollNumber} không hợp lệ.`,
          `Invalid meter value on roll ${invalidRow.rollNumber}.`,
        ),
      );
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await saveTenteringOrder(
        machineId,
        activeSop,
        inputFromDraft(header, rolls, orderProgress),
      );
      setOrderProgress(result.order_progress);
      setHeader(headerFromOrder(result));
      setRolls(rollsFromOrder(result));
      setSopInput(result.sop_no);
      setActiveSop(result.sop_no);
      setNewOrder(false);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : tx('Không lưu được dữ liệu Tentering.', 'Unable to save Tentering data.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const updateRoll = (index: number, key: keyof RollDraft, value: string) =>
    setRolls((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
    );
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

  const stateText = loading ? tx('Đang tra cứu SOP…', 'Looking up SOP…') : '';
  const plannedQuantity = rolls.some((row) => row.plannedQuantity.trim())
    ? rolls.reduce((sum, row) => sum + (numeric(row.plannedQuantity) ?? 0), 0)
    : null;
  const actualQuantity = rolls.some((row) => row.actualQuantity.trim())
    ? rolls.reduce((sum, row) => sum + (numeric(row.actualQuantity) ?? 0), 0)
    : null;
  const completedRolls = rolls.filter((row) => row.actualQuantity.trim()).length;
  const currentDashboardOrder: TenteringDashboardOrder | null = activeSop
    ? {
        sopNo: activeSop,
        customer: header.customer,
        itemDescription: header.itemDescription,
        operatorName: header.operatorName,
        shift: header.shift,
        plannedQuantity,
        actualQuantity: recordMode === 'AUTO' ? autoActualQuantity : actualQuantity,
        rollCount: rolls.length,
        progress: orderProgress,
      }
    : null;
  const dashboardOrders = [
    ...shiftOrders.filter((order) => order.sop_no !== activeSop).map(dashboardOrderFromOrder),
    ...(currentDashboardOrder ? [currentDashboardOrder] : []),
  ];

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
          ref={operationLayoutRef}
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
              onPointerDown={handleOperationDividerPointerDown}
              onPointerMove={handleOperationDividerPointerMove}
              onPointerUp={handleOperationDividerPointerUp}
              onPointerCancel={handleOperationDividerPointerCancel}
              onKeyDown={handleOperationDividerKeyDown}
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
                  actualQuantity={recordMode === 'AUTO' ? autoActualQuantity : actualQuantity}
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
