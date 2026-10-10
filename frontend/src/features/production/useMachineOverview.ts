import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { getBuffingChecks, getMachineOrderProgress, getScouringRecords, type BuffingCheck, type ScouringRecord } from '../machines/scouringApi';
import { getTenteringOrderSource, getTenteringOrders, type TenteringOrder } from '../machines/tenteringApi';
import { listTransferRecords, type TransferRecord } from '../machines/transferApi';
import { getWS3ProductionOrderContext, getWS3ProductionReport, type WS3ProductionOrderReport, type WS3ProductionReport } from '../orders/ws3OrderApi';
import type { MachineOverviewSummary, OverviewField, OverviewMessage, OverviewTone } from './MachineOverviewCard';

function formatDateTime(timestamp: string, language: 'vi' | 'en' = 'vi'): string {
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';
  const value = new Date(timestamp);
  const date = new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
  const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
  return `${date} ${time}`;
}

function recordWarnings(record: ScouringRecord): string[] {
  const warnings: string[] = [];
  if (record.speed < 40 || record.speed > 50) warnings.push('Speed outside expected 40–50 m/min');
  if (record.temperature < 90 || record.temperature > 98) warnings.push('Temperature outside expected 90–98 °C');
  return warnings;
}

function hasCompleteProcessData(record: ScouringRecord): boolean {
  return [record.naoh, record.soap, record.desizer, record.h2o2, record.chelate, record.speed, record.temperature, record.cylinderTemperature]
    .every((value) => Number.isFinite(value));
}

function outputTone(output: number | null, planned: number | null, progress: 'IN_PROGRESS' | 'COMPLETED' | null): OverviewTone {
  if (output === null || planned === null || !Number.isFinite(output) || !Number.isFinite(planned)) return 'info';
  if (output >= planned) return 'success';
  return progress === 'COMPLETED' ? 'warning' : 'info';
}

function factoryToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

