import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { getBuffingChecks, getScouringRecords, type BuffingCheck, type ScouringRecord } from '../machines/scouringApi';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { getMachineNotices, type MachineNotice } from '../support/supportApi';

const processes = [
  { name: 'Unrolling', code: 'UN-01', available: false },
  { name: 'Buffing', code: 'BU-01', available: true },
  { name: 'Scouring', code: 'SC-01', available: true },
  { name: 'Dyeing', code: 'DY-01', available: false },
  { name: 'Washing', code: 'WA-01', available: false },
  { name: 'Skachar', code: 'SK-01', available: false },
  { name: 'Tentering', code: 'TE-01', available: false },
  { name: 'Calendaring', code: 'CA-01', available: false },
] as const;

function formatDateTime(timestamp: string, language: 'vi' | 'en' = 'vi'): string {
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(timestamp));
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

export function WS3OverviewPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [latestRecord, setLatestRecord] = useState<ScouringRecord | null>(null);
  const [latestBuffingCheck, setLatestBuffingCheck] = useState<BuffingCheck | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notices, setNotices] = useState<MachineNotice[]>([]);
  const [showNotices, setShowNotices] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    getScouringRecords({ signal: controller.signal })
      .then((records) => { setLatestRecord(records[0] ?? null); setError(null); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to reach the Scouring backend.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    let active = true;
    const refresh = () => { void getMachineNotices().then((items) => { if (active) setNotices(items); }).catch(() => undefined); };
    refresh();
    const timer = window.setInterval(refresh, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    void getBuffingChecks()
      .then((checks) => setLatestBuffingCheck(checks[0] ?? null))
      .catch(() => setLatestBuffingCheck(null));
  }, []);

  const warnings = latestRecord ? recordWarnings(latestRecord) : [];
  const recordComplete = latestRecord ? hasCompleteProcessData(latestRecord) : false;
  const recordStatus = !recordComplete ? 'INCOMPLETE' : warnings.length > 0 ? 'WARNING' : 'COMPLETE';
  const buffingStatus = latestBuffingCheck ? (latestBuffingCheck.checks.every(Boolean) ? 'COMPLETE' : 'WARNING') : null;
  const canManageOrders = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const prefix = (code: string) => code.split('-')[0];
  const groupForPrefix: Record<string, string> = { UN: 'UNROLLING', BU: 'BUFFING', SC: 'SCOURING', DY: 'DYEING', WA: 'WASHING', SK: 'SKACHAR', TE: 'TENTERING', CA: 'CALENDARING' };
  const machineGroup = (processCode: string) => groupForPrefix[prefix(processCode)];
  const noticeByGroup = new Map(notices.map((notice) => [notice.recipientGroup, notice]));
  const visibleProcesses = canManageOrders ? processes : processes.filter((process) => user?.machineIds.some((id) => prefix(id) === prefix(process.code)));

  return (
    <WS3Shell title={t('systemTitle')} subtitle={t('productionOverview')} status="info" time={new Date().toLocaleTimeString('vi-VN')} showGlobalNavigation={false}>
      <div className="h-full overflow-auto bg-hmiConsole p-2 text-slate-800">
        {canManageOrders && <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><div role="group" aria-label={t('productionViewMode')} className="inline-flex max-w-full border-2 border-line bg-white p-0.5"><button type="button" aria-pressed={!showNotices} onClick={() => setShowNotices(false)} className={`min-h-8 whitespace-nowrap px-2 text-[9px] font-bold uppercase tracking-wide sm:px-3 sm:text-[10px] ${!showNotices ? 'bg-industrial text-white' : 'text-industrialDark hover:bg-hmiHover'}`}>{t('productionDashboard')}</button><button type="button" aria-pressed={showNotices} onClick={() => setShowNotices(true)} className={`min-h-8 whitespace-nowrap px-2 text-[9px] font-bold uppercase tracking-wide sm:px-3 sm:text-[10px] ${showNotices ? 'bg-industrial text-white' : 'text-industrialDark hover:bg-hmiHover'}`}>{t('notifications')}</button></div><Link to="/ws3/supervisor/orders/new"><HMIButton size="compact" variant="primary">{t('createWs3Order')}</HMIButton></Link></div>}
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
                  <dl className="grid gap-2 text-[10px]">
                    <div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{process.code}</dd></div>
                    {process.name === 'Scouring' && latestRecord ? <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestRecord.operatorName || latestRecord.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${recordStatus === 'COMPLETE' ? 'text-success' : recordStatus === 'WARNING' ? 'text-warning' : 'text-slate-500'}`}>{recordStatus === 'COMPLETE' ? t('complete') : recordStatus === 'WARNING' ? t('warning') : t('incomplete')}</dd></div></> : process.name === 'Buffing' && latestBuffingCheck ? <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestBuffingCheck.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestBuffingCheck.checkedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${buffingStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{buffingStatus === 'COMPLETE' ? t('complete') : t('warning')}</dd></div></> : <dd className="text-slate-500">{process.name === 'Scouring' ? (loading ? t('loadingRecorded') : t('noScouringRecords')) : process.name === 'Buffing' ? t('noBuffingRecords') : t('notImplemented')}</dd>}
                  </dl>
                </section>
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('production')}</h3>
                  {process.name === 'Scouring' && latestRecord ? <div className="grid gap-2 text-[10px] sm:grid-cols-2"><div><span className="block font-bold uppercase text-slate-500">{t('productionQuantity')}</span><span className="font-mono text-lg font-bold text-industrial">{latestRecord.productionQuantityMeters ?? '—'} m</span></div><div><span className="block font-bold uppercase text-slate-500">{t('fabricInOut')}</span><span className="font-mono font-bold">{latestRecord.inputFabricMeters ?? '—'} / {latestRecord.outputFabricMeters ?? '—'} m</span></div><div><span className="block font-bold uppercase text-slate-500">{t('orderNumber')}</span><span className="font-mono font-bold">{latestRecord.orderNumber || '—'}</span></div><div><span className="block font-bold uppercase text-slate-500">{t('item')}</span><span className="font-semibold">{latestRecord.item || '—'}</span></div></div> : process.name === 'Buffing' && latestBuffingCheck ? <div className="grid gap-2 text-[10px] sm:grid-cols-2"><div><span className="block font-bold uppercase text-slate-500">{t('checkPoints')}</span><span className="font-mono text-lg font-bold text-industrial">{latestBuffingCheck.checks.filter(Boolean).length}/{latestBuffingCheck.checks.length}</span></div></div> : <p className="text-xs text-slate-500">{process.name === 'Scouring' && loading ? t('loadingRecorded') : t('noData')}</p>}
                </section>
              </div> : <div className="grid flex-1 divide-y divide-line md:grid-cols-2 md:divide-x md:divide-y-0">
                <section className="min-w-0 px-3 py-3">
                  <h3 className="mb-2 border-b border-line pb-2 font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('operation')}</h3>
                  <dl className="grid gap-2 text-[10px]">
                    <div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('machine')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{canManageOrders ? process.code : user?.machineIds.filter((id) => prefix(id) === prefix(process.code)).join(' · ')}</dd></div>
                    {process.name === 'Scouring' && latestRecord && (canManageOrders || user?.machineIds.includes(latestRecord.machineId)) && <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestRecord.operatorName || latestRecord.operatorIdentifier || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestRecord.recordedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${recordStatus === 'COMPLETE' ? 'text-success' : recordStatus === 'WARNING' ? 'text-warning' : 'text-slate-500'}`}>{recordStatus === 'COMPLETE' ? t('complete') : recordStatus === 'WARNING' ? t('warning') : t('incomplete')}</dd></div></>}
                    {process.name === 'Buffing' && latestBuffingCheck && (canManageOrders || user?.machineIds.includes(latestBuffingCheck.machineId)) && <><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('operator')}</dt><dd className="mt-0.5 font-semibold">{latestBuffingCheck.operatorName || '—'}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('lastRecorded')}</dt><dd className="mt-0.5 font-mono font-bold text-industrial">{formatDateTime(latestBuffingCheck.checkedAt)}</dd></div><div><dt className="font-bold uppercase tracking-wide text-slate-500">{t('status')}</dt><dd className={`mt-0.5 font-bold ${buffingStatus === 'COMPLETE' ? 'text-success' : 'text-warning'}`}>{buffingStatus === 'COMPLETE' ? t('complete') : t('warning')}</dd></div></>}
                    {process.name === 'Scouring' && !latestRecord && <dd className="text-slate-500">{loading ? t('loadingRecorded') : t('noScouringRecords')}</dd>}
                    {process.name === 'Buffing' && !latestBuffingCheck && <dd className="text-slate-500">{t('noBuffingRecords')}</dd>}
                    {!process.available && <dd className="text-slate-500">{t('notImplemented')}</dd>}
                  </dl>
                </section>
                <section className="min-w-0 px-3 py-3">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b border-line pb-2"><h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-industrial">{t('notifications')}</h3>{noticeByGroup.get(machineGroup(process.code)) && <time className="shrink-0 text-[9px] text-slate-500">{formatDateTime(noticeByGroup.get(machineGroup(process.code))!.sentAt, language)}</time>}</div>
                  {noticeByGroup.get(machineGroup(process.code)) ? <>{noticeByGroup.get(machineGroup(process.code))!.subject.trim().toLocaleLowerCase() !== process.name.toLocaleLowerCase() && <p className="text-xs font-bold text-industrialDark">{noticeByGroup.get(machineGroup(process.code))!.subject}</p>}<p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-700">{noticeByGroup.get(machineGroup(process.code))!.message}</p><p className="mt-2 text-[9px] text-slate-500">{noticeByGroup.get(machineGroup(process.code))!.senderName}</p></> : <p className="text-xs text-slate-500">{t('noNewNotices')}</p>}
                </section>
              </div>}
              {(process.name === 'Unrolling' || process.name === 'Buffing' || process.name === 'Scouring' || process.name === 'Tentering') && <div className="mt-auto border-t border-line px-3 py-3"><Link to={process.name === 'Unrolling' ? '/machine/unrolling/record' : process.name === 'Buffing' ? '/machine/buffing/record' : process.name === 'Scouring' ? '/machine/scouring/record' : '/machine/tenter/record'} className="inline-flex w-full"><HMIButton size="compact" variant="secondary" className="w-full">{process.name === 'Unrolling' ? (language === 'vi' ? 'MỞ UNROLLING' : 'OPEN UNROLLING') : process.name === 'Buffing' ? t('openBuffing') : process.name === 'Scouring' ? t('openScouring') : t('openTenter')}</HMIButton></Link></div>}
            </article>
          ))}
        </div>
      </div>
    </WS3Shell>
  );
}
