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
  variant?: 'chemical' | 'condition';
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
  variant = 'condition',
  actualEditable = false,
  onActualChange,
  onInvalidInput,
}: ParameterSetpointProps) {
  const hasRange = min !== undefined && max !== undefined;
  const actualTone = status === 'warning' ? 'text-warning' : status === 'alarm' ? 'text-alarm' : 'text-industrial';
  const needsAttention = status === 'warning' || status === 'alarm';
  const cellTone = needsAttention ? (status === 'warning' ? 'bg-hmiWarning' : 'bg-hmiAlarm') : '';
  const compactLabel = label.replace(' quantity', '');

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

  const actualField = actualEditable ? (
    <span className="flex min-w-0 items-end justify-end gap-0.5">
      <input
        aria-label={label + ' actual manual input'}
        type="number"
        inputMode="decimal"
        step="any"
        min={typeof min === 'number' ? min : undefined}
        max={typeof max === 'number' ? max : undefined}
        value={actual}
        onChange={handleActualChange}
        className={'min-w-0 appearance-none border-0 border-b border-info bg-transparent px-1 font-mono text-right font-bold leading-none tracking-tight tabular-nums outline-none focus:border-industrial focus:bg-slate-100/40 focus:ring-0 ' + (variant === 'chemical' ? 'h-9 w-[4.5rem] text-[23px] ' : 'h-11 w-[6.3rem] text-[31px] ') + actualTone}
      />
      <span className="pb-1 text-[9px] font-semibold text-slate-500">{unit}</span>
    </span>
  ) : (
    <span className={'font-mono text-right font-bold leading-none tracking-tight tabular-nums ' + (variant === 'chemical' ? 'text-[21px] ' : 'text-[29px] ') + actualTone}>
      {formatValue(actual)} <span className="text-[9px] font-semibold text-slate-500">{unit}</span>
    </span>
  );

  if (variant === 'chemical') {
    return (
      <div className={'min-w-0 px-1.5 py-1 ' + (needsAttention ? cellTone : '')}>
        <div className="flex items-center justify-between gap-1">
          <h3 className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-slate-700">{compactLabel}</h3>
          {needsAttention && <StatusLamp status={status} showLabel={false} />}
        </div>
        <div className="mt-1 flex items-end justify-start">{actualField}</div>
        <div className="mt-1 whitespace-nowrap font-mono text-[9px] tabular-nums text-slate-500">
          <span className="mr-1 text-[8px] font-semibold uppercase tracking-[0.12em]">Set</span>{formatValue(setpoint)} {unit}
        </div>
      </div>
    );
  }

  return (
    <section className={'min-h-[142px] min-w-0 overflow-hidden px-3 py-2 ' + cellTone}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-slate-800">{label}</h3>
        {needsAttention && <span className="flex items-center gap-1 text-[8px] font-bold uppercase leading-none tracking-wider text-slate-500"><StatusLamp status={status} showLabel={false} />{status}</span>}
      </div>
      <div className="mt-2 flex items-end justify-end">{actualField}</div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-1.5">
        <span className="font-mono text-[12px] font-semibold leading-none tabular-nums text-slate-600">
          <span className="mr-2 text-[8px] font-semibold uppercase tracking-[0.16em] text-slate-500">Set</span>
          {formatValue(setpoint)} <span className="text-[9px] font-normal text-slate-500">{unit}</span>
        </span>
        {hasRange && <span className="font-mono text-right text-[9px] font-medium leading-none tabular-nums text-slate-500">
          <span className="mr-1 text-[8px] font-semibold uppercase tracking-[0.12em] text-slate-500">Range</span>{formatValue(min)}–{formatValue(max)} {unit}
        </span>}
      </div>
    </section>
  );
}