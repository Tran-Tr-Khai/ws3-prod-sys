import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';

type MachineNavigationProps = {
  machineId: string;
  machineLabel: string;
  trailing?: ReactNode;
};

const tabs = [
  { key: 'recordEntry', suffix: '/record' },
  { key: 'history', suffix: '/history' },
  { key: 'overview', suffix: '' },
] as const;

export function MachineNavigation({ machineId, machineLabel, trailing }: MachineNavigationProps) {
  const { t } = useLanguage();
  const basePath = `/machine/${machineLabel.toLowerCase()}`;
  const machineKey = machineLabel.toLowerCase();
  const visibleTabs = machineKey === 'scouring'
    ? tabs.filter((tab) => tab.key !== 'overview')
    : machineKey === 'buffing'
      ? tabs.filter((tab) => tab.key === 'recordEntry')
      : tabs;

  return (
    <nav aria-label={`${machineId} ${machineLabel} navigation`} className="flex min-h-10 items-center gap-1 border-b-2 border-industrialDark bg-hmiSection px-2 py-1 max-[640px]:min-h-9 max-[640px]:px-1">
      <div className="mr-2 shrink-0 border-r border-line pr-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-industrialDark max-[640px]:mr-1 max-[640px]:pr-2 max-[640px]:text-[9px]">
        {machineLabel}
      </div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {visibleTabs.map((tab) => (
          <NavLink
            key={tab.key}
            end={tab.suffix === ''}
            to={`${basePath}${tab.suffix}`}
            className={({ isActive }) => `inline-flex min-h-8 shrink-0 items-center border-2 px-3 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors max-[640px]:min-h-7 max-[640px]:px-2 max-[640px]:text-[9px] ${isActive ? 'border-industrialDark bg-industrialDark text-white shadow-[inset_0_-3px_0_#dbe6ea]' : 'border-line bg-white text-industrialDark hover:border-industrialDark hover:bg-hmiHover'}`}
          >
            {t(tab.key)}
          </NavLink>
        ))}
      </div>
      {trailing}
    </nav>
  );
}
