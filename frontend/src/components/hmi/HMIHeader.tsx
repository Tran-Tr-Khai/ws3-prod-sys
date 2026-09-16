import { StatusLamp } from './StatusLamp';
import type { HMIStatus } from './types';

type HMIHeaderProps = {
  title: string;
  subtitle?: string;
  machineName?: string;
  status?: HMIStatus;
  time?: string;
  children?: React.ReactNode;
};

export function HMIHeader({
  title,
  subtitle,
  machineName,
  status = 'normal',
  time = '14:06:40',
  children,
}: HMIHeaderProps) {
  return (
    <header className="flex min-h-12 items-center justify-between gap-4 border-b-2 border-industrialDark bg-industrial px-3 py-1.5 text-white">
      <div className="min-w-0">
        <div className="truncate text-sm font-bold uppercase tracking-wide">{title}</div>
        {subtitle && <div className="truncate text-[11px] text-slate-200">{subtitle}</div>}
      </div>
      {machineName && (
        <div className="hidden items-center gap-3 border-l border-white/30 pl-4 text-xs sm:flex">
          <span className="font-semibold">{machineName}</span>
          <span className="[&_*]:text-white">
            <StatusLamp status={status} />
          </span>
        </div>
      )}
      <div className="ml-auto flex items-center gap-3 text-xs">
        <span className="font-mono tabular-nums text-slate-200">{time}</span>
        {children}
      </div>
    </header>
  );
}
