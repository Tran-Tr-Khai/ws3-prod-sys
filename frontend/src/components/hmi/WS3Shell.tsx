import { useEffect, useState, type ReactNode } from 'react';
import { HMIHeader } from './HMIHeader';
import { GlobalNavigation, LanguageSwitcher } from './GlobalNavigation';
import { MachineNavigation } from './MachineNavigation';
import type { HMIStatus } from './types';
import { useLanguage } from '../../i18n/LanguageContext';

type WS3ShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  time?: string;
  status?: HMIStatus;
  machineId?: string;
  machineLabel?: string;
  showGlobalNavigation?: boolean;
  showMachineNavigation?: boolean;
};

export function WS3Shell({
  children,
  title = 'WS3 / Production System',
  subtitle = 'Operator terminal',
  time,
  status = 'info',
  machineId,
  machineLabel,
  showGlobalNavigation = true,
  showMachineNavigation = Boolean(machineId && machineLabel),
}: WS3ShellProps) {
  const [currentTime, setCurrentTime] = useState(() => time ?? new Date().toLocaleTimeString('vi-VN'));
  const { language, t } = useLanguage();
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString('vi-VN')), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const localizedTitle = language === 'vi'
    ? title.includes('Scouring History') ? `WS3 / ${t('scouringHistory')}`
      : title.includes('Scouring Record') ? `WS3 / ${t('scouringRecord')}`
        : title.includes('Scouring Overview') ? `WS3 / ${t('scouringOverview')}`
          : title
    : title;
  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      <HMIHeader
        variant="machine"
        title={localizedTitle}
        subtitle={language === 'vi' && subtitle === 'Operator terminal' ? t('operatorTerminal') : subtitle}
        machineName={machineId}
        status={status}
        time={currentTime}
        children={<LanguageSwitcher />}
      />
      {showMachineNavigation && machineId && machineLabel && (
        <MachineNavigation
          machineId={machineId}
          machineLabel={machineLabel}
          trailing={showGlobalNavigation ? <GlobalNavigation /> : undefined}
        />
      )}
      {!showMachineNavigation && showGlobalNavigation && <GlobalNavigation />}
      <div className="min-h-0 flex-1 bg-hmiConsole">
        {children}
      </div>
    </main>
  );
}
