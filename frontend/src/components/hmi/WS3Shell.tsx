import { useEffect, useState, type ReactNode } from 'react';
import { HMIHeader } from './HMIHeader';
import { GlobalNavigation, LanguageSwitcher } from './GlobalNavigation';
import { MachineNavigation } from './MachineNavigation';
import type { HMIStatus } from './types';
import { useLanguage } from '../../i18n/LanguageContext';
import { useAuth } from '../../auth/AuthContext';
import { SupportChatWidget } from '../../features/support/SupportChatWidget';

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
  navigation?: ReactNode;
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
  navigation,
}: WS3ShellProps) {
  const [currentTime, setCurrentTime] = useState(() => time ?? new Date().toLocaleTimeString('vi-VN'));
  const headerStorageKey = 'hmi-header-collapsed';
  const [headerCollapsed, setHeaderCollapsed] = useState(() => window.localStorage.getItem(headerStorageKey) === '1');
  const { language, t } = useLanguage();
  const { user, logout } = useAuth();
  const toggleHeader = () => setHeaderCollapsed((current) => {
    const next = !current;
    window.localStorage.setItem(headerStorageKey, next ? '1' : '0');
    return next;
  });
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(new Date().toLocaleTimeString('vi-VN')), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const localizedTitle = language === 'vi'
    ? title.includes('Scouring History') ? `WS3 / ${t('scouringHistory')}`
      : title.includes('Scouring Record') ? `WS3 / ${t('scouringRecord')}`
        : title.includes('Scouring Report') ? `WS3 / ${t('scouringReport')}`
          : title
    : title;
  return (
    <main className="relative flex h-full min-h-0 flex-col overflow-hidden bg-navy text-slate-800">
      {headerCollapsed && <div className="group absolute inset-x-0 top-0 z-50 h-2 focus-within:h-8 hover:h-8" aria-label="Header controls"><button type="button" aria-label="Hiện header" title="Hiện header" onClick={toggleHeader} className="absolute left-1/2 top-0 inline-flex h-7 w-7 -translate-x-1/2 -translate-y-1 items-center justify-center bg-hmiSection/90 text-base font-bold leading-none text-industrialDark/70 opacity-0 transition-opacity group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 hover:bg-white hover:text-industrialDark">v</button></div>}
      {!headerCollapsed && <HMIHeader
        variant="machine"
        title={localizedTitle}
        subtitle={language === 'vi' && subtitle === 'Operator terminal' ? t('operatorTerminal') : subtitle}
        machineName={machineId}
        status={status}
        time={currentTime}
        onCollapse={toggleHeader}
        children={<><div className="hidden items-center gap-1 sm:flex"><span className="text-[9px] font-bold uppercase text-slate-200">{user?.username}</span><button type="button" aria-label={t('logout')} className="inline-flex min-h-7 items-center border border-white/40 px-2 text-[9px] font-bold uppercase text-white hover:bg-white/10" onClick={logout}>{t('logout')}</button></div><div className="sm:hidden"><button type="button" aria-label={t('logout')} className="min-h-6 border border-white/40 px-1.5 text-[8px] font-bold uppercase text-white hover:bg-white/10" onClick={logout}>{t('logout')}</button></div><LanguageSwitcher /> </>}
      />}
      {showMachineNavigation && machineId && machineLabel && (
        <MachineNavigation
          machineId={machineId}
          machineLabel={machineLabel}
          trailing={showGlobalNavigation
            ? <GlobalNavigation embedded showCreateOrder={machineLabel?.toLowerCase() !== 'scouring'} />
            : undefined}
        />
      )}
      {navigation}
      {!showMachineNavigation && showGlobalNavigation && <GlobalNavigation />}
      <div className="min-h-0 flex-1 overflow-hidden bg-hmiConsole">
        {children}
      </div>
      <SupportChatWidget />
    </main>
  );
}
