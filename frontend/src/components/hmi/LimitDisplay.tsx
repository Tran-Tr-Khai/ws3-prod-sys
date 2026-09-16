type LimitDisplayProps = {
  label: string;
  value: string | number;
  low?: string | number;
  high?: string | number;
  unit?: string;
};

export function LimitDisplay({ label, value, low, high, unit }: LimitDisplayProps) {
  return (
    <div className="border border-line bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-xl font-bold text-slate-800">
        {value} <span className="text-xs text-slate-500">{unit}</span>
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-slate-500">
        <span>MIN {low ?? '—'}</span>
        <span>MAX {high ?? '—'}</span>
      </div>
    </div>
  );
}
