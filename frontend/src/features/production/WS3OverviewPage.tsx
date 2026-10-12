import { useEffect, useState } from 'react';
import { WS3Shell } from '../../components/hmi/WS3Shell';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { SupportChatWidget } from '../support/SupportChatWidget';
import { MachineOverviewCard, type MachineOverviewSummary } from './MachineOverviewCard';
import { useMachineOverview } from './useMachineOverview';

const processes = [
  { name: 'Unrolling', code: 'UN-01', available: true },
  { name: 'Buffing', code: 'BU-01', available: true },
  { name: 'Scouring', code: 'SC-01', available: true },
  { name: 'Dyeing', code: 'DY-01', available: false },
  { name: 'Washing', code: 'WA-01', available: false },
  { name: 'Skachar', code: 'SK-01', available: false },
  { name: 'Tentering', code: 'TE-01', available: true },
  { name: 'Calendaring', code: 'CA-01', available: false },
  { name: 'Raising', code: 'RA-01', available: false },
  { name: 'Sueding', code: 'SU-01', available: false },
  { name: 'Transfer', code: 'HT-01', available: true },
  { name: 'Print', code: 'PR-01', available: true },
];

const overviewMachineFilterKey = 'ws3.overview.selected-machines.v3';
const legacyOverviewMachineFilterKeys = ['ws3.overview.selected-machines.v2', 'ws3.overview.selected-machines'];
const defaultOverviewMachineCodes = ['UN-01', 'BU-01', 'SC-01', 'TE-01', 'HT-01', 'PR-01'];
const overviewFilterProcesses = processes.filter((process) => process.available);

function getInitialOverviewMachineSelection(): string[] {
  try {
    const currentValue = window.localStorage.getItem(overviewMachineFilterKey);
    const migratingLegacySelection = currentValue === null;
    const legacyValue = legacyOverviewMachineFilterKeys.map((key) => window.localStorage.getItem(key)).find((value) => value !== null);
    const stored: unknown = JSON.parse(currentValue ?? legacyValue ?? 'null');
    if (Array.isArray(stored) && stored.every((code) => typeof code === 'string')) {
      const validCodes = new Set(overviewFilterProcesses.map((process) => process.code));
      const selection = stored.filter((code): code is string => validCodes.has(code));
      if (stored.includes('TE-02') && !selection.includes('TE-01')) selection.push('TE-01');
      if (migratingLegacySelection && !selection.includes('HT-01')) selection.push('HT-01');
      if (!selection.includes('PR-01')) selection.push('PR-01');
      return selection;
    }
  } catch {
    // Use the default machines when saved preferences are unavailable.
  }
  return defaultOverviewMachineCodes;
}

