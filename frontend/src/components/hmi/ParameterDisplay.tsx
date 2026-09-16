import type { HMIStatus } from './types';
import { StatusLamp } from './StatusLamp';

type ParameterDisplayProps = {
  label: string;
  value: string | number;
  unit?: string;
  status?: HMIStatus;
};

export function ParameterDisplay({ label, value, unit, status = 'normal' }: ParameterDisplayProps) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 px-2 py-2 last:border-b-0">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <span className="flex items-center gap-2 font-mono text-sm font-bold tabular-nums text-slate-800">
        {value} {unit && <span className="text-[10px] font-normal text-slate-500">{unit}</span>}
        <StatusLamp status={status} showLabel={false} />
      </span>
    </div>
  );
}
