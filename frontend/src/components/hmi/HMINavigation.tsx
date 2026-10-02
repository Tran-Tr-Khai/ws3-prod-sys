import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';

export type HMINavigationTab = {
  label: string;
  to: string;
  end?: boolean;
};

type HMINavigationProps = {
  ariaLabel: string;
  context: string;
  tabs: HMINavigationTab[];
  trailing?: ReactNode;
};

export function HMINavigation({ ariaLabel, context, tabs, trailing }: HMINavigationProps) {
  return (
    <nav aria-label={ariaLabel} className="flex min-h-10 shrink-0 items-center gap-1 border-b-2 border-industrialDark bg-hmiSection px-2 py-1 max-[640px]:min-h-9 max-[640px]:px-1">
      <div className="mr-2 shrink-0 border-r border-line pr-3 font-mono text-[10px] font-bold uppercase tracking-[0.1em] text-industrialDark max-[640px]:mr-1 max-[640px]:pr-2 max-[640px]:text-[9px]">{context}</div>
      <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {tabs.map((tab) => <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `inline-flex min-h-8 shrink-0 items-center border-2 px-3 text-[10px] font-bold uppercase tracking-[0.1em] transition-colors max-[640px]:min-h-7 max-[640px]:px-2 max-[640px]:text-[9px] ${isActive ? 'border-industrialDark bg-industrialDark text-white shadow-[inset_0_-3px_0_#dbe6ea]' : 'border-line bg-white text-industrialDark hover:border-industrialDark hover:bg-hmiHover'}`}>
          {tab.label}
        </NavLink>)}
      </div>
      {trailing && <div className="ml-auto flex shrink-0 items-center gap-2 border-l border-line pl-3">{trailing}</div>}
    </nav>
  );
}
