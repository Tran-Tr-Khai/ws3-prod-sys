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
    <section className="rounded-none border-2 border-line bg-panel shadow-none">
      <header className="flex items-center justify-between border-b-2 border-line bg-surfaceMuted px-3 py-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        <StatusLamp status={status} label={statusLabel} />
      </header>
      <div className="p-3">{children}</div>
    </section>
  );
}
