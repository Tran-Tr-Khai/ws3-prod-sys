import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FunctionKeyBar } from '../../components/hmi/FunctionKeyBar';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { HMIButton } from '../../components/hmi/HMIButton';
import { ParameterSetpoint } from '../../components/hmi/ParameterSetpoint';
import { StatusLamp } from '../../components/hmi/StatusLamp';
import type { HMIStatus } from '../../components/hmi/types';
import { appendScouringRecord, type ScouringDigitalRecord } from './scouringRecord';
import { acknowledgeScouringAlarms, appendScouringEvent, readScouringEvents } from './scouringEventLog';

function validationStatus(parameter: ScouringParameter, actual: number): HMIStatus {
  if (parameter.min === undefined || parameter.max === undefined) return 'normal';
  if (actual < parameter.min || actual > parameter.max) return 'alarm';
  if (actual === parameter.min || actual === parameter.max) return 'warning';
  return 'normal';
}

type ScouringParameter = { label: string; actual: number; setpoint: number; unit: string; min?: number; max?: number; status: HMIStatus };
const parameters: ScouringParameter[] = [
  { label: 'NaOH quantity', actual: 50, setpoint: 50, unit: 'L', status: 'normal' },
  { label: 'Soap quantity', actual: 18, setpoint: 20, unit: 'L', status: 'normal' },
  { label: 'Desizer quantity', actual: 12, setpoint: 12, unit: 'L', status: 'normal' },
  { label: 'H2O2 quantity', actual: 8, setpoint: 8, unit: 'L', status: 'normal' },
  { label: 'Chelate quantity', actual: 5, setpoint: 5, unit: 'L', status: 'normal' },
  { label: 'Speed', actual: 45, setpoint: 45, unit: 'm/min', min: 40, max: 50, status: 'normal' },
  { label: 'Temperature', actual: 94, setpoint: 95, unit: '°C', min: 90, max: 98, status: 'warning' },
  { label: 'Cylinder temperature', actual: 115, setpoint: 120, unit: '°C', status: 'normal' },
];

