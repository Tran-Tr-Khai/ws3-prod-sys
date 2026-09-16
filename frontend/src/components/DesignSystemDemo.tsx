import {
  AlarmIndicator,
  FunctionKeyBar,
  HMIButton,
  HMIHeader,
  LimitDisplay,
  MachineStatus,
  ParameterCard,
  ParameterDisplay,
  ProcessPanel,
  SetpointDisplay,
  ValueDisplay,
} from './hmi';

export function DesignSystemDemo() {
  return (
    <main className="min-h-screen bg-navy text-slate-800">
      <HMIHeader
        title="WS3 / Industrial HMI"
        subtitle="Design system preview · 1024×600"
        machineName="DEMO MACHINE 01"
        status="running"
      >
        <AlarmIndicator count={2} status="warning" label="ALM" />
      </HMIHeader>

      <div className="w-full space-y-3 p-3">
        <div className="grid gap-3 lg:grid-cols-[1.1fr_1.6fr_1fr]">
          <ParameterCard title="Machine status" code="SYS-001">
            <MachineStatus name="Demo Machine 01" code="M-001" status="running" detail="Simulator online" />
            <MachineStatus name="Demo Machine 02" code="M-002" status="stopped" detail="Standby" />
          </ParameterCard>

          <ProcessPanel title="Live process values" status="normal">
            <div className="grid grid-cols-2 gap-2">
              <ValueDisplay label="Line speed" value="42.5" unit="m/min" emphasis="primary" />
              <SetpointDisplay label="Temperature" current="86.2" setpoint="85.0" unit="°C" />
              <LimitDisplay label="Moisture" value="6.4" low="4.0" high="8.0" unit="%" />
              <ValueDisplay label="Production" value="1,248" unit="kg" />
            </div>
          </ProcessPanel>

          <ParameterCard title="Control actions" code="CTRL-001">
            <div className="grid gap-2 p-3">
              <HMIButton variant="primary" size="large">Start process</HMIButton>
              <HMIButton variant="secondary">Acknowledge alarms</HMIButton>
              <HMIButton variant="danger">Stop / reset</HMIButton>
            </div>
          </ParameterCard>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <ParameterCard title="Parameter monitor" code="PAR-001">
            <ParameterDisplay label="Roller pressure" value="2.40" unit="bar" />
            <ParameterDisplay label="Exhaust fan" value="78" unit="%" status="warning" />
            <ParameterDisplay label="Water flow" value="120" unit="L/min" />
            <ParameterDisplay label="Drive status" value="READY" status="info" />
          </ParameterCard>

          <ProcessPanel title="Operator message" status="info" statusLabel="Information">
            <p className="text-sm leading-5 text-slate-600">
              This page is a component preview only. No machine control or production data is connected.
            </p>
          </ProcessPanel>
        </div>
      </div>

      <FunctionKeyBar
        keys={[
          { key: 'F1', label: 'Overview' },
          { key: 'F2', label: 'Parameters' },
          { key: 'F3', label: 'Alarms' },
          { key: 'F4', label: 'Logout' },
        ]}
      />
    </main>
  );
}
