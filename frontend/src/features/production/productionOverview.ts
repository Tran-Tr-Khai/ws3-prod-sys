import type { MachineSnapshot } from '../machines/machineApi';

export type ProductionSummary = {
  totalMachines: number;
  running: number;
  stopped: number;
  maintenance: number;
  alarm: number;
  productionToday: number;
};

export function summarizeProduction(machines: MachineSnapshot[]): ProductionSummary {
  return machines.reduce<ProductionSummary>(
    (summary, machine) => {
      summary.totalMachines += 1;
      summary.running += machine.status === 'RUNNING' ? 1 : 0;
      summary.stopped += machine.status === 'STOPPED' ? 1 : 0;
      summary.maintenance += machine.status === 'MAINTENANCE' ? 1 : 0;
      summary.alarm += machine.status === 'ALARM' ? 1 : 0;
      summary.productionToday += machine.productionToday;
      return summary;
    },
    { totalMachines: 0, running: 0, stopped: 0, maintenance: 0, alarm: 0, productionToday: 0 },
  );
}

export function formatProduction(value: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value);
}
