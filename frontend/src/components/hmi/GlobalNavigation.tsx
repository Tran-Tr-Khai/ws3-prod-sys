import { NavLink } from 'react-router-dom';

export function GlobalNavigation() {
  return (
    <nav aria-label="Global navigation" className="flex min-h-9 items-center border-b border-industrialDark bg-industrialDark px-2">
      <NavLink
        to="/dashboard"
        className={({ isActive }) => `inline-flex min-h-8 items-center border-x border-industrial/60 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${isActive ? 'bg-white text-industrialDark' : 'text-slate-200 hover:bg-industrial hover:text-white'}`}
      >
        WS3 Overview
      </NavLink>
    </nav>
  );
}
