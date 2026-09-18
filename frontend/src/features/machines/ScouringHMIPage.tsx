import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { HMIButton } from '../../components/hmi/HMIButton';
import { ParameterSetpoint } from '../../components/hmi/ParameterSetpoint';
import { StatusLamp } from '../../components/hmi/StatusLamp';
import { readScouringRecords, type ScouringDigitalRecord } from './scouringRecord';

type ScouringParameter = { label: string; actual: number; setpoint: number; unit: string; min?: number; max?: number };
const parameters: ScouringParameter[] = [
  { label: 'NaOH quantity', actual: 50, setpoint: 50, unit: 'L' },
  { label: 'Soap quantity', actual: 18, setpoint: 20, unit: 'L' },
  { label: 'Desizer quantity', actual: 12, setpoint: 12, unit: 'L' },
  { label: 'H2O2 quantity', actual: 8, setpoint: 8, unit: 'L' },
  { label: 'Chelate quantity', actual: 5, setpoint: 5, unit: 'L' },
  { label: 'Speed', actual: 45, setpoint: 45, unit: 'm/min', min: 40, max: 50 },
  { label: 'Temperature', actual: 94, setpoint: 95, unit: '°C', min: 90, max: 98 },
  { label: 'Cylinder temperature', actual: 115, setpoint: 120, unit: '°C' },
];

function latestParameters(record: ScouringDigitalRecord | undefined): ScouringParameter[] {
  if (!record) return parameters;
  return parameters.map((parameter) => {
    const savedParameter = record.parameters.find((item) => item.name === parameter.label);
    return savedParameter
      ? { ...parameter, actual: savedParameter.actual, setpoint: savedParameter.set }
      : parameter;
  });
}

export function ScouringHMIPage() {
  const navigate = useNavigate();
  const latestRecord = useMemo(() => readScouringRecords().at(-1), []);
  const visibleParameters = latestParameters(latestRecord);

  return <main className="h-full min-h-0 overflow-hidden bg-navy text-slate-800 flex flex-col">
    <HMIHeader variant="machine" title="WS3 / Scouring Overview" subtitle="Process: Scouring / 정련기 · Batch SC-260917-01 · Operator N. Tran" machineName="SC-01" status="info" time={new Date().toLocaleTimeString('vi-VN')} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[278px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b-2 border-industrialDark bg-hmiConsole lg:border-b-0 lg:border-r-2">
          <section className="bg-hmiConsole pb-2">
            <header className="flex min-h-8 items-center justify-between border-b border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Scouring overview</h2><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">READ ONLY</span></header>
            <div className="border-l-4 border-info bg-hmiInstrument px-2 py-3"><div className="font-mono text-xl font-bold tracking-[0.12em] text-industrial">SC-01</div><div className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Scouring line · operator overview</div></div>
          </section>
          <section className="mt-2 border-b-0">
            <header className="flex min-h-8 items-center justify-between border-b-0 bg-transparent px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Batch information</h2><span className="font-mono text-[10px] text-slate-500">BATCH</span></header>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 py-2 text-[11px]"><span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="font-mono font-bold text-industrial">SC-260917-01</span><span className="font-bold uppercase tracking-wide text-slate-500">Recipe</span><span className="font-semibold">Cotton / Standard</span><span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span>N. Tran</span></div>
          </section>
          <section className="mt-2 grid gap-2 p-2">
            <HMIButton size="large" variant="primary" onClick={() => navigate('/machine/scouring/record')}>ENTER RECORD</HMIButton>
            <HMIButton size="large" variant="secondary" onClick={() => navigate('/machine/scouring/history')}>VIEW HISTORY</HMIButton>
          </section>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Scouring parameters / Process values</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><StatusLamp status="info" showLabel={false} /> MANUAL INPUT</span></header>
          <div className="min-h-0 flex-1 overflow-hidden bg-surfaceMuted p-2">
            <div className="flex min-h-0 flex-col">
              <div className="grid h-auto grid-cols-4 grid-rows-2 border border-line/50 bg-hmiInstrument divide-x divide-y divide-line/40">
                {visibleParameters.map((parameter) => <ParameterSetpoint key={parameter.label} {...parameter} actualEditable={false} />)}
              </div>
              <div className="mt-3 border-t border-line/60 px-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Values shown are current local Scouring data. Record entry is a separate workflow.</div>
            </div>
          </div>
        </section>
      </div>
    </div>
  </main>;
}
