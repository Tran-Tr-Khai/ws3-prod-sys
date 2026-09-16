import type { ReactNode } from 'react';

type ParameterCardProps = {
  title: string;
  code?: string;
  children: ReactNode;
  className?: string;
};

export function ParameterCard({ title, code, children, className = '' }: ParameterCardProps) {
  return (
    <section className={`border border-line bg-white ${className}`}>
      <header className="flex items-center justify-between border-b border-line bg-surfaceMuted px-3 py-2">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">{title}</h2>
        {code && <span className="font-mono text-[10px] text-slate-500">{code}</span>}
      </header>
      <div>{children}</div>
    </section>
  );
}
