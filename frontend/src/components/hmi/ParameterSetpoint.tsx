import type { ChangeEvent } from 'react';
import type { HMIStatus } from './types';
import { StatusLamp } from './StatusLamp';

export type ParameterSetpointProps = {
  label: string;
  actual: string | number;
  setpoint: string | number;
  unit: string;
  min?: string | number;
  max?: string | number;
  status?: HMIStatus;
  actualEditable?: boolean;
  onActualChange?: (value: number) => void;
  onInvalidInput?: () => void;
};

function formatValue(value: string | number): string {
  return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : value;
}

export function ParameterSetpoint({
  label,
  actual,
  setpoint,
  unit,
  min,
  max,
  status = 'normal',
  actualEditable = false,
  onActualChange,
  onInvalidInput,
}: ParameterSetpointProps) {
  const hasRange = min !== undefined && max !== undefined;
  const actualTone = status === 'warning' ? 'text-warning' : status === 'alarm' ? 'text-alarm' : 'text-industrial';
  const cellTone = status === 'warning' ? 'bg-[#fff7df]' : status === 'alarm' ? 'bg-[#f8e7e7]' : 'bg-[#eef2f3]';
  const handleActualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.trim();
    if (!rawValue) {
      onInvalidInput?.();
      return;
    }
    const value = Number(rawValue);
    if (Number.isFinite(value)) onActualChange?.(value);
    else onInvalidInput?.();
  };

  return (
    <section className={`flex h-full min-h-[132px] flex-col overflow-hidden shadow-[inset_0_-1px_0_rgba(255,255,255,0.7)] ${cellTone}`}>
      <header className="flex min-h-8 items-center justify-between border-b border-line px-2.5 py-1.5">
        <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.12em] text-slate-800">{label}</h3>
        <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
          <StatusLamp status={status} showLabel={false} />
          {status}
        </span>
      </header>

      <div className="flex flex-1 flex-col px-2.5 py-2">
        <div className="flex items-end justify-between gap-2">
          <span className="pb-1 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Actual</span>
          {actualEditable ? (
            <span className="flex min-w-0 items-end justify-end gap-1">
              <input
                aria-label={`${label} actual manual input`}
                type="number"
                inputMode="decimal"
                step="any"
                min={typeof min === 'number' ? min : undefined}
                max={typeof max === 'number' ? max : undefined}
                value={actual}
                onChange={handleActualChange}
                className={`h-9 min-w-0 w-[6.3rem] border border-info bg-[#fffdf2] px-1 font-mono text-right text-[25px] font-bold leading-none tabular-nums outline-none focus:border-industrial focus:ring-1 focus:ring-industrial ${actualTone}`}
              />
              <span className="pb-1 text-[10px] font-semibold text-slate-500">{unit}</span>
            </span>
          ) : (
            <span className={`font-mono text-right text-[25px] font-bold leading-none tabular-nums ${actualTone}`}>
              {formatValue(actual)} <span className="text-[10px] font-semibold text-slate-500">{unit}</span>
            </span>
          )}
        </div>

        <div className="mt-auto grid grid-cols-[auto_1fr] items-center gap-x-3 border-t border-line pt-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Set</span>
          <span className="font-mono text-right text-sm font-bold leading-none tabular-nums text-slate-700">
            {formatValue(setpoint)} <span className="text-[10px] font-normal text-slate-500">{unit}</span>
          </span>
        </div>
        <div className="mt-1 grid grid-cols-[auto_1fr] items-center gap-x-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">Limit</span>
          <span className="font-mono text-right text-[10px] font-semibold leading-none tabular-nums text-slate-500">
            {hasRange ? `${formatValue(min)}–${formatValue(max)} ${unit}` : '—'}
          </span>
        </div>
      </div>
    </section>
  );
}