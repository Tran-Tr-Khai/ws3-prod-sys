import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { HMIHeader } from '../../components/hmi/HMIHeader';

export function ScouringRecordPage() {
  const navigate = useNavigate();

  return (
    <main className="h-full min-h-0 overflow-hidden bg-navy text-slate-800 flex flex-col">
      <HMIHeader
        variant="machine"
        title="WS3 / Scouring Record"
        subtitle="Operator data entry · Scouring / 정련기 · Batch SC-260917-01 · Operator N. Tran"
        machineName="SC-01"
        status="info"
        time={new Date().toLocaleTimeString('vi-VN')}
      />
      <div className="mx-2 mt-2 flex min-h-0 flex-1 flex-col overflow-hidden border-2 border-industrialDark bg-hmiConsole">
        <section className="m-2 flex min-h-0 flex-1 flex-col border-2 border-line bg-panel">
          <header className="flex min-h-8 items-center justify-between border-b-2 border-industrialDark bg-industrialDark px-2 py-1 text-white">
            <h2 className="text-xs font-bold uppercase tracking-wider">Record entry</h2>
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">PLACEHOLDER</span>
          </header>
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
            <p className="text-sm font-semibold uppercase tracking-wide text-industrial">Scouring operator record entry</p>
            <p className="max-w-lg text-xs leading-5 text-slate-600">
              The dedicated record-entry screen is reserved for the next Scouring MVP step. No input or save behavior has been added in this task.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <HMIButton variant="secondary" onClick={() => navigate('/machine/scouring')}>BACK TO OVERVIEW</HMIButton>
              <HMIButton variant="secondary" onClick={() => navigate('/machine/scouring/history')}>VIEW HISTORY</HMIButton>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
