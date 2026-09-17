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

  return <main className="h-full min-h-0 overflow-hidden bg-navy text-slate-800 flex flex-col">
    <HMIHeader variant="machine" title="WS3 / Scouring HMI" subtitle="Process: Scouring / 정련기 · Batch SC-260917-01 · Operator N. Tran" machineName="SC-01" status={machineStatus} time={new Date().toLocaleTimeString('vi-VN')} showStatus={false} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <div className="grid min-h-0 flex-1 lg:grid-cols-[278px_minmax(0,1fr)]">
        <aside className="flex flex-col border-b-2 border-industrialDark bg-hmiConsole lg:border-b-0 lg:border-r-2">
          <section className="border-b-2 border-industrialDark bg-[#bcc8ce]">
            <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Machine status</h2><span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">PRIMARY STATE</span></header>
            <div className="grid grid-cols-[1fr_88px] items-stretch gap-2 p-2"><div className={`flex min-h-[76px] items-center gap-2 border-l-4 px-2 ${running ? 'border-success bg-hmiNormal' : 'border-line bg-hmiDisabled'}`}><StatusLamp status={machineStatus} showLabel={false} /><div><div className="font-mono text-2xl font-bold tracking-[0.16em] text-industrial">{running ? 'RUNNING' : 'STOPPED'}</div><div className="text-[10px] uppercase tracking-wide text-slate-500">SC-01 · Scouring line</div></div></div><HMIButton size="large" variant={running ? 'danger' : 'primary'} className="min-w-0 px-1 text-[11px] font-bold tracking-wider shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]" onClick={handleMachineToggle}>{running ? 'STOP' : 'START'}</HMIButton></div>
          </section>
          <section className="border-b border-line">
            <header className="flex min-h-8 items-center justify-between border-b border-line bg-surfaceMuted px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Batch information</h2><span className="font-mono text-[10px] text-slate-500">BATCH</span></header>
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-2 py-2 text-xs"><span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="font-mono font-bold text-industrial">SC-260917-01</span><span className="font-bold uppercase tracking-wide text-slate-500">Recipe</span><span className="font-semibold">Cotton / Standard</span><span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span>N. Tran</span></div>
          </section>
          <section>
            <header className="flex min-h-8 items-center justify-between border-b border-line bg-surfaceMuted px-2 py-1"><h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Alarm / status</h2><span className="font-mono text-[10px] text-slate-500">ALM</span></header>
            <div className="flex flex-col gap-2 p-2"><div className={`border-l-4 px-2 py-1 ${alarmCount ? 'border-alarm bg-hmiAlarm' : warningCount ? 'border-warning bg-hmiWarning' : 'border-success bg-hmiNormal'}`}><div className="grid grid-cols-3 divide-x divide-line"><div className="flex items-center gap-1 px-1">{(alarmCount > 0 || warningCount > 0) && <StatusLamp status={alarmCount ? "alarm" : "warning"} showLabel={false} />}<span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Alarms</span><span className="ml-auto font-mono text-base font-bold tabular-nums text-slate-800">{alarmCount}</span></div><div className="flex items-center justify-between px-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Warning</span><span className="font-mono text-base font-bold tabular-nums text-warning">{warningCount}</span></div><div className="flex items-center justify-between px-2"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-600">Alarm</span><span className="font-mono text-base font-bold tabular-nums text-alarm">{alarmCount}</span></div></div><div className="mt-1 border-t border-line pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">WS3 validation · manual readings</div></div><div className="grid gap-1"><HMIButton size="compact" variant={alarmAcknowledged ? "secondary" : "danger"} className="w-full min-h-10 text-[10px] font-bold tracking-wide shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]" disabled={alarmCount === 0 || alarmAcknowledged} onClick={acknowledgeAlarms}>{alarmAcknowledged ? "ACKNOWLEDGED" : "ACKNOWLEDGE ALARM"}</HMIButton><HMIButton size="compact" variant="primary" className="w-full min-h-10 text-[10px] font-bold tracking-wide shadow-[inset_0_2px_0_rgba(255,255,255,0.2)]" disabled={alarmCount > 0 && !alarmAcknowledged} onClick={confirmRecord}>{savedRecord ? "RECORD SAVED" : "CONFIRM RECORD"}</HMIButton></div></div>
          </section>
        </aside>
        <section className="flex min-h-0 min-w-0 flex-col bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Scouring parameters / Process values</h2><span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider"><StatusLamp status="info" showLabel={false} /> MANUAL INPUT</span></header>
          <div className="min-h-0 flex-1 overflow-hidden bg-surfaceMuted p-2">
            <div className="flex h-full min-h-0 flex-col gap-2">
              <section className="min-h-0 flex-none overflow-hidden bg-hmiInstrument">
                <div className="grid grid-cols-2 content-start items-start gap-px bg-line lg:grid-cols-4">
                  {validatedParameters.map((parameter) => <ParameterSetpoint key={parameter.label} {...parameter} actual={actualValues[parameter.label]} actualEditable onActualChange={(value) => updateActualValue(parameter.label, value)} onInvalidInput={() => logInvalidInput(parameter)} />)}
                </div>
              </section>
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-px border-t border-line bg-line lg:grid-cols-2">
                <section className="min-h-0 overflow-hidden bg-hmiInstrument">
                  <header className="flex min-h-7 items-center justify-between border-b border-line bg-[#d7e0e4] px-2 py-1">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-industrial">Operation context</h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Current job</span>
                  </header>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2 py-2 text-[11px]">
                    <span className="font-bold uppercase tracking-wide text-slate-500">Machine</span><span className="font-mono font-bold text-industrial">SC-01</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Process</span><span className="font-semibold">Scouring / 정련기</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Batch</span><span className="font-mono font-bold text-industrial">SC-260917-01</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Recipe</span><span>Cotton / Standard</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Operator</span><span>N. Tran</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Input mode</span><span className="font-semibold uppercase text-info">Manual readings</span>
                  </div>
                </section>
                <section className="min-h-0 overflow-hidden bg-hmiInstrument">
                  <header className="flex min-h-7 items-center justify-between border-b border-line bg-[#d7e0e4] px-2 py-1">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-industrial">Validation / record summary</h3>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-slate-500">WS3 check</span>
                  </header>
                  <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 px-2 py-2 text-[11px]">
                    <span className="font-bold uppercase tracking-wide text-slate-500">Readings</span><span className="font-mono font-bold text-industrial">{validatedParameters.length} / {validatedParameters.length}</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Warning</span><span className="font-mono font-bold text-warning">{warningCount}</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Alarm</span><span className="font-mono font-bold text-alarm">{alarmCount}</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Record</span><span className="font-semibold uppercase text-slate-600">{savedRecord ? 'Confirmed / saved' : 'Pending confirmation'}</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Last confirm</span><span className="font-mono text-slate-700">{savedRecord ? new Date(savedRecord.timestamp).toLocaleTimeString('vi-VN') : '—'}</span>
                    <span className="font-bold uppercase tracking-wide text-slate-500">Alarm ack</span><span className="font-semibold uppercase text-slate-700">{alarmCount === 0 ? 'Not required' : alarmAcknowledged ? 'Acknowledged' : 'Required'}</span>
                  </div>
                </section>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
    <div className="mx-2 mt-2 flex-none"><FunctionKeyBar keys={[{ key: 'F1', label: 'Overview' }, { key: 'F2', label: 'Parameters', active: true }, { key: 'F3', label: 'Batch' }, { key: 'F4', label: 'History', onClick: () => navigate('/machine/scouring/history') }, { key: 'F5', label: 'Alarm', onClick: () => navigate('/machine/scouring/alarm') }, { key: 'F6', label: 'Menu' }]} /></div>
  </main>;
}