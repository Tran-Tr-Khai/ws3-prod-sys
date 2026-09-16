export type TrendPoint = {
  label: string;
  value: number;
};

type TrendChartProps = {
  series: TrendPoint[];
  label: string;
  unit: string;
  color?: string;
};

function pointPath(series: TrendPoint[], width: number, height: number): string {
  if (series.length === 0) return '';
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  return series.map((point, index) => {
    const x = series.length === 1 ? width / 2 : (index / (series.length - 1)) * width;
    const y = height - ((point.value - min) / range) * height;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
}

export function TrendChart({ series, label, unit, color = '#4b6475' }: TrendChartProps) {
  const width = 640;
  const height = 150;
  const path = pointPath(series, width, height);
  const latest = series.at(-1)?.value;

  return (
    <section className="rounded-none border-2 border-line bg-panel shadow-none">
      <header className="flex items-center justify-between border-b-2 border-line bg-surfaceMuted px-3 py-1.5">
        <h2 className="text-xs font-bold uppercase tracking-wide text-slate-700">Trend · {label}</h2>
        <span className="font-mono text-xs font-bold text-industrial">
          {latest === undefined ? 'Waiting for samples' : `${latest.toFixed(1)} ${unit}`}
        </span>
      </header>
      <div className="p-3">
        <div className="h-40 w-full bg-[#eef1f2]">
          {series.length > 0 ? (
            <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" role="img" aria-label={`${label} trend chart`} preserveAspectRatio="none">
              <path d="M 0 25 H 640 M 0 75 H 640 M 0 125 H 640" stroke="#d8e1ea" strokeWidth="1" />
              <path d={path} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">Collecting trend samples…</div>
          )}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-500">
          <span>{series[0]?.label ?? '—'}</span>
          <span>{series.at(-1)?.label ?? '—'}</span>
        </div>
      </div>
    </section>
  );
}
