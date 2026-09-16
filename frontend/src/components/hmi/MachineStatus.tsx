import { StatusLamp } from './StatusLamp';
import type { HMIStatus } from './types';

type MachineStatusProps = {
  name: string;
  code: string;
  status: HMIStatus;
  detail?: string;
};

export function MachineStatus({ name, code, status, detail }: MachineStatusProps) {
  return (
    <div className="flex items-center justify-between border-b border-line bg-panel px-3 py-2 last:border-b-0">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold text-slate-800">{name}</div>
        <div className="font-mono text-[11px] text-slate-500">{code}</div>
      </div>
      <div className="ml-3 text-right">
        <StatusLamp status={status} />
        {detail && <div className="mt-1 text-[10px] text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}
