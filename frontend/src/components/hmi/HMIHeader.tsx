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
    return <header className="grid min-h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b border-industrialDark bg-industrial px-2 text-white"><div className="min-w-0 pr-1"><div className="truncate text-[13px] font-bold uppercase leading-tight tracking-[0.12em]">{title}</div></div><div className="px-3 text-center text-xs"><span className="font-mono leading-none tabular-nums text-slate-100">{time}</span></div><div className="flex min-w-0 items-center justify-end gap-1 pl-1 text-right text-xs">{children}</div></header>;
  }
  return <header className="flex min-h-12 items-center justify-between gap-4 border-b border-industrialDark bg-industrial px-3 py-1.5 text-white"><div className="min-w-0"><div className="truncate text-sm font-bold uppercase tracking-wide">{title}</div>{subtitle && <div className="truncate text-[11px] text-slate-200">{subtitle}</div>}</div>{machineName && <div className="hidden items-center gap-3 border-l border-white/30 pl-4 text-xs sm:flex"><span className="font-semibold">{machineName}</span><span className="[&_*]:text-white"><StatusLamp status={status} /></span></div>}<div className="ml-auto flex items-center gap-3 text-xs"><span className="font-mono tabular-nums text-slate-200">{time}</span>{children}</div></header>;
}
