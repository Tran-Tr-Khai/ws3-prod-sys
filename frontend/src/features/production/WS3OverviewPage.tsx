import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getBuffingChecks, getScouringRecords, type BuffingCheck, type ScouringRecord } from '../machines/scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { getMachineNotices, type MachineNotice } from '../support/supportApi';
import { getWS3ProductionOrderContext, getWS3ProductionReport, type WS3ProductionOrderReport, type WS3ProductionReport } from '../orders/ws3OrderApi';

const processes = [
  { name: 'Unrolling', code: 'UN-01', available: true },
  { name: 'Buffing', code: 'BU-01', available: true },
  { name: 'Scouring', code: 'SC-01', available: true },
] as const;

function formatDateTime(timestamp: string, language: 'vi' | 'en' = 'vi'): string {
  const locale = language === 'vi' ? 'vi-VN' : 'en-GB';
  const value = new Date(timestamp);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(value);
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

function factoryToday(): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  return `${parts.find((part) => part.type === 'year')?.value}-${parts.find((part) => part.type === 'month')?.value}-${parts.find((part) => part.type === 'day')?.value}`;
}

export function WS3OverviewPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [latestRecord, setLatestRecord] = useState<ScouringRecord | null>(null);
  const [scouringRecords, setScouringRecords] = useState<ScouringRecord[]>([]);
  const [scouringProduction, setScouringProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [scouringProductionLoading, setScouringProductionLoading] = useState(false);
  const [scouringProductionError, setScouringProductionError] = useState(false);
  const [latestBuffingCheck, setLatestBuffingCheck] = useState<BuffingCheck | null>(null);
  const [buffingChecks, setBuffingChecks] = useState<BuffingCheck[] | null>(null);
  const [buffingOrderStartedAt, setBuffingOrderStartedAt] = useState<string | null>(null);
  const [buffingProduction, setBuffingProduction] = useState<WS3ProductionOrderReport | null>(null);
  const [buffingProductionLoading, setBuffingProductionLoading] = useState(false);
  const [buffingProductionError, setBuffingProductionError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<MachineNotice[]>([]);
  const [showNotices] = useState(false);
  const [unrollingReport, setUnrollingReport] = useState<WS3ProductionReport | null>(null);
  const [unrollingLoadFailed, setUnrollingLoadFailed] = useState(false);

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
    let active = true;
    const refresh = () => { void getMachineNotices().then((items) => { if (active) setNotices(items); }).catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

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
  const scouringLossMeters = scouringProductionMeters !== null && scouringHasMeters
    ? Number((scouringProductionMeters - scouringMeters).toFixed(2))
    : null;
  const formatScouringMeters = (value: number) => value.toLocaleString(language === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: 2 });
  const scouringProductionSummary = !latestRecord
    ? <p className="text-xs text-slate-500">{loading ? t('loadingRecorded') : t('noScouringRecords')}</p>
    : scouringProductionLoading
      ? <p className="text-xs text-slate-500">{t('loadingRecorded')}</p>
      : scouringProductionError
        ? <p role="status" className="text-xs text-warning">{language === 'vi' ? 'Không tải được dữ liệu đơn sản xuất.' : 'Unable to load production order data.'}</p>
        : scouringProduction
          ? <div className="grid gap-2 text-[10px] sm:grid-cols-2">
              <div><span className="block font-bold uppercase text-slate-500">{t('orderNumber')}</span><span className="font-mono font-bold text-industrial">{scouringProduction.pk_no}</span></div>
              <div><span className="block font-bold uppercase text-slate-500">{t('item')}</span><span className="font-semibold">{scouringProduction.item_name || scouringProduction.item_code || latestRecord.item || '—'}</span></div>
              <div><span className="block font-bold uppercase text-slate-500">{t('lotNumber')}</span><span className="font-mono font-semibold">{scouringProduction.lot_no || latestRecord.lotNumber || '—'}</span></div>
              <div><span className="block font-bold uppercase text-slate-500">{language === 'vi' ? 'Số cuộn' : 'Rolls'}</span><span className="font-mono font-bold">{scouringProduction.matched_rolls}</span></div>
              <div><span className="block font-bold uppercase text-slate-500">{language === 'vi' ? 'Tổng số mét' : 'Total meters'}</span><span className="font-mono text-lg font-bold text-industrial">{scouringHasMeters ? `${formatScouringMeters(scouringMeters)} m` : '—'}</span></div>
              <div className="grid content-start gap-2">
                <div><span className="block font-bold uppercase text-slate-500">{t('productionQuantity')}</span><span className="font-mono font-bold text-industrialDark">{scouringProductionMeters !== null ? `${formatScouringMeters(scouringProductionMeters)} m` : '—'}</span></div>
                <div><span className="block font-bold uppercase text-slate-500">{language === 'vi' ? 'Hao hụt' : 'Loss'}</span><span className={`font-mono font-bold ${scouringLossMeters === null || scouringLossMeters === 0 ? 'text-industrialDark' : scouringLossMeters < 0 ? 'text-alarm' : 'text-success'}`}>{scouringLossMeters !== null ? `${formatScouringMeters(scouringLossMeters)} m` : '—'}</span></div>
              </div>
            </div>
          : <p className="text-xs text-slate-500">{language === 'vi' ? 'Không tìm thấy mã đơn này trong snapshot MES hiện tại.' : 'This order is not in the current MES snapshot.'}</p>;
  const scouringQuickStatuses = latestRecord && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2 text-[10px]"><div><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Kết quả kiểm tra' : 'Inspection result'}</span><span className={`font-bold ${recordStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{recordStatus === 'COMPLETE' ? (language === 'vi' ? 'ĐẠT' : 'PASS') : (language === 'vi' ? 'CẢNH BÁO' : 'WARNING')}</span></div><div><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}</span><span className={`font-bold ${latestRecord.orderProgress === 'COMPLETED' ? 'text-success' : latestRecord.orderProgress === 'IN_PROGRESS' ? 'text-info' : 'text-slate-500'}`}>{latestRecord.orderProgress === 'COMPLETED' ? (language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : latestRecord.orderProgress === 'IN_PROGRESS' ? (language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS') : (language === 'vi' ? 'CHƯA CẬP NHẬT' : 'NOT SET')}</span></div></div>;
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
  const prefix = (code: string) => code.split('-')[0];
  const groupForPrefix: Record<string, string> = { UN: 'UNROLLING', BU: 'BUFFING', SC: 'SCOURING', DY: 'DYEING', WA: 'WASHING', SK: 'SKACHAR', TE: 'TENTERING', CA: 'CALENDARING' };
  const machineGroup = (processCode: string) => groupForPrefix[prefix(processCode)];
  const noticeByGroup = new Map(notices.map((notice) => [notice.recipientGroup, notice]));
  const visibleProcesses = canManageOrders ? processes : processes.filter((process) => user?.machineIds.some((id) => prefix(id) === prefix(process.code)));

  return (
    <WS3Shell title={t('systemTitle')} subtitle={t('productionOverview')} status="info" time={new Date().toLocaleTimeString('vi-VN')} showGlobalNavigation={false}>
      <div className="h-full overflow-auto bg-hmiConsole p-2 text-slate-800">
        {error && <div role="status" className="mb-2 border border-warning bg-hmiWarning px-3 py-2 text-[10px] text-warning">{error}</div>}
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {visibleProcesses.map((process) => (
            <article key={process.name} className={`flex min-w-0 flex-col bg-white ${process.available ? 'border-2 border-industrial' : 'border border-line'}`}>
              <header className={`flex min-h-9 items-center justify-between px-3 py-2 text-white ${process.available ? 'bg-industrial' : 'bg-industrialDark'}`}>
                <h2 className="font-mono text-sm font-bold uppercase tracking-[0.1em]">{process.name}</h2>
                <span className="font-mono text-[9px] text-slate-300">{canManageOrders ? process.code : user?.machineIds.filter((id) => prefix(id) === prefix(process.code)).join(' · ')}</span>
              </header>
              {canManageOrders ? showNotices ? <section className="min-h-[150px] flex-1 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-2"><h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('notifications')}</h3>{noticeByGroup.get(machineGroup(process.code)) && <time className="shrink-0 text-[9px] text-slate-500">{formatDateTime(noticeByGroup.get(machineGroup(process.code))!.sentAt, language)}</time>}</div>
                {noticeByGroup.get(machineGroup(process.code)) ? <>{noticeByGroup.get(machineGroup(process.code))!.subject.trim().toLocaleLowerCase() !== process.name.toLocaleLowerCase() && <p className="text-xs font-bold text-industrialDark">{noticeByGroup.get(machineGroup(process.code))!.subject}</p>}<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{noticeByGroup.get(machineGroup(process.code))!.message}</p><p className="mt-2 text-[9px] text-slate-500">{noticeByGroup.get(machineGroup(process.code))!.senderName}</p></> : <p className="text-xs text-slate-500">{t('noNewNotices')}</p>}
              </section> : <div className="grid flex-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('operation')}</h3>
                  {process.name === 'Buffing' && <div className="mb-2 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{process.code}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Ca' : 'Shift'}</dt><dd className="mt-0.5 font-semibold">{latestBuffingCheck?.shift || '—'}</dd></div></div>}
                  {process.name === 'Buffing' && latestBuffingCheck && <div className="mb-2 text-[10px]"><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Bắt đầu đơn' : 'Order started'}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{buffingOrderStartedAt ? formatDateTime(buffingOrderStartedAt, language) : '—'}</dd></div>}
                  {process.name === 'Scouring' && latestRecord && <div className="mb-2 grid grid-cols-2 gap-2 text-[10px]"><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{latestRecord.machineId}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Ca' : 'Shift'}</dt><dd className="mt-0.5 font-semibold">{latestRecord.shift || '—'}</dd></div></div>}
                  {process.name === 'Scouring' && latestRecord && <div className="mb-2 text-[10px]"><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Bắt đầu đơn' : 'Order started'}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{scouringOrderStartedAt ? formatDateTime(scouringOrderStartedAt, language) : '—'}</dd></div>}
                  <dl className={`grid gap-2 text-[10px] ${process.name === 'Buffing' ? '[&>div:first-child]:hidden [&>div:last-child]:hidden' : process.name === 'Scouring' && latestRecord ? '[&>div:first-child]:hidden' : ''}`}>
                    <div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{process.code}</dd></div>
                    {process.name === 'Unrolling' ? <dd className="text-slate-600">{language === 'vi' ? 'Đơn và danh sách cuộn lấy trực tiếp từ MES.' : 'Orders and rolls are supplied directly from MES.'}</dd> : process.name === 'Scouring' && latestRecord ? <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestRecord.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</dt><dd className="mt-0.5 font-mono font-semibold">{latestRecord.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt, language)}</dd></div></> : process.name === 'Buffing' && latestBuffingCheck ? <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestBuffingCheck.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</dt><dd className="mt-0.5 font-mono font-semibold">{latestBuffingCheck.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestBuffingCheck.checkedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${buffingStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{buffingStatus === 'COMPLETE' ? t('complete') : t('warning')}</dd></div></> : <dd className="text-slate-500">{process.name === 'Scouring' ? (loading ? t('loadingRecorded') : t('noScouringRecords')) : process.name === 'Buffing' ? t('noBuffingRecords') : t('notImplemented')}</dd>}
                  </dl>
                </section>
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('production')}</h3>
                  {process.name === 'Buffing' && latestBuffingCheck && (buffingProductionLoading ? <p className="mb-2 text-xs text-slate-500">{t('loadingRecorded')}</p> : buffingProductionError ? <p role="status" className="mb-2 text-xs text-warning">{language === 'vi' ? 'Không tải được dữ liệu đơn sản xuất.' : 'Unable to load production order data.'}</p> : buffingProduction ? <div className="mb-2 grid gap-2 text-[10px] sm:grid-cols-2"><div><span className="block font-bold uppercase text-slate-500">{t('orderNumber')}</span><span className="font-mono font-bold text-industrial">{buffingProduction.pk_no}</span></div><div><span className="block font-bold uppercase text-slate-500">{t('item')}</span><span className="font-semibold">{buffingProduction.item_name || buffingProduction.item_code || '—'}</span></div><div><span className="block font-bold uppercase text-slate-500">{t('lotNumber')}</span><span className="font-mono font-semibold">{buffingProduction.lot_no || '—'}</span></div><div><span className="block font-bold uppercase text-slate-500">{language === 'vi' ? 'Số cuộn' : 'Roll count'}</span><span className="font-mono font-bold">{buffingProduction.matched_rolls}</span></div><div><span className="block font-bold uppercase text-slate-500">{language === 'vi' ? 'Lỗi / tổng lượt kiểm tra' : 'Failed / total checks'}</span><span className="font-mono text-lg font-bold text-industrial">{buffingChecks === null ? '—' : `${buffingChecksWithError}/${buffingOrderChecks.length}`}</span></div></div> : <p className="mb-2 text-xs text-slate-500">{language === 'vi' ? 'Không tìm thấy mã đơn này trong snapshot MES hiện tại.' : 'This order is not in the current MES snapshot.'}</p>)}
                  {process.name === 'Buffing' && latestBuffingCheck && <div className="mt-2 grid grid-cols-2 gap-2 border-t border-line pt-2 text-[10px]"><div><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Kết quả kiểm tra' : 'Inspection result'}</span><span className={`mt-0.5 block text-[10px] font-bold ${buffingStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{buffingStatus === 'COMPLETE' ? (language === 'vi' ? 'ĐẠT' : 'PASS') : (language === 'vi' ? 'CẢNH BÁO' : 'WARNING')}</span></div><div><span className="block text-[9px] font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Tiến độ đơn' : 'Order progress'}</span><span className={`mt-0.5 block text-[10px] font-bold ${latestBuffingCheck.orderProgress === 'COMPLETED' ? 'text-success' : latestBuffingCheck.orderProgress === 'IN_PROGRESS' ? 'text-info' : 'text-slate-500'}`}>{latestBuffingCheck.orderProgress === 'COMPLETED' ? (language === 'vi' ? 'ĐÃ HOÀN THÀNH' : 'COMPLETED') : latestBuffingCheck.orderProgress === 'IN_PROGRESS' ? (language === 'vi' ? 'ĐANG XỬ LÝ' : 'IN PROGRESS') : (language === 'vi' ? 'CHƯA CẬP NHẬT' : 'NOT SET')}</span></div></div>}
                  {process.name === 'Scouring' ? <>{scouringProductionSummary}{scouringQuickStatuses}</> : process.name === 'Unrolling' ? canViewMesOrders ? unrollingLoadFailed ? <p role="status" className="text-xs font-semibold text-warning">{language === 'vi' ? 'Không tải được dữ liệu MES.' : 'MES data could not be loaded.'}</p> : <div className="grid grid-cols-2 gap-2"><div><span className="block text-[9px] font-bold uppercase text-slate-500">{language === 'vi' ? 'ĐƠN HÔM NAY' : 'TODAY’S ORDERS'}</span><strong className="font-mono text-lg text-industrial">{unrollingReport?.summary.orders ?? '…'}</strong></div><div><span className="block text-[9px] font-bold uppercase text-slate-500">{language === 'vi' ? 'CẦN KIỂM TRA' : 'NEEDS REVIEW'}</span><strong className={`font-mono text-lg ${unrollingReport?.summary.check ? 'text-warning' : 'text-success'}`}>{unrollingReport?.summary.check ?? '…'}</strong></div></div> : <p className="text-xs text-slate-500">{language === 'vi' ? 'Supervisor xem dữ liệu đơn MES.' : 'MES order information for supervisors.'}</p> : process.name === 'Buffing' ? null : <p className="text-xs text-slate-500">{t('noData')}</p>}
                </section>
              </div> : <div className="grid flex-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('operation')}</h3>
                  <dl className={`grid gap-2 text-[10px] ${process.name === 'Buffing' ? '[&>div:last-child]:hidden' : ''}`}>
                    <div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{canManageOrders ? process.code : user?.machineIds.filter((id) => prefix(id) === prefix(process.code)).join(' · ')}</dd></div>
                    {process.name === 'Scouring' && latestRecord && (canManageOrders || user?.machineIds.includes(latestRecord.machineId)) && <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Ca' : 'Shift'}</dt><dd className="mt-0.5 font-semibold">{latestRecord.shift || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestRecord.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</dt><dd className="mt-0.5 font-mono font-semibold">{latestRecord.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'Bắt đầu đơn' : 'Order started'}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{scouringOrderStartedAt ? formatDateTime(scouringOrderStartedAt, language) : '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt, language)}</dd></div></>}
                    {process.name === 'Buffing' && latestBuffingCheck && (canManageOrders || user?.machineIds.includes(latestBuffingCheck.machineId)) && <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestBuffingCheck.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{language === 'vi' ? 'ID nhân viên' : 'Employee ID'}</dt><dd className="mt-0.5 font-mono font-semibold">{latestBuffingCheck.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestBuffingCheck.checkedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${buffingStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{buffingStatus === 'COMPLETE' ? t('complete') : t('warning')}</dd></div></>}
                    {process.name === 'Scouring' && !latestRecord && <dd className="text-slate-500">{loading ? t('loadingRecorded') : t('noScouringRecords')}</dd>}
                    {process.name === 'Buffing' && !latestBuffingCheck && <dd className="text-slate-500">{t('noBuffingRecords')}</dd>}
                    {!process.available && <dd className="text-slate-500">{t('notImplemented')}</dd>}
                  </dl>
                </section>
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('production')}</h3>
                  {process.name === 'Scouring' ? <>{scouringProductionSummary}{scouringQuickStatuses}</> : process.name === 'Buffing' ? null : <p className="text-xs text-slate-500">{t('noData')}</p>}
                </section>
              </div>}
              <div className="mt-auto border-t border-line px-3 py-3"><Link to={process.name === 'Unrolling' ? '/machine/unrolling/record' : process.name === 'Buffing' ? '/machine/buffing/record' : '/machine/scouring/record'} className="inline-flex w-full"><HMIButton size="compact" variant="secondary" className="w-full">{process.name === 'Unrolling' ? (language === 'vi' ? 'XEM ĐƠN & IN PHIẾU' : 'VIEW ORDERS & PRINT SLIPS') : process.name === 'Buffing' ? t('openBuffing') : t('openScouring')}</HMIButton></Link></div>
            </article>
          ))}
        </div>
      </div>
    </WS3Shell>
  );
}
