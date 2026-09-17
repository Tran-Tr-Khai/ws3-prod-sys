import type { ReactNode } from 'react';
import { StatusLamp } from './StatusLamp';
import type { HMIStatus } from './types';

type HMIHeaderProps = {
  title: string;
  subtitle?: string;
  machineName?: string;
  status?: HMIStatus;
  time?: string;
  children?: ReactNode;
  variant?: 'default' | 'machine';
  showStatus?: boolean;
};

export function HMIHeader({ title, subtitle, machineName, status = 'normal', time = '14:06:40', children, variant = 'default', showStatus = true }: HMIHeaderProps) {
  if (variant === 'machine') {
    return <header className="grid min-h-12 grid-cols-[minmax(150px,1fr)_auto_minmax(180px,1.6fr)_auto] items-center gap-0 border-b-2 border-industrialDark bg-industrial px-2 text-white"><div className="min-w-0 border-r border-white/25 pr-3"><div className="truncate text-[13px] font-bold uppercase leading-tight tracking-[0.12em]">{title}</div><div className="text-[9px] font-semibold uppercase leading-none tracking-wider text-slate-300">Operator terminal</div></div><div className="flex items-center gap-2 border-r border-white/25 px-3"><span className="font-mono text-xs font-bold leading-tight tracking-wider">{machineName ?? '—'}</span>{showStatus && <span className="[&_*]:text-white"><StatusLamp status={status} label={status === 'running' ? 'RUNNING' : status === 'alarm' ? 'ALARM' : status === 'warning' ? 'WARNING' : status.toUpperCase()} /></span>}</div><div className="min-w-0 truncate px-3 text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-200">{subtitle ?? '—'}</div><div className="flex items-center gap-2 border-l border-white/25 pl-3 text-right text-xs"><span className="font-mono leading-none tabular-nums text-slate-100">{time}</span>{children}</div></header>;
  }
  return <header className="flex min-h-12 items-center justify-between gap-4 border-b-2 border-industrialDark bg-industrial px-3 py-1.5 text-white"><div className="min-w-0"><div className="truncate text-sm font-bold uppercase tracking-wide">{title}</div>{subtitle && <div className="truncate text-[11px] text-slate-200">{subtitle}</div>}</div>{machineName && <div className="hidden items-center gap-3 border-l border-white/30 pl-4 text-xs sm:flex"><span className="font-semibold">{machineName}</span><span className="[&_*]:text-white"><StatusLamp status={status} /></span></div>}<div className="ml-auto flex items-center gap-3 text-xs"><span className="font-mono tabular-nums text-slate-200">{time}</span>{children}</div></header>;
}