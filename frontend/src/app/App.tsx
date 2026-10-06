import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineHMIPage } from '../features/machines/MachineHMIPage';
import { ScouringRecordPage } from '../features/machines/ScouringRecordPage';
import { ScouringHistoryPage } from '../features/machines/ScouringHistoryPage';
import { ScouringAlarmPage } from '../features/machines/ScouringAlarmPage';
import { BuffingPage } from '../features/machines/BuffingPage';
import { BuffingHistoryPage } from '../features/machines/BuffingHistoryPage';
import { MachineOperationEntryPage } from '../features/machines/MachineOperationEntryPage';
import { UnrollingOrdersPage } from '../features/orders/UnrollingOrdersPage';
import { ProductionOverviewPage } from '../features/production/ProductionOverviewPage';
import { WS3OverviewPage } from '../features/production/WS3OverviewPage';
import { LoginPage } from '../features/auth/LoginPage';
import { WS3DataSnapshotHmiPage } from '../features/orders/WS3DataSnapshotHmiPage';
import { WS3DataWarehousePage } from '../features/orders/WS3DataWarehousePage';
import { useAuth } from '../auth/AuthContext';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-navy text-xs font-bold uppercase text-white">Loading...</main>;
  if (!user) return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  const genericRecordMachine = location.pathname.match(/^\/machine\/([^/]+)\/record$/)?.[1]?.toUpperCase() ?? null;
  const restrictedMachine = location.pathname.startsWith('/machine/scouring') ? 'SC-01' : location.pathname.startsWith('/machine/buffing') ? 'BU-01' : genericRecordMachine;
  if (location.pathname.startsWith('/machine/unrolling') && !['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role)) return <Navigate to="/ws3" replace />;
  if (user.role === 'OPERATOR' && restrictedMachine && !user.machineIds.includes(restrictedMachine)) return <Navigate to="/ws3" replace />;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/ws3" replace />} />
      <Route path="/" element={<Navigate to="/ws3" replace />} />
      <Route path="/setup" element={<DesignSystemDemo />} />
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/dashboard" element={<ProductionOverviewPage />} />
      <Route path="/ws3" element={<WS3OverviewPage />} />
      <Route path="/ws3/supervisor/data" element={<WS3DataSnapshotHmiPage />} />
      <Route path="/ws3/supervisor/orders/new" element={<Navigate to="/machine/unrolling/record" replace />} />
      <Route path="/ws3/admin/data-warehouse" element={user.role === 'ADMIN' ? <WS3DataWarehousePage /> : <Navigate to="/ws3" replace />} />
      <Route path="/supervisor/data" element={<Navigate to="/ws3/supervisor/data" replace />} />
      <Route path="/supervisor/orders/new" element={<Navigate to="/machine/unrolling/record" replace />} />
      <Route path="/machine/scouring/alarm" element={<ScouringAlarmPage />} />
      <Route path="/machine/scouring/history" element={user.role === 'OPERATOR' ? <Navigate to="/machine/scouring/record/operation" replace /> : <ScouringHistoryPage />} />
      <Route path="/machine/scouring/record/operation" element={<ScouringRecordPage />} />
      <Route path="/machine/scouring/record/inspection" element={<Navigate to="/machine/scouring/record/operation?tab=ph" replace />} />
      <Route path="/machine/scouring/record" element={<Navigate to="/machine/scouring/record/operation" replace />} />
      {/* Scouring report is kept in the code but hidden until it is ready. */}
      <Route path="/machine/scouring" element={<Navigate to="/ws3" replace />} />
      <Route path="/machine/buffing/record" element={<BuffingPage />} />
      <Route path="/machine/buffing/history" element={user.role === 'OPERATOR' ? <Navigate to="/machine/buffing/record" replace /> : <BuffingHistoryPage />} />
      <Route path="/machine/buffing" element={<BuffingPage />} />
      <Route path="/machine/tenter/record" element={<Navigate to="/machine/TE-01/record" replace />} />
      <Route path="/machine/:machineId/record" element={<MachineOperationEntryPage />} />
      <Route path="/machine/tenter" element={<Navigate to="/machine/tenter/record" replace />} />
      <Route path="/machine/unrolling/record" element={<UnrollingOrdersPage />} />
      <Route path="/machine/unrolling" element={<Navigate to="/machine/unrolling/record" replace />} />
      <Route path="/machine/:machineId" element={<MachineHMIPage />} />
      <Route path="*" element={<Navigate to="/ws3" replace />} />
    </Routes>
  );
}
