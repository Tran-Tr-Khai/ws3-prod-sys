import { Link } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { WS3Shell } from '../../components/hmi/WS3Shell';

const processes = [
  { name: 'Scouring', code: 'SC-01', available: true },
  { name: 'Tenter', code: 'TE-01', available: false },
  { name: 'Dyeing', code: 'DY-01', available: false },
  { name: 'Suction', code: 'SU-01', available: false },
  { name: 'Calendar', code: 'CA-01', available: false },
  { name: 'Rapid', code: 'RA-01', available: false },
] as const;

export function WS3OverviewPage() {
  return (
    <WS3Shell title="WS3 Production System" subtitle="Select a production module" status="info" time={new Date().toLocaleTimeString('vi-VN')}>
      <div className="flex h-full min-h-0 flex-col overflow-auto bg-hmiConsole p-2 text-slate-800">
        <section className="border-2 border-industrialDark bg-panel">
          <header className="flex min-h-9 items-center justify-between bg-industrialDark px-3 py-1.5 text-white">
            <h1 className="text-xs font-bold uppercase tracking-[0.14em]">WS3 Overview</h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">PRODUCTION MODULES</span>
          </header>
          <div className="border-b border-line bg-white px-3 py-2">
            <p className="text-xs font-semibold text-industrialDark">Select a process to continue.</p>
            <p className="mt-0.5 text-[10px] uppercase tracking-wide text-slate-500">Only Scouring is available in this release.</p>
          </div>
          <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {processes.map((process) => (
              <div key={process.name} className={`flex min-h-32 flex-col justify-between bg-surfaceMuted p-3 ${process.available ? 'border-t-4 border-industrial' : 'border-t-4 border-slate-300'}`}>
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-mono text-sm font-bold uppercase tracking-wider text-industrialDark">{process.name}</h2>
                    <span className="font-mono text-[9px] font-bold text-slate-500">{process.code}</span>
                  </div>
                  <p className={`mt-2 text-[10px] font-bold uppercase tracking-wider ${process.available ? 'text-success' : 'text-slate-500'}`}>
                    {process.available ? 'AVAILABLE' : 'NOT IMPLEMENTED'}
                  </p>
                </div>
                {process.available ? (
                  <Link to="/machine/scouring" className="mt-3 inline-flex">
                    <HMIButton size="compact" variant="primary">OPEN SCOURING</HMIButton>
                  </Link>
                ) : (
                  <span className="mt-3 border border-line bg-white px-2 py-2 text-center text-[9px] font-semibold uppercase tracking-wide text-slate-500">Coming soon</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </WS3Shell>
  );
}
