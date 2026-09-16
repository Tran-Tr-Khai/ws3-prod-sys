import type { HMIStatus } from './types';

type StatusLampProps = {
  status: HMIStatus;
  label?: string;
  showLabel?: boolean;
};

const statusStyles: Record<HMIStatus, { dot: string; label: string }> = {
  running: { dot: 'bg-success', label: 'Running' },
  normal: { dot: 'bg-success', label: 'Normal' },
  warning: { dot: 'bg-warning', label: 'Warning' },
  alarm: { dot: 'bg-alarm', label: 'Alarm' },
  stopped: { dot: 'bg-slate-400', label: 'Stopped' },
  maintenance: { dot: 'bg-warning', label: 'Maintenance' },
  offline: { dot: 'bg-slate-400', label: 'Offline' },
  info: { dot: 'bg-info', label: 'Info' },
};

export function StatusLamp({ status, label, showLabel = true }: StatusLampProps) {
  const style = statusStyles[status];
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
      <span className={`h-3 w-3 rounded-full border border-slate-500 ${style.dot}`} />
      {showLabel && <span>{label ?? style.label}</span>}
    </span>
  );
}