export function useMachineOverview(activeTenteringMachine: string) {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [latestRecord, setLatestRecord] = useState<ScouringRecord | null>(null);
  const [scouringCanonicalProgress, setScouringCanonicalProgress] = useState<'IN_PROGRESS' | 'COMPLETED' | null>(null);
  const [scouringRecords, setScouringRecords] = useState<ScouringRecord[]>([]);
  const [scouringProduction, setScouringProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [scouringProductionLoading, setScouringProductionLoading] = useState(false);
  const [scouringProductionError, setScouringProductionError] = useState(false);
  const [latestBuffingCheck, setLatestBuffingCheck] = useState<BuffingCheck | null>(null);
  const [buffingCanonicalProgress, setBuffingCanonicalProgress] = useState<'IN_PROGRESS' | 'COMPLETED' | null>(null);
  const [buffingChecks, setBuffingChecks] = useState<BuffingCheck[] | null>(null);
  const [buffingOrderStartedAt, setBuffingOrderStartedAt] = useState<string | null>(null);
  const [buffingProduction, setBuffingProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [buffingProductionLoading, setBuffingProductionLoading] = useState(false);
  const [buffingProductionError, setBuffingProductionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unrollingReport, setUnrollingReport] = useState<WS3ProductionReport | null>(null);
  const [unrollingLoadFailed, setUnrollingLoadFailed] = useState(false);
  const [tenteringOrders, setTenteringOrders] = useState<TenteringOrder[]>([]);
  const [tenteringLoading, setTenteringLoading] = useState(false);
  const [tenteringLoadFailed, setTenteringLoadFailed] = useState(false);
  const [tenteringMesMeters, setTenteringMesMeters] = useState<{ key: string; value: number | null } | null>(null);
  const [tenteringMesMetersLoading, setTenteringMesMetersLoading] = useState(false);
  const [transferRecords, setTransferRecords] = useState<TransferRecord[] | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);
  const [transferLoadFailed, setTransferLoadFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getScouringRecords({ signal: controller.signal })
      .then((records) => { setScouringRecords(records); setLatestRecord(records[0] ?? null); setError(null); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to reach the Scouring backend.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const orderNumber = latestRecord?.orderNumber?.trim();
    if (!orderNumber) { setScouringCanonicalProgress(null); return; }
    let active = true;
    void getMachineOrderProgress('SC-01', orderNumber)
      .then((progress) => { if (active) setScouringCanonicalProgress(progress?.orderProgress ?? null); })
      .catch(() => { if (active) setScouringCanonicalProgress(null); });
    return () => { active = false; };
  }, [latestRecord?.orderNumber]);

  useEffect(() => {
    const canView = user && (['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role) || user.machineIds.includes('SC-01'));
    const orderNumber = latestRecord?.orderNumber?.trim();
    if (!canView || !orderNumber) {
      setScouringProduction(null);
      setScouringProductionLoading(false);
      setScouringProductionError(false);
      return;
    }
    let active = true;
    setScouringProductionLoading(true);
    setScouringProductionError(false);
    getWS3ProductionOrderContext(orderNumber, 'SC-01')
      .then((report) => { if (active) setScouringProduction(report); })
      .catch(() => { if (active) { setScouringProduction(null); setScouringProductionError(true); } })
      .finally(() => { if (active) setScouringProductionLoading(false); });
    return () => { active = false; };
  }, [latestRecord, user]);

  useEffect(() => {
    const canView = user && (['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role) || user.machineIds.includes('HT-01'));
    if (!canView) {
      setTransferRecords(null);
      setTransferLoading(false);
      setTransferLoadFailed(false);
      return;
    }
    let active = true;
    setTransferLoading(true);
    void listTransferRecords()
      .then((records) => { if (active) { setTransferRecords(records); setTransferLoadFailed(false); } })
      .catch(() => { if (active) { setTransferRecords([]); setTransferLoadFailed(true); } })
      .finally(() => { if (active) setTransferLoading(false); });
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    void getBuffingChecks()
      .then((checks) => {
        setBuffingChecks(checks);
        const latest = checks[0] ?? null;
        setLatestBuffingCheck(latest);
        const orderNumber = latest?.orderNumber?.trim().toLocaleLowerCase();
        const firstCheck = orderNumber
          ? checks.filter((check) => check.orderNumber?.trim().toLocaleLowerCase() === orderNumber)
            .reduce<BuffingCheck | null>((first, check) => !first || new Date(check.checkedAt).getTime() < new Date(first.checkedAt).getTime() ? check : first, null)
          : null;
        setBuffingOrderStartedAt(firstCheck?.checkedAt ?? null);
      })
      .catch(() => { setLatestBuffingCheck(null); setBuffingOrderStartedAt(null); setBuffingChecks(null); });
  }, []);

  useEffect(() => {
    const orderNumber = latestBuffingCheck?.orderNumber?.trim();
    if (!orderNumber) { setBuffingCanonicalProgress(null); return; }
    let active = true;
    void getMachineOrderProgress('BU-01', orderNumber)
      .then((progress) => { if (active) setBuffingCanonicalProgress(progress?.orderProgress ?? null); })
      .catch(() => { if (active) setBuffingCanonicalProgress(null); });
    return () => { active = false; };
  }, [latestBuffingCheck?.orderNumber]);

  useEffect(() => {
    const canView = user && (['ADMIN', 'SUPERVISOR'].includes(user.role) || user.machineIds.includes('BU-01'));
    const orderNumber = latestBuffingCheck?.orderNumber?.trim();
    if (!canView || !orderNumber) {
      setBuffingProduction(null);
      setBuffingProductionLoading(false);
      setBuffingProductionError(false);
      return;
    }
    let active = true;
    setBuffingProductionLoading(true);
    setBuffingProductionError(false);
    getWS3ProductionOrderContext(orderNumber, 'BU-01')
      .then((report) => { if (active) setBuffingProduction(report); })
      .catch(() => { if (active) { setBuffingProduction(null); setBuffingProductionError(true); } })
      .finally(() => { if (active) setBuffingProductionLoading(false); });
    return () => { active = false; };
  }, [latestBuffingCheck, user]);

  const warnings = latestRecord ? recordWarnings(latestRecord) : [];
  const recordComplete = latestRecord ? hasCompleteProcessData(latestRecord) : false;
  const recordStatus = !recordComplete ? 'INCOMPLETE' : warnings.length > 0 ? 'WARNING' : 'COMPLETE';
  const buffingOrderChecks = latestBuffingCheck?.orderNumber && buffingChecks
    ? buffingChecks.filter((check) => check.orderNumber?.trim().toLocaleLowerCase() === latestBuffingCheck.orderNumber?.trim().toLocaleLowerCase())
    : [];
  const buffingChecksWithError = buffingOrderChecks.filter((check) => check.checks.some((pointPassed) => !pointPassed)).length;
  const buffingStatus = latestBuffingCheck ? (buffingChecksWithError === 0 ? 'COMPLETE' : 'WARNING') : null;
  const scouringMeters = scouringProduction?.rolls.reduce((total, roll) => total + (roll.length_meters ?? 0), 0) ?? 0;
  const scouringHasMeters = Boolean(scouringProduction?.rolls.length && scouringProduction.rolls.every((roll) => roll.length_meters !== null && Number.isFinite(roll.length_meters)));
  const scouringOrderRecords = latestRecord?.orderNumber ? scouringRecords.filter((record) => record.orderNumber?.trim().toLocaleLowerCase() === latestRecord.orderNumber?.trim().toLocaleLowerCase()) : [];
  const scouringOrderStartedAt = scouringOrderRecords.reduce<string | null>((first, record) => !first || new Date(record.recordedAt).getTime() < new Date(first).getTime() ? record.recordedAt : first, null);
  const scouringProductionMeters = latestRecord?.productionQuantityMeters ?? latestRecord?.outputFabricMeters ?? null;
  const formatScouringMeters = (value: number) => value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 });
  const scouringOrderProgress = scouringCanonicalProgress ?? latestRecord?.orderProgress ?? null;
  const buffingOrderProgress = buffingCanonicalProgress ?? latestBuffingCheck?.orderProgress ?? null;
  const latestTransferRecord = transferRecords?.[0] ?? null;
  const transferOrderRecords = latestTransferRecord && transferRecords
    ? transferRecords.filter((record) => record.order_number.trim().toLocaleLowerCase() === latestTransferRecord.order_number.trim().toLocaleLowerCase())
    : [];
  const transferOrderStartedAt = transferOrderRecords.reduce<string | null>((first, record) => !first || new Date(record.recorded_at).getTime() < new Date(first).getTime() ? record.recorded_at : first, null);
  const canManageOrders = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const canViewMesOrders = canManageOrders;
  useEffect(() => {
    if (!canViewMesOrders) return;
    let active = true;
    void getWS3ProductionReport(factoryToday())
      .then((report) => { if (active) { setUnrollingReport(report); setUnrollingLoadFailed(false); } })
      .catch(() => { if (active) setUnrollingLoadFailed(true); });
    return () => { active = false; };
  }, [canViewMesOrders]);
  useEffect(() => {
    let active = true;
    setTenteringLoading(true);
    setTenteringLoadFailed(false);
    void getTenteringOrders(activeTenteringMachine)
      .then((orders) => { if (active) setTenteringOrders(orders); })
      .catch(() => { if (active) { setTenteringOrders([]); setTenteringLoadFailed(true); } })
      .finally(() => { if (active) setTenteringLoading(false); });
    return () => { active = false; };
  }, [activeTenteringMachine]);
  const latestTenteringOrder = tenteringOrders[0] ?? null;
  const latestTenteringSopNo = latestTenteringOrder?.sop_no ?? '';
  useEffect(() => {
    if (!latestTenteringSopNo) {
      setTenteringMesMeters(null);
      setTenteringMesMetersLoading(false);
      return;
    }
    let active = true;
    const key = `${activeTenteringMachine}:${latestTenteringSopNo}`;
    setTenteringMesMeters(null);
    setTenteringMesMetersLoading(true);
    void getTenteringOrderSource(activeTenteringMachine, latestTenteringSopNo)
      .then((source) => {
        if (!active) return;
        const rolls = source?.rolls ?? [];
        const hasCompleteMeters = rolls.length > 0 && rolls.every((roll) => roll.length_meters !== null && Number.isFinite(roll.length_meters));
        setTenteringMesMeters({ key, value: hasCompleteMeters ? rolls.reduce((total, roll) => total + (roll.length_meters ?? 0), 0) : null });
      })
      .catch(() => { if (active) setTenteringMesMeters({ key, value: null }); })
      .finally(() => { if (active) setTenteringMesMetersLoading(false); });
    return () => { active = false; };
  }, [activeTenteringMachine, latestTenteringSopNo]);
  const tenteringOutputEntries = latestTenteringOrder?.entries.filter((entry) => entry.actual_quantity !== null && Number.isFinite(entry.actual_quantity)) ?? [];
  const tenteringOutputTotal = tenteringOutputEntries.length > 0
    ? tenteringOutputEntries.reduce((total, entry) => total + (entry.actual_quantity ?? 0), 0)
    : null;
  const tenteringMesMetersKey = latestTenteringOrder ? `${activeTenteringMachine}:${latestTenteringOrder.sop_no}` : '';
  const tenteringInputTotal = tenteringMesMeters?.key === tenteringMesMetersKey ? tenteringMesMeters.value : null;
  const formatTenteringQuantity = (value: number) => value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 3 });

  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const field = (key: string, label: string, value: OverviewField['value'], tone: OverviewTone = 'normal', fullWidth = false): OverviewField => ({ key, label, value, tone, fullWidth });
  const emptyOperation = { text: tx('Chưa có thông tin vận hành.', 'No operation information yet.') };
  const message = (text: string, tone: OverviewTone = 'muted'): OverviewMessage => ({ text, tone });
  const time = (value?: string | null) => value ? formatDateTime(value, language) : null;
  const operation = (machineId: string, record?: { shift?: string | null; started?: string | null; operator?: string | null; employee?: string | null; recorded?: string | null }): OverviewField[] => [
    field('machine', t('machine'), machineId),
    ...(record ? [
      field('shift', tx('Ca', 'Shift'), record.shift),
      field('started', tx('Bắt đầu đơn', 'Order started'), time(record.started), 'normal', true),
      field('operator', t('operator'), record.operator, 'normal', true),
      field('employee', tx('ID nhân viên', 'Employee ID'), record.employee, 'normal', true),
      field('recorded', t('lastRecorded'), time(record.recorded), 'normal', true),
    ] : []),
  ];
  const progress = (value?: 'IN_PROGRESS' | 'COMPLETED' | null) => field(
    'progress', tx('Tiến độ đơn', 'Order progress'),
    value === 'COMPLETED' ? tx('ĐÃ HOÀN THÀNH', 'COMPLETED') : value === 'IN_PROGRESS' ? tx('ĐANG XỬ LÝ', 'IN PROGRESS') : tx('CHƯA CẬP NHẬT', 'NOT SET'),
    value === 'COMPLETED' ? 'success' : value === 'IN_PROGRESS' ? 'info' : 'muted',
  );
  const inspection = (passed: boolean) => field('inspection', tx('Kết quả kiểm tra', 'Inspection result'), passed ? tx('ĐẠT', 'PASS') : tx('CẢNH BÁO', 'WARNING'), passed ? 'success' : 'warning');
  const orderFields = (report: WS3ProductionOrderReport, fallbackItem?: string | null, fallbackLot?: string | null): OverviewField[] => [
    field('sop', 'SOP', report.sop_no),
    field('item', t('item'), report.item_name || report.item_code || fallbackItem),
    field('lot', t('lotNumber'), report.lot_no || fallbackLot),
    field('rolls', tx('Số cuộn', 'Roll count'), report.matched_rolls),
  ];
  const mesMessage = (pending: boolean, failed: boolean, report: WS3ProductionOrderReport | null) => pending
    ? message(t('loadingRecorded'))
    : failed ? message(tx('Không tải được dữ liệu đơn sản xuất.', 'Unable to load production order data.'), 'warning')
      : !report ? message(tx('Không tìm thấy mã đơn này trong snapshot MES hiện tại.', 'This order is not in the current MES snapshot.')) : undefined;
  const scouringReady = latestRecord && scouringProduction && !scouringProductionLoading && !scouringProductionError;
  const buffingReady = latestBuffingCheck && buffingProduction && !buffingProductionLoading && !buffingProductionError;
  const tenteringReady = latestTenteringOrder && !tenteringLoading && !tenteringLoadFailed;

  // Machine adapters supply data only. Layout and typography live in MachineOverviewCard.
  const summaries: Record<string, MachineOverviewSummary> = {
    'SC-01': {
      operation: operation('SC-01', latestRecord ? {
        shift: latestRecord.shift, started: scouringOrderStartedAt, operator: latestRecord.operatorName,
        employee: latestRecord.operatorIdentifier, recorded: latestRecord.recordedAt,
      } : undefined),
      operationMessage: latestRecord ? undefined : message(loading ? t('loadingRecorded') : t('noScouringRecords')),
      production: scouringReady ? [
        ...orderFields(scouringProduction, latestRecord.item, latestRecord.lotNumber),
        field('input', tx('Mét đầu vào (MES)', 'Input meters (MES)'), scouringHasMeters ? `${formatScouringMeters(scouringMeters)} m` : null),
        field('output', tx('Sản lượng đầu ra', 'Machine output'), scouringProductionMeters !== null ? `${formatScouringMeters(scouringProductionMeters)} m` : null, outputTone(scouringProductionMeters, scouringHasMeters ? scouringMeters : null, scouringOrderProgress)),
      ] : [],
      productionMessage: !latestRecord ? message(loading ? t('loadingRecorded') : t('noScouringRecords')) : mesMessage(scouringProductionLoading, scouringProductionError, scouringProduction),
      statuses: latestRecord ? [inspection(recordStatus === 'COMPLETE'), progress(scouringOrderProgress)] : [],
    },
    'BU-01': {
      operation: operation('BU-01', latestBuffingCheck ? {
        shift: latestBuffingCheck.shift, started: buffingOrderStartedAt, operator: latestBuffingCheck.operatorName,
        employee: latestBuffingCheck.operatorIdentifier, recorded: latestBuffingCheck.checkedAt,
      } : undefined),
      operationMessage: latestBuffingCheck ? undefined : message(t('noBuffingRecords')),
      production: buffingReady ? [
        ...orderFields(buffingProduction),
        field('checks', tx('Lỗi / tổng lượt kiểm tra', 'Failed / total checks'), buffingChecks === null ? null : `${buffingChecksWithError}/${buffingOrderChecks.length}`, buffingChecksWithError > 0 ? 'alarm' : 'success'),
      ] : [],
      productionMessage: !latestBuffingCheck ? message(t('noBuffingRecords')) : mesMessage(buffingProductionLoading, buffingProductionError, buffingProduction),
      statuses: latestBuffingCheck ? [inspection(buffingStatus === 'COMPLETE'), progress(buffingOrderProgress)] : [],
    },
    [activeTenteringMachine]: {
      operation: operation(activeTenteringMachine, tenteringReady ? {
        shift: latestTenteringOrder.shift, started: latestTenteringOrder.created_at, operator: latestTenteringOrder.operator_name,
        employee: latestTenteringOrder.operator_identifier, recorded: latestTenteringOrder.updated_at,
      } : undefined),
      operationMessage: tenteringLoading ? message(t('loadingRecorded')) : tenteringLoadFailed
        ? message(tx('Không tải được dữ liệu Tentering.', 'Unable to load Tentering data.'), 'warning') : !latestTenteringOrder ? emptyOperation : undefined,
      production: tenteringReady ? [
        field('sop', 'SOP', latestTenteringOrder.sop_no),
        field('item', t('item'), latestTenteringOrder.item_description),
        field('rolls', tx('Số cuộn', 'Roll count'), latestTenteringOrder.entries.length),
        field('input', tx('Sản lượng theo đơn', 'Planned quantity'), tenteringMesMetersLoading ? '…' : tenteringInputTotal !== null ? `${formatTenteringQuantity(tenteringInputTotal)} m` : null),
        field('output', tx('Sản lượng đầu ra', 'Machine output'), tenteringOutputTotal !== null ? `${formatTenteringQuantity(tenteringOutputTotal)} m` : null, outputTone(tenteringOutputTotal, tenteringInputTotal, latestTenteringOrder.order_progress)),
      ] : [],
      productionMessage: tenteringLoading ? message(t('loadingRecorded')) : tenteringLoadFailed
        ? message(tx('Không tải được báo cáo Tentering.', 'Unable to load the Tentering report.'), 'warning') : !latestTenteringOrder
          ? message(tx('Chưa có đơn Tentering được ghi nhận cho máy này.', 'No Tentering orders recorded for this machine yet.')) : undefined,
      statuses: tenteringReady ? [progress(latestTenteringOrder.order_progress)] : [],
    },
    'HT-01': {
      operation: operation('HT-01', latestTransferRecord ? {
        shift: latestTransferRecord.shift,
        started: transferOrderStartedAt,
        operator: latestTransferRecord.operator_name,
        employee: latestTransferRecord.operator_identifier,
        recorded: latestTransferRecord.recorded_at,
      } : undefined),
      operationMessage: latestTransferRecord ? undefined : message(transferLoading
        ? t('loadingRecorded')
        : transferLoadFailed
          ? tx('Không tải được dữ liệu Transfer.', 'Unable to load Transfer data.')
          : tx('Chưa có thông tin vận hành.', 'No operation information yet.'), transferLoadFailed ? 'warning' : 'muted'),
      production: latestTransferRecord ? [
        field('sop', 'SOP', latestTransferRecord.order_number),
        field('item', t('item'), latestTransferRecord.item),
        field('temperature', t('temperature'), `${latestTransferRecord.temperature} °C`),
        field('speed', t('speed'), `${latestTransferRecord.speed} m/min`),
        field('output', tx('Sản lượng đầu ra', 'Machine output'), `${formatScouringMeters(latestTransferRecord.quantity_meters)} m`, 'info'),
      ] : [],
      productionMessage: latestTransferRecord ? undefined : message(transferLoading
        ? t('loadingRecorded')
        : transferLoadFailed
          ? tx('Không tải được dữ liệu Transfer.', 'Unable to load Transfer data.')
          : tx('Ghi nhiệt độ, tốc độ và sản lượng theo từng mã SOP.', 'Record temperature, speed, and output for each SOP.'), transferLoadFailed ? 'warning' : 'muted'),
      statuses: latestTransferRecord ? [progress(latestTransferRecord.order_progress)] : [],
    },
    'UN-01': {
      operation: operation('UN-01'),
      operationMessage: message(tx('Đơn và danh sách cuộn lấy trực tiếp từ MES.', 'Orders and rolls are supplied directly from MES.')),
      production: canViewMesOrders && !unrollingLoadFailed ? [
        field('orders', tx('Đơn hôm nay', 'Today’s orders'), unrollingReport?.summary.orders ?? '…'),
        field('review', tx('Cần kiểm tra', 'Needs review'), unrollingReport?.summary.check ?? '…', unrollingReport?.summary.check ? 'warning' : 'success'),
      ] : [],
      productionMessage: !canViewMesOrders ? message(tx('Supervisor xem dữ liệu đơn MES.', 'MES order information for supervisors.')) : unrollingLoadFailed
        ? message(tx('Không tải được dữ liệu MES.', 'MES data could not be loaded.'), 'warning') : undefined,
    },
  };
  return { summaries, error };
}
