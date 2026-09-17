import type { ReactNode } from 'react';

type ParameterCardProps = {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
};

export function ParameterCard({ title, code, children, className = '' }: ParameterCardProps) {
  return (
    <section className={`rounded-none border-2 border-line bg-panel shadow-none ${className}`}>
      <header className="flex items-center justify-between border-b-2 border-line bg-surfaceMuted px-3 py-1">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        {code && <span className="font-mono text-[10px] text-slate-500">{code}</span>}
      </header>
      <div>{children}</div>
    </section>
  );
}
