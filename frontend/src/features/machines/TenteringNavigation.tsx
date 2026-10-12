import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMINavigation } from '../../components/hmi/HMINavigation';
import { useLanguage } from '../../i18n/LanguageContext';

export const TENTERING_MACHINES = [
  { id: 'TE-01', label: 'TENTER 1' },
  { id: 'TE-02', label: 'TENTER 2' },
] as const;

export function TenteringMachineSelect({ machineId, history = false, visibleLabel = false, className }: { machineId: string; history?: boolean; visibleLabel?: boolean; className?: string }) {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';
  const availableMachines = isOperator
    ? TENTERING_MACHINES.filter((item) => user.machineIds.includes(item.id))
    : TENTERING_MACHINES;
  const selectedMachine = availableMachines.find((item) => item.id === machineId) ?? availableMachines[0];
  if (!selectedMachine) return null;

  if (availableMachines.length < 2) {
    return visibleLabel ? <label className="grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{language === 'vi' ? 'MÁY' : 'MACHINE'}<span className="flex min-h-9 w-full items-center border-2 border-line bg-hmiSection px-2 text-xs font-semibold text-industrialDark">{selectedMachine.label}</span></label> : null;
  }

  return <label className={visibleLabel ? 'grid min-w-0 gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-600' : 'sr-only'} htmlFor={`tentering-machine-select-${history ? 'history' : 'record'}`}>
    {visibleLabel && (language === 'vi' ? 'MÁY' : 'MACHINE')}
    <span className="relative block min-w-0">
      <select id={`tentering-machine-select-${history ? 'history' : 'record'}`} aria-label={language === 'vi' ? 'Chọn máy Tentering' : 'Select Tentering machine'} value={selectedMachine.id} disabled={availableMachines.length < 2} onChange={(event) => navigate(`/machine/${event.target.value}/${history ? 'history' : 'record'}`)} className={className ?? 'min-h-10 w-full appearance-none border-2 border-line bg-white px-3 pr-9 text-xs font-bold tracking-wide text-industrialDark outline-none transition-colors hover:border-industrial focus:border-industrial focus-visible:outline-none disabled:cursor-not-allowed disabled:bg-hmiSection disabled:text-slate-500'}>
      {availableMachines.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
      {visibleLabel && <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-3 flex items-center"><span className="h-2 w-2 rotate-45 border-b-2 border-r-2 border-industrial" /></span>}
    </span>
  </label>;
}

export function TenteringNavigation({ machineId, history = false, showMachineSelector = true }: { machineId: string; history?: boolean; showMachineSelector?: boolean }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOperator = user?.role === 'OPERATOR';
  const machine = TENTERING_MACHINES.find((item) => item.id === machineId) ?? TENTERING_MACHINES[0];

  return <HMINavigation
    ariaLabel={`${machine.label} navigation`}
    context={machine.label}
    tabs={[
      { label: t('recordEntry'), to: `/machine/${machine.id}/record`, end: true },
      ...(!isOperator ? [{ label: t('history'), to: `/machine/${machine.id}/history`, end: true }] : []),
    ]}
    trailing={<div className="flex items-center gap-2">
      {showMachineSelector && <TenteringMachineSelect machineId={machineId} history={history} />}
      <HMIButton size="compact" onClick={() => navigate('/ws3')}>{t('home')}</HMIButton>
    </div>}
  />;
}