export function WS3OverviewPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  const isMachineOperator = user?.role === 'OPERATOR' && user.machineIds.length > 0;
  const canManageOrders = user?.role === 'ADMIN' || user?.role === 'SUPERVISOR';
  const [selectedMachineCodes, setSelectedMachineCodes] = useState<string[]>(getInitialOverviewMachineSelection);
  const [selectedTenteringMachine, setSelectedTenteringMachine] = useState('TE-01');
  const availableTenteringMachines = user?.role === 'OPERATOR'
    ? ['TE-01', 'TE-02'].filter((machineId) => user.machineIds.includes(machineId)) : ['TE-01', 'TE-02'];
  const activeTenteringMachine = availableTenteringMachines.includes(selectedTenteringMachine)
    ? selectedTenteringMachine : availableTenteringMachines[0] ?? 'TE-01';
  const { summaries, error } = useMachineOverview(activeTenteringMachine);
  const prefix = (code: string) => code.split('-')[0];
  const visibleProcesses = canManageOrders ? processes : [
    ...processes.filter((process) => process.available && (user?.machineIds.includes(process.code) || (process.name === 'Tentering' && availableTenteringMachines.length > 0))),
    ...(user?.machineIds ?? []).flatMap((machineId) => {
      const definition = processes.find((process) => !process.available && prefix(process.code) === prefix(machineId));
      return definition ? [{ ...definition, code: machineId }] : [];
    }),
  ];
  const displayedProcesses = canManageOrders ? visibleProcesses.filter((process) => selectedMachineCodes.includes(process.code)) : visibleProcesses;
  const setAllMachinesSelected = (selected: boolean) => setSelectedMachineCodes(selected ? overviewFilterProcesses.map((process) => process.code) : []);
  useEffect(() => {
    window.localStorage.setItem(overviewMachineFilterKey, JSON.stringify(selectedMachineCodes));
  }, [selectedMachineCodes]);

  const genericSummary = (machineId: string, isTransfer: boolean): MachineOverviewSummary => ({
    operation: [{ key: 'machine', label: t('machine'), value: machineId }],
    operationMessage: { text: tx('Chưa có thông tin vận hành.', 'No operation information yet.') },
    production: [],
    productionMessage: { text: isTransfer
      ? tx('Ghi nhiệt độ, tốc độ và sản lượng theo từng mã SOP.', 'Record temperature, speed, and output for each SOP.')
      : tx('Nội dung riêng của máy sẽ được bổ sung sau.', 'Machine-specific content will be added later.') },
  });
  const tenterName = activeTenteringMachine === 'TE-01' ? 'TENTER 1' : 'TENTER 2';
  const entryPaths: Record<string, string> = { Buffing: '/machine/buffing/record', Scouring: '/machine/scouring/record/operation', Unrolling: '/machine/unrolling/record' };
  const actionLabels: Record<string, string> = {
    Unrolling: tx('XEM ĐƠN & IN PHIẾU', 'VIEW ORDERS & PRINT SLIPS'), Buffing: t('openBuffing'), Scouring: t('openScouring'),
    Tentering: tx(`MỞ ${tenterName}`, `OPEN ${tenterName}`), Transfer: tx('MỞ TRANSFER', 'OPEN TRANSFER'), Print: tx('MỞ PRINT', 'OPEN PRINT'),
  };

  return <WS3Shell title={t('systemTitle')} subtitle={t('productionOverview')} status="info" time={new Date().toLocaleTimeString('vi-VN')} showGlobalNavigation={false} showSupportWidget={!isMachineOperator}>
    <div className="overview-container h-full overflow-auto bg-hmiConsole p-2 text-slate-800">
      {error && <div role="status" className="mb-2 border border-warning bg-hmiWarning px-3 py-2 text-[10px] text-warning">{error}</div>}
      <div className={isMachineOperator ? 'operator-overview-layout' : undefined}>
        {isMachineOperator && <div className="operator-overview-notices min-w-0"><SupportChatWidget embedded /></div>}
        {canManageOrders && <details className="group relative mb-2 ml-auto w-fit max-w-full">
          <summary className="flex min-h-9 cursor-pointer list-none items-center gap-2 border-2 border-industrial bg-white px-3 text-[10px] font-bold uppercase tracking-wide text-industrialDark marker:hidden">
            <span>{language === 'vi' ? 'Lọc máy' : 'Filter machines'}</span>
            <span aria-hidden="true" className="text-[9px]">▾</span>
          </summary>
          <div className="absolute right-0 top-full z-40 mt-1 w-[min(20rem,calc(100vw-2rem))] border-2 border-industrial bg-white p-2 shadow-xl">
            <div className="mb-2 flex justify-between gap-2 border-b border-line pb-2">
              <button type="button" className="text-[9px] font-bold uppercase text-industrial underline" onClick={() => setAllMachinesSelected(true)}>{language === 'vi' ? 'Chọn tất cả' : 'Select all'}</button>
              <button type="button" className="text-[9px] font-bold uppercase text-industrial underline" onClick={() => setAllMachinesSelected(false)}>{language === 'vi' ? 'Bỏ chọn tất cả' : 'Clear all'}</button>
            </div>
            <div className="grid max-h-64 grid-cols-2 gap-1 overflow-auto">
              {overviewFilterProcesses.map((process) => <label key={process.code} className="flex min-h-9 min-w-0 cursor-pointer items-center gap-2 px-1 text-[10px] hover:bg-hmiConsole">
                <input type="checkbox" checked={selectedMachineCodes.includes(process.code)} onChange={(event) => setSelectedMachineCodes((current) => event.target.checked ? [...current, process.code] : current.filter((code) => code !== process.code))} />
                <span className="truncate">{process.name}</span>
              </label>)}
            </div>
          </div>
        </details>}
        <div className={isMachineOperator ? 'operator-overview-machines grid min-w-0 grid-cols-1 gap-2' : 'grid gap-2 sm:grid-cols-2 lg:grid-cols-3'}>
          {displayedProcesses.map((process) => {
            const machineId = process.name === 'Tentering' ? activeTenteringMachine : process.code;
            return <MachineOverviewCard
              key={process.code}
              name={process.name}
              machineId={machineId}
              available={process.available}
              selector={process.name === 'Tentering' && availableTenteringMachines.length > 1
                ? <select aria-label={tx('Chọn máy Tentering', 'Select Tentering machine')} value={activeTenteringMachine} onChange={(event) => setSelectedTenteringMachine(event.target.value)} className="machine-overview__selector">
                  {availableTenteringMachines.map((id) => <option key={id} value={id}>{id === 'TE-01' ? 'TENTER 1' : 'TENTER 2'}</option>)}
                </select> : undefined}
              operationLabel={t('operation')}
              productionLabel={t('production')}
              summary={summaries[machineId] ?? genericSummary(machineId, process.name === 'Transfer')}
              href={entryPaths[process.name] ?? `/machine/${machineId}/record`}
              actionLabel={actionLabels[process.name] ?? tx('NHẬP THÔNG TIN VẬN HÀNH', 'ENTER OPERATION INFO')}
            />;
          })}
        </div>
      </div>
    </div>
  </WS3Shell>;
}
