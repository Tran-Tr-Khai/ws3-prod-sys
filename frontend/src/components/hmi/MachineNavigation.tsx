import type { ReactNode } from 'react';
import { useAuth } from '../../auth/AuthContext';
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
  const { user } = useAuth();
  const basePath = `/machine/${machineLabel.toLowerCase()}`;
  const machineKey = machineLabel.toLowerCase();
  const visibleTabs = machineKey === 'scouring'
    ? tabs.filter((tab) => tab.key !== 'overview' && (user?.role !== 'OPERATOR' || tab.key !== 'history'))
    : machineKey === 'buffing'
      ? tabs.filter((tab) => tab.key === 'recordEntry' || (tab.key === 'history' && user?.role !== 'OPERATOR'))
    : machineKey === 'tenter' || machineKey === 'unrolling'
        ? tabs.filter((tab) => tab.key === 'recordEntry')
      : tabs;

  return <HMINavigation ariaLabel={`${machineId} ${machineLabel} navigation`} context={machineLabel} tabs={visibleTabs.map((tab) => ({ label: t(tab.key), to: `${basePath}${tab.suffix}`, end: tab.suffix === '' }))} trailing={trailing} />;
}
