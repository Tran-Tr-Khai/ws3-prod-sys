import type { ChangeEvent } from 'react';
import type { HMIStatus } from './types';
import { StatusLamp } from './StatusLamp';

export type ParameterSetpointProps = { label: string; actual: string | number; setpoint: string | number; unit: string; min?: string | number; max?: string | number; status?: HMIStatus; actualEditable?: boolean; onActualChange?: (value: number) => void; onInvalidInput?: () => void };

function formatValue(value: string | number): string {
  return typeof value === 'number' ? value.toLocaleString('en-US', { maximumFractionDigits: 1 }) : value;
}

export function ParameterSetpoint({ label, actual, setpoint, unit, min, max, status = 'normal', actualEditable = false, onActualChange, onInvalidInput }: ParameterSetpointProps) {
  const hasRange = min !== undefined && max !== undefined;
  const actualTone = status === 'warning' ? 'text-warning' : status === 'alarm' ? 'text-alarm' : 'text-industrial';
  const cellTone = status === 'warning' ? 'border-l-4 border-warning bg-[#fff7df]' : status === 'alarm' ? 'border-l-4 border-alarm bg-[#f8e7e7]' : 'border-l-4 border-industrial bg-[#eef2f3]';
  const handleActualChange = (event: ChangeEvent<HTMLInputElement>) => {
    const rawValue = event.target.value.trim();
    if (!rawValue) { onInvalidInput?.(); return; }
    const value = Number(rawValue);
    if (Number.isFinite(value)) onActualChange?.(value);
    else onInvalidInput?.();
  };
  return <section className={`overflow-hidden border-b border-line shadow-[inset_0_-1px_0_rgba(255,255,255,0.7)] ${cellTone}`}><header className="flex min-h-7 items-center justify-between border-b border-line bg-transparent px-2 py-1"><h3 className="truncate text-[11px] font-bold uppercase tracking-wider text-slate-800">{label}</h3><StatusLamp status={status} showLabel={false} /></header><div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 px-2 py-1.5"><span className="self-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Actual</span>{actualEditable ? <span className="flex items-center justify-end gap-1"><input aria-label={`${label} actual manual input`} type="number" inputMode="decimal" step="any" min={typeof min === 'number' ? min : undefined} max={typeof max === 'number' ? max : undefined} value={actual} onChange={handleActualChange} className={`h-8 w-[5.5rem] border border-info bg-[#fffdf2] px-1 font-mono text-right text-[21px] font-bold leading-none tabular-nums outline-none focus:border-industrial focus:ring-1 focus:ring-industrial ${actualTone}`} /><span className="text-[10px] font-semibold text-slate-500">{unit}</span></span> : <span className={`font-mono text-right text-[21px] font-bold leading-none tabular-nums ${actualTone}`}>{formatValue(actual)} <span className="text-[10px] font-semibold text-slate-500">{unit}</span></span>}<span className="self-center text-[10px] font-bold uppercase tracking-wider text-slate-500">Set</span><span className="border border-line bg-white px-1 font-mono text-right text-sm font-bold leading-tight tabular-nums text-slate-800">{formatValue(setpoint)} <span className="text-[10px] font-normal text-slate-500">{unit}</span></span>{hasRange && <><span className="border-t border-line pt-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Limit</span><span className="border-t border-line pt-1 font-mono text-right text-[10px] font-semibold leading-tight tabular-nums text-slate-600">{formatValue(min)}–{formatValue(max)} {unit}</span></>}</div></section>;
}