import type { ReactNode } from 'react';
import { useLanguage } from '../../i18n/LanguageContext';
import { HMINavigation } from './HMINavigation';

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
      : machineKey === 'tenter'
        ? tabs.filter((tab) => tab.key === 'recordEntry')
      : tabs;

  return <HMINavigation ariaLabel={`${machineId} ${machineLabel} navigation`} context={machineLabel} tabs={visibleTabs.map((tab) => ({ label: t(tab.key), to: `${basePath}${tab.suffix}`, end: tab.suffix === '' }))} trailing={trailing} />;
}
