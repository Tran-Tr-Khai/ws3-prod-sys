import { useNavigate, useParams } from 'react-router-dom';
import { HMIButton, HMIHeader } from '../../components/hmi';

export function MachineRoutePlaceholder() {
  const navigate = useNavigate();
  const { machineId = '' } = useParams<{ machineId: string }>();

  return (
    <main className="min-h-screen bg-navy text-slate-800">
      <HMIHeader title="WS3 / Machine" subtitle="Machine route placeholder" machineName={machineId} />
      <section className="mx-auto max-w-[1024px] p-3">
        <div className="border border-line bg-white p-6">
          <h1 className="text-xl font-bold text-slate-800">Machine selected: {machineId}</h1>
          <p className="mt-2 text-sm text-slate-500">Machine HMI sẽ được xây dựng ở task riêng.</p>
          <HMIButton className="mt-5" variant="primary" onClick={() => navigate('/machines')}>Back to machines</HMIButton>
        </div>
      </section>
    </main>
  );
}
