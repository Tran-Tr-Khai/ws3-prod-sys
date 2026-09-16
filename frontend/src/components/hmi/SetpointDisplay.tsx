type SetpointDisplayProps = {
  label: string;
  current: string | number;
  setpoint: string | number;
  unit?: string;
};

export function SetpointDisplay({ label, current, setpoint, unit }: SetpointDisplayProps) {
  return (
    <div className="border border-line bg-white px-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2 font-mono tabular-nums">
        <span className="text-xl font-bold text-slate-800">{current}</span>
        <span className="text-xs text-slate-500">{unit}</span>
        <span className="text-sm font-bold text-industrial">SP {setpoint}</span>
      </div>
    </div>
  );
}
