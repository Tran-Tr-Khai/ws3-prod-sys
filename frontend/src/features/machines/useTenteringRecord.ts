import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getMachineOrderProgress, saveMachineOrderProgress } from './machineOrderProgressApi';
import { MACHINE_NOTICE_DURATION_MS } from './noticeTiming';
import {
  getTenteringOrder,
  getTenteringOrders,
  getTenteringOrderSource,
  saveTenteringOrder,
  type TenteringOrder,
} from './tenteringApi';
import {
  readTenterValue,
  useTenterRealtime,
  type TenterRealtimeSnapshot,
} from './tenteringRealtime';
import type { HeaderDraft, RollDraft, TenteringDashboardOrder } from './tenteringRecordTypes';
import {
  applySourceRolls,
  dashboardOrderFromOrder,
  emptyHeader,
  emptyRolls,
  headerFromOrder,
  inputFromDraft,
  numeric,
  rollsFromOrder,
} from './tenteringRecordUtils';
import { useExistingMachineRecord } from './useExistingMachineRecord';

type Translate = (vietnamese: string, english: string) => string;

type UseTenteringRecordOptions = {
  machineId: string;
  tx: Translate;
};

type UseTenteringRecordResult = {
  sopInput: string;
  activeSop: string;
  header: HeaderDraft;
  setHeader: Dispatch<SetStateAction<HeaderDraft>>;
  rolls: RollDraft[];
  loading: boolean;
  saving: boolean;
  error: string;
  saved: boolean;
  newOrder: boolean;
  showNewOrderNotice: boolean;
  knownOrder: boolean;
  orderProgress: 'IN_PROGRESS' | 'COMPLETED';
  progressSaving: boolean;
  progressError: string;
  recordMode: 'AUTO' | 'MANUAL';
  setRecordMode: Dispatch<SetStateAction<'AUTO' | 'MANUAL'>>;
  showMachineSignals: boolean;
  setShowMachineSignals: Dispatch<SetStateAction<boolean>>;
  realtime: TenterRealtimeSnapshot;
  autoActualQuantity: number | null;
  plannedQuantity: number | null;
  actualQuantity: number | null;
  completedRolls: number;
  dashboardOrders: TenteringDashboardOrder[];
  stateText: string;
  resetForSop: (value: string) => void;
  changeOrderProgress: (nextProgress: 'IN_PROGRESS' | 'COMPLETED') => Promise<void>;
  save: () => Promise<void>;
  updateRoll: (index: number, key: keyof RollDraft, value: string) => void;
};

/**
 * Coordinate Tentering SOP lookup, editing, saving and realtime production
 * values for one machine record screen.
 */
export function useTenteringRecord({
  machineId,
  tx,
}: UseTenteringRecordOptions): UseTenteringRecordResult {
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
  const [recordMode, setRecordMode] = useState<'AUTO' | 'MANUAL'>('AUTO');
  const [showMachineSignals, setShowMachineSignals] = useState(false);
  const [autoCounterBaseline, setAutoCounterBaseline] = useState<number | null>(null);
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

  /** Reset the editable workspace before looking up a different SOP. */
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

  /** Persist a progress transition for the currently loaded SOP. */
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

  /** Validate and save the current Tentering SOP record. */
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

  /** Update one editable value in a roll draft. */
  const updateRoll = (index: number, key: keyof RollDraft, value: string) =>
    setRolls((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, [key]: value } : row)),
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

  return {
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
    autoActualQuantity,
    plannedQuantity,
    actualQuantity: recordMode === 'AUTO' ? autoActualQuantity : actualQuantity,
    completedRolls,
    dashboardOrders,
    stateText,
    resetForSop,
    changeOrderProgress,
    save,
    updateRoll,
  };
}
