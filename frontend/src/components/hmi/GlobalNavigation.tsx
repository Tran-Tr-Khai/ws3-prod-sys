import { NavLink } from 'react-router-dom';

export function GlobalNavigation() {
  return (
    <nav aria-label="Global navigation" className="flex min-h-9 items-center border-b border-industrialDark bg-industrialDark px-2">
      <NavLink
        to="/ws3"
        className={({ isActive }) => `inline-flex min-h-8 items-center border-x px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${isActive ? 'border-white bg-white text-industrialDark shadow-[inset_0_-3px_0_#1f3b4a]' : 'border-industrial/60 text-slate-200 hover:bg-industrial hover:text-white'}`}
      >
        WS3 Overview
      </NavLink>
    </nav>
  );
}