export function ScouringHMIPage() {
  const navigate = useNavigate();
  const [running, setRunning] = useState(true);
  const [actualValues, setActualValues] = useState(() => Object.fromEntries(parameters.map((parameter) => [parameter.label, parameter.actual])) as Record<string, number>);
  const [alarmAcknowledged, setAlarmAcknowledged] = useState(false);
  const [savedRecord, setSavedRecord] = useState<ScouringDigitalRecord | null>(null);
  const machineStatus: HMIStatus = running ? 'running' : 'stopped';
  const validatedParameters = parameters.map((parameter) => ({ ...parameter, status: validationStatus(parameter, actualValues[parameter.label]) }));
  const alarmCount = validatedParameters.filter((parameter) => parameter.status === 'alarm').length;
  const warningCount = validatedParameters.filter((parameter) => parameter.status === 'warning').length;
  const eventContext = { machine: 'SC-01', process: 'Scouring / 정련기', batch: 'SC-260917-01', operator: 'N. Tran' };
  const logValidationEvent = (parameter: ScouringParameter, actual: number, validationStatus: HMIStatus) => {
    appendScouringEvent({ ...eventContext, timestamp: new Date().toISOString(), eventType: validationStatus === 'alarm' ? 'PARAMETER_ALARM' : 'PARAMETER_WARNING', parameterName: parameter.label, actualValue: actual, setValue: parameter.setpoint, unit: parameter.unit, limitRange: parameter.min !== undefined && parameter.max !== undefined ? `${parameter.min}–${parameter.max} ${parameter.unit}` : undefined, validationStatus, eventStatus: validationStatus === 'alarm' ? 'ACTIVE' : 'HISTORICAL', acknowledgementStatus: validationStatus === 'alarm' ? 'UNACKNOWLEDGED' : 'NOT_APPLICABLE' });
  };
  const logInvalidInput = (parameter: ScouringParameter) => {
    appendScouringEvent({ ...eventContext, timestamp: new Date().toISOString(), eventType: 'INVALID_INPUT_ATTEMPT', parameterName: parameter.label, unit: parameter.unit, limitRange: parameter.min !== undefined && parameter.max !== undefined ? `${parameter.min}–${parameter.max} ${parameter.unit}` : undefined, validationStatus: 'warning', eventStatus: 'HISTORICAL', acknowledgementStatus: 'NOT_APPLICABLE' });
  };
  const handleMachineToggle = () => {
    const nextRunning = !running;
    setRunning(nextRunning);
    appendScouringEvent({ ...eventContext, timestamp: new Date().toISOString(), eventType: nextRunning ? 'MACHINE_START' : 'MACHINE_STOP', validationStatus: nextRunning ? 'running' : 'stopped', eventStatus: 'HISTORICAL', acknowledgementStatus: 'NOT_APPLICABLE' });
  };
  const acknowledgeAlarms = () => {
    const activeAlarms = readScouringEvents().filter((event) => event.eventType === 'PARAMETER_ALARM' && event.acknowledgementStatus === 'UNACKNOWLEDGED');
    acknowledgeScouringAlarms(activeAlarms.map((event) => event.eventId));
    activeAlarms.forEach((event) => appendScouringEvent({ ...eventContext, timestamp: new Date().toISOString(), eventType: 'ALARM_ACKNOWLEDGED', parameterName: event.parameterName, actualValue: event.actualValue, setValue: event.setValue, unit: event.unit, limitRange: event.limitRange, validationStatus: event.validationStatus, eventStatus: 'ACKNOWLEDGED', acknowledgementStatus: 'ACKNOWLEDGED' }));
    setAlarmAcknowledged(true);
  };
  const updateActualValue = (label: string, value: number) => {
    const parameter = parameters.find((item) => item.label === label);
    if (!parameter) return;
    const previousStatus = validationStatus(parameter, actualValues[label]);
    const nextStatus = validationStatus(parameter, value);
    setActualValues((current) => ({ ...current, [label]: value }));
    setAlarmAcknowledged(false);
    setSavedRecord(null);
    if ((nextStatus === 'warning' || nextStatus === 'alarm') && nextStatus !== previousStatus) logValidationEvent(parameter, value, nextStatus);
  };  const confirmRecord = () => {
    if (alarmCount > 0 && !alarmAcknowledged) return;
    const timestamp = new Date().toISOString();
    const record: ScouringDigitalRecord = {
      machine: 'SC-01', process: 'Scouring / 정련기', batch: 'SC-260917-01', recipe: 'Cotton / Standard', operator: 'N. Tran', recordStatus: 'CONFIRMED', timestamp,
      parameters: validatedParameters.map((parameter) => ({ name: parameter.label, actual: actualValues[parameter.label], set: parameter.setpoint, unit: parameter.unit, validationStatus: parameter.status, timestamp })),
    };
    appendScouringRecord(record);
    appendScouringEvent({ ...eventContext, timestamp, eventType: 'DIGITAL_RECORD_SAVED', validationStatus: alarmCount ? 'alarm' : warningCount ? 'warning' : 'normal', eventStatus: 'HISTORICAL', acknowledgementStatus: 'NOT_APPLICABLE' });
    setSavedRecord(record);
  };

  return <main className="h-screen min-h-[600px] overflow-hidden bg-navy text-slate-800 flex flex-col">
    <HMIHeader variant="machine" title="WS3 / Scouring HMI" subtitle="Process: Scouring / 정련기 · Batch SC-260917-01 · Operator N. Tran" machineName="SC-01" status={machineStatus} time={new Date().toLocaleTimeString('vi-VN')} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-[#c7d0d4]">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[278px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b-2 border-industrialDark bg-[#c7d0d4] lg:border-b-0 lg:border-r-2">
          <section className="border-b-2 border-industrialDark bg-[#bcc8ce]">
            <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Machine status</h2><StatusLamp status={machineStatus} label={running ? 'RUN' : 'STOP'} /></header>
            <div className="grid grid-cols-[1fr_88px] items-stretch gap-2 p-2"><div className={`flex min-h-[76px] items-center gap-2 border-l-4 px-2 ${running ? 'border-success bg-[#e8f1ec]' : 'border-line bg-[#e1e6e8]'}`}><StatusLamp status={machineStatus} showLabel={false} /><div><div className="font-mono text-xl font-bold tracking-[0.16em] text-industrial">{running ? 'RUNNING' : 'STOPPED'}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">SC-01 · Scouring line</div></div></div><HMIButton size="large" variant={running ? 'danger' : 'primary'} className="min-w-0 px-1 text-[11px] tracking-wider" onClick={handleMachineToggle}>{running ? 'STOP' : 'START'}</HMIButton></div>
          </section>
          <section className="border-b border-line">
            <header className="flex min-h-8 items-center justify-between border-b border-line bg-[#dfe5e8] px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Batch information</h2><span className="font-mono text-[10px] text-slate-500">BATCH</span></header>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 py-2 text-xs"><span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="font-mono font-bold text-industrial">SC-260917-01</span><span className="font-bold uppercase tracking-wide text-slate-500">Recipe</span><span className="font-semibold">Cotton / Standard</span><span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span>N. Tran</span></div>
          </section>
          <section className="flex min-h-0 flex-1 flex-col">
            <header className="flex min-h-8 items-center justify-between border-b border-line bg-[#dfe5e8] px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Alarm / status</h2><span className="font-mono text-[10px] text-slate-500">ALM</span></header>
            <div className="flex min-h-0 flex-1 flex-col justify-between gap-2 p-2"><div className="border-l-4 px-2 py-1 ${alarmCount ? 'border-alarm bg-[#f8e7e7]' : warningCount ? 'border-warning bg-[#fff7df]' : 'border-success bg-[#e8f1ec]'}"><div className="flex items-center gap-2"><StatusLamp status={alarmCount ? "alarm" : warningCount ? "warning" : "normal"} showLabel={false} /><span className="text-xs font-bold uppercase tracking-wider text-slate-700">Alarms</span><span className="font-mono text-lg font-bold tabular-nums text-slate-800">{alarmCount}</span></div><div className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">WS3 validation · manual readings</div><div className="text-[10px] font-mono font-bold uppercase tracking-wide text-slate-600">{warningCount} warning / {alarmCount} alarm</div></div><div className="grid gap-1"><HMIButton size="compact" variant={alarmAcknowledged ? "secondary" : "danger"} className="w-full text-[10px] tracking-wide" disabled={alarmCount === 0 || alarmAcknowledged} onClick={acknowledgeAlarms}>{alarmAcknowledged ? "ACKNOWLEDGED" : "ACKNOWLEDGE ALARM"}</HMIButton><HMIButton size="compact" variant="primary" className="w-full text-[10px] tracking-wide" disabled={alarmCount > 0 && !alarmAcknowledged} onClick={confirmRecord}>{savedRecord ? "RECORD SAVED" : "CONFIRM RECORD"}</HMIButton></div></div>
          </section>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Scouring parameters / Process values</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><StatusLamp status="info" showLabel={false} /> MANUAL INPUT</span></header>
          <div className="min-h-0 flex-1 bg-[#dfe5e8] p-2"><div className="grid h-full grid-cols-2 grid-rows-4 gap-px bg-line lg:grid-cols-4 lg:grid-rows-2">{validatedParameters.map((parameter) => <ParameterSetpoint key={parameter.label} {...parameter} actual={actualValues[parameter.label]} actualEditable onActualChange={(value) => updateActualValue(parameter.label, value)} onInvalidInput={() => logInvalidInput(parameter)} />)}</div></div>
        </section>
      </div>
    </div>
    <div className="mx-2 mt-2 flex-none"><FunctionKeyBar keys={[{ key: 'F1', label: 'Overview' }, { key: 'F2', label: 'Parameters', active: true }, { key: 'F3', label: 'Batch' }, { key: 'F4', label: 'History', onClick: () => navigate('/machine/scouring/history') }, { key: 'F5', label: 'Alarm', onClick: () => navigate('/machine/scouring/alarm') }, { key: 'F6', label: 'Menu' }]} /></div>
  </main>;
}