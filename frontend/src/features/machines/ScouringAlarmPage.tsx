import { useMemo, useState } from 'react';
import { FunctionKeyBar } from '../../components/hmi/FunctionKeyBar';
import { HMIHeader } from '../../components/hmi/HMIHeader';
import { HMIButton } from '../../components/hmi/HMIButton';
import { StatusLamp } from '../../components/hmi/StatusLamp';
import { readScouringEvents, type ScouringEvent } from './scouringEventLog';

function formatDateTime(timestamp: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(timestamp));
}

function eventLabel(event: ScouringEvent): string {
  return event.eventType.replaceAll('_', ' ');
}

function statusTone(event: ScouringEvent): string {
  if (event.validationStatus === 'alarm') return 'text-alarm';
  if (event.validationStatus === 'warning') return 'text-warning';
  return 'text-success';
}

function filterClassName(): string {
  return 'min-h-9 rounded-none border-2 border-line bg-white px-2 text-xs font-semibold text-slate-700 outline-none focus:border-industrial focus:ring-1 focus:ring-industrial';
}

export function ScouringAlarmPage() {
  const events = useMemo(() => readScouringEvents().reverse(), []);
  const [date, setDate] = useState('');
  const [machine, setMachine] = useState('');
  const [batch, setBatch] = useState('');
  const [operator, setOperator] = useState('');
  const [eventType, setEventType] = useState('');
  const [status, setStatus] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(events[0]?.eventId ?? null);
  const activeAlarms = events.filter((event) => event.eventType === 'PARAMETER_ALARM' && event.acknowledgementStatus === 'UNACKNOWLEDGED');
  const eventTypes = [...new Set(events.map((event) => event.eventType))];
  const statuses = [...new Set(events.map((event) => event.eventStatus ?? 'HISTORICAL'))];
  const machines = [...new Set(events.map((event) => event.machine))];
  const filteredEvents = events.filter((event) => (
    (!date || event.timestamp.slice(0, 10) === date)
    && (!machine || event.machine === machine)
    && (!batch || event.batch.toLowerCase().includes(batch.toLowerCase()))
    && (!operator || event.operator.toLowerCase().includes(operator.toLowerCase()))
    && (!eventType || event.eventType === eventType)
    && (!status || (event.eventStatus ?? 'HISTORICAL') === status)
  ));
  const selectedEvent = filteredEvents.find((event) => event.eventId === selectedId) ?? filteredEvents[0] ?? null;
  const clearFilters = () => { setDate(''); setMachine(''); setBatch(''); setOperator(''); setEventType(''); setStatus(''); };

  return <main className="h-screen min-h-[600px] overflow-hidden bg-navy text-slate-800 flex flex-col">
    <HMIHeader variant="machine" title="WS3 / Scouring Alarm Log" subtitle="WS3 validation and operator events · Manual input source" machineName="SC-01" status={activeAlarms.length ? 'alarm' : 'info'} time={new Date().toLocaleTimeString('vi-VN')} />
    <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
      <section className="flex-none border-b-2 border-industrialDark">
        <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrial px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Alarm / event filters</h2><span className="font-mono text-[10px] uppercase tracking-wider">{filteredEvents.length} / {events.length}</span></header>
        <div className="grid grid-cols-2 gap-1.5 bg-hmiSection p-1.5 sm:grid-cols-3 lg:grid-cols-7">
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Date<input type="date" className={filterClassName()} value={date} onChange={(event) => setDate(event.target.value)} /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Machine<select className={filterClassName()} value={machine} onChange={(event) => setMachine(event.target.value)}><option value="">All</option>{machines.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Batch<input className={filterClassName()} value={batch} onChange={(event) => setBatch(event.target.value)} placeholder="All batches" /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Operator<input className={filterClassName()} value={operator} onChange={(event) => setOperator(event.target.value)} placeholder="All operators" /></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Event type<select className={filterClassName()} value={eventType} onChange={(event) => setEventType(event.target.value)}><option value="">All</option>{eventTypes.map((value) => <option key={value} value={value}>{eventLabel({ eventType: value } as ScouringEvent)}</option>)}</select></label>
          <label className="grid gap-1 text-[10px] font-bold uppercase tracking-wider text-slate-600">Alarm status<select className={filterClassName()} value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All</option>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label>
          <HMIButton size="compact" className="self-end" onClick={clearFilters}>Clear filters</HMIButton>
        </div>
      </section>

      <section className={`border-b-2 border-industrialDark ${activeAlarms.length ? "bg-hmiAlarm" : "bg-hmiSection"}`}>
        <header className={`flex min-h-8 items-center justify-between px-2 py-1 ${activeAlarms.length ? "border-b-2 border-alarm text-alarm" : "border-b border-line text-slate-700"}`}><h2 className="text-xs font-bold uppercase tracking-wider">Active alarms</h2><span className="font-mono text-[10px] font-bold">{activeAlarms.length}</span></header>
        <div className="flex flex-wrap gap-2 p-2">{activeAlarms.length === 0 ? <span className="flex items-center gap-2 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600"><StatusLamp status="normal" showLabel={false} /> No active alarms</span> : activeAlarms.map((event) => <button key={event.eventId} type="button" className="border-2 border-alarm bg-white px-2 py-1 text-left text-xs font-bold text-alarm" onClick={() => setSelectedId(event.eventId)}>{event.parameterName ?? event.eventType} · {event.actualValue} {event.unit}</button>)}</div>
      </section>

      <div className="grid min-h-0 flex-1 gap-2 bg-hmiConsole p-2 lg:grid-cols-[minmax(0,1.08fr)_minmax(380px,0.92fr)]">
        <section className="flex min-h-0 min-w-0 flex-col bg-hmiInstrument">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Historical alarm / event records</h2><span className="text-[10px] font-semibold uppercase text-slate-300">Acknowledged events retained</span></header>
          {filteredEvents.length === 0 ? <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">No events match the filters.</div> : <div className="min-h-0 flex-1 overflow-auto"><table className="w-full min-w-[700px] border-collapse text-left text-[11px]"><thead className="sticky top-0 bg-industrial text-[10px] uppercase tracking-wider text-white"><tr><th className="px-2 py-1.5">Date / time</th><th className="px-2 py-1.5">Event</th><th className="px-2 py-1.5">Parameter</th><th className="px-2 py-1.5">Machine</th><th className="px-2 py-1.5">Operator</th><th className="px-2 py-1.5">Status</th></tr></thead><tbody>{filteredEvents.map((event) => <tr key={event.eventId} className={`cursor-pointer border-b border-line hover:bg-hmiHover ${selectedEvent?.eventId === event.eventId ? 'bg-hmiSelected' : ''}`} onClick={() => setSelectedId(event.eventId)}><td className="whitespace-nowrap px-2 py-1.5 font-mono">{formatDateTime(event.timestamp)}</td><td className={`px-2 py-1.5 font-mono text-[10px] font-bold ${statusTone(event)}`}>{eventLabel(event)}</td><td className="px-2 py-1.5 font-semibold">{event.parameterName ?? '—'}</td><td className="px-2 py-1.5 font-mono font-bold text-industrial">{event.machine}</td><td className="px-2 py-1.5">{event.operator}</td><td className={`px-2 py-1.5 font-mono text-[10px] font-bold ${event.eventStatus === 'ACTIVE' ? 'text-alarm' : event.eventStatus === 'ACKNOWLEDGED' ? 'text-warning' : 'text-slate-500'}`}>{event.eventStatus}</td></tr>)}</tbody></table></div>}
        </section>
        <section className="flex min-h-0 min-w-0 flex-col bg-hmiInstrument">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white"><h2 className="text-xs font-bold uppercase tracking-wider">Event detail</h2><span className="font-mono text-[10px] text-slate-300">EVENT</span></header>
          {selectedEvent ? <div className="min-h-0 flex-1 overflow-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 p-2 text-[11px]"><span className="font-bold uppercase text-slate-500">Event ID</span><span className="font-mono font-bold text-industrial">{selectedEvent.eventId}</span><span className="font-bold uppercase text-slate-500">Date / time</span><span className="font-mono">{formatDateTime(selectedEvent.timestamp)}</span><span className="font-bold uppercase text-slate-500">Machine / process</span><span>{selectedEvent.machine} · {selectedEvent.process}</span><span className="font-bold uppercase text-slate-500">Batch / operator</span><span>{selectedEvent.batch} · {selectedEvent.operator}</span><span className="font-bold uppercase text-slate-500">Event</span><span className={`font-mono font-bold ${statusTone(selectedEvent)}`}>{eventLabel(selectedEvent)}</span><span className="font-bold uppercase text-slate-500">Parameter</span><span>{selectedEvent.parameterName ?? '—'}</span><span className="font-bold uppercase text-slate-500">Actual</span><span className="font-mono font-bold">{selectedEvent.actualValue !== undefined ? `${selectedEvent.actualValue} ${selectedEvent.unit ?? ''}` : '—'}</span><span className="font-bold uppercase text-slate-500">SET</span><span className="font-mono">{selectedEvent.setValue !== undefined ? `${selectedEvent.setValue} ${selectedEvent.unit ?? ''}` : '—'}</span><span className="font-bold uppercase text-slate-500">Limit / range</span><span className="font-mono">{selectedEvent.limitRange ?? '—'}</span><span className="font-bold uppercase text-slate-500">Event status</span><span className="font-mono font-bold">{selectedEvent.eventStatus}</span><span className="font-bold uppercase text-slate-500">Acknowledgement</span><span className="font-mono font-bold">{selectedEvent.acknowledgementStatus}</span></div> : <div className="p-6 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">Select an event to view its details.</div>}
        </section>
      </div>
    </div>
    <div className="mx-2 mt-2 flex-none"><FunctionKeyBar keys={[{ key: 'F1', label: 'Current HMI' }, { key: 'F4', label: 'History' }, { key: 'F5', label: 'Alarm', active: true }, { key: 'F6', label: 'Menu' }]} /></div>
  </main>;
}
