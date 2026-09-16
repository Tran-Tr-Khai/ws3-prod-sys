type ValueDisplayProps = {
  label: string;
  value: string | number;
  unit?: string;
  emphasis?: 'normal' | 'primary' | 'warning' | 'alarm';
};

const valueColors = {
  normal: 'text-slate-800',
  primary: 'text-industrial',
  warning: 'text-amber-700',
  alarm: 'text-alarm',
};

export function ValueDisplay({ label, value, unit, emphasis = 'normal' }: ValueDisplayProps) {
  return (
    <div className="border border-line bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 font-mono text-xl font-bold tabular-nums ${valueColors[emphasis]}`}>
        {value}
        {unit && <span className="ml-1 text-xs font-semibold text-slate-500">{unit}</span>}
      </div>
    </div>
  );
}
