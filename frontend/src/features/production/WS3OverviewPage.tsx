import { Link } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';

export function WS3OverviewPage() {
  return (
    <main className="flex min-h-screen flex-col overflow-hidden bg-navy text-slate-800">
      <HMIHeader
        variant="machine"
        title="WS3 Production System"
        subtitle="Select a production module"
        status="info"
        time={new Date().toLocaleTimeString('vi-VN')}
      />
      <div className="min-h-0 flex-1 bg-hmiConsole p-2">
        <section className="border-2 border-industrialDark bg-panel">
          <header className="flex min-h-8 items-center justify-between bg-industrialDark px-2 py-1 text-white">
            <h1 className="text-xs font-bold uppercase tracking-wider">WS3 Overview</h1>
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">PRODUCTION MODULES</span>
          </header>
          <div className="bg-surfaceMuted p-3">
            <div className="max-w-sm border border-line bg-white p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Available module</p>
              <p className="mt-1 font-mono text-lg font-bold uppercase tracking-wider text-industrialDark">SC-01 / SCOURING</p>
              <p className="mt-1 text-xs text-slate-600">Recorded production data and operator entry.</p>
              <Link to="/machine/scouring" className="mt-3 inline-flex">
                <HMIButton size="large" variant="primary">OPEN SCOURING</HMIButton>
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
