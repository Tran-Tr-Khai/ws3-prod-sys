import type { ReactNode } from 'react';
import { HMIHeader } from './HMIHeader';
import { GlobalNavigation } from './GlobalNavigation';
import { MachineNavigation } from './MachineNavigation';
import type { HMIStatus } from './types';

type WS3ShellProps = {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  time?: string;
  status?: HMIStatus;
  machineId?: string;
  machineLabel?: string;
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
  showMachineNavigation = Boolean(machineId && machineLabel),
}: WS3ShellProps) {
  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-navy text-slate-800">
      <HMIHeader
        variant="machine"
        title={title}
        subtitle={subtitle}
        machineName={machineId}
        status={status}
        time={time}
      />
      <GlobalNavigation />
      {showMachineNavigation && machineId && machineLabel && (
        <MachineNavigation machineId={machineId} machineLabel={machineLabel} />
      )}
      <div className="min-h-0 flex-1 bg-hmiConsole">
        {children}
      </div>
    </main>
  );
}
