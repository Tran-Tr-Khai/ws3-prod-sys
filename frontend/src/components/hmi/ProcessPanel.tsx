import type { ReactNode } from 'react';
import { StatusLamp } from './StatusLamp';
import type { HMIStatus } from './types';

type ProcessPanelProps = {
  title: string;
  status: HMIStatus;
  statusLabel?: string;
  children: ReactNode;
};

export function ProcessPanel({ title, status, statusLabel, children }: ProcessPanelProps) {
  return (
    <section className="border border-line bg-white">
      <header className="flex items-center justify-between border-b border-line bg-surfaceMuted px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        <StatusLamp status={status} label={statusLabel} />
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
