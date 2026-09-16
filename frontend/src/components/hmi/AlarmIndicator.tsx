import { StatusLamp } from './StatusLamp';
import type { HMIStatus } from './types';

type AlarmIndicatorProps = {
  count: number;
  status?: Extract<HMIStatus, 'normal' | 'warning' | 'alarm'>;
  label?: string;
};

export function AlarmIndicator({ count, status = count > 0 ? 'alarm' : 'normal', label = 'Alarms' }: AlarmIndicatorProps) {
  return (
    <div className="flex items-center gap-2 border-2 border-line bg-panel px-3 py-2">
      <StatusLamp status={status} showLabel={false} />
      <span className="text-xs font-semibold text-slate-600">{label}</span>
      <span className="font-mono text-lg font-bold tabular-nums text-slate-800">{count}</span>
    </div>
  );
}
