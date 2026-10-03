import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineHMIPage } from '../features/machines/MachineHMIPage';
import { ScouringRecordPage } from '../features/machines/ScouringRecordPage';
import { ScouringEntrySelectionPage } from '../features/machines/ScouringEntrySelectionPage';
import { ScouringPhInspectionPage } from '../features/machines/ScouringPhInspectionPage';
import { ScouringHistoryPage } from '../features/machines/ScouringHistoryPage';
import { ScouringAlarmPage } from '../features/machines/ScouringAlarmPage';
import { BuffingPage } from '../features/machines/BuffingPage';
import { TenterPage } from '../features/machines/TenterPage';
import { UnrollingCollectionPage } from '../features/machines/UnrollingCollectionPage';
import { ProductionOverviewPage } from '../features/production/ProductionOverviewPage';
import { WS3OverviewPage } from '../features/production/WS3OverviewPage';
import { LoginPage } from '../features/auth/LoginPage';
import { WS3DataSnapshotHmiPage } from '../features/orders/WS3DataSnapshotHmiPage';
import { WS3ProductionOrdersPage } from '../features/orders/WS3ProductionOrdersPage';
import { WS3DataWarehousePage } from '../features/orders/WS3DataWarehousePage';
import { useAuth } from '../auth/AuthContext';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-navy text-xs font-bold uppercase text-white">Loading...</main>;
  if (!user) return <Routes><Route path="/login" element={<LoginPage />} /><Route path="*" element={<Navigate to="/login" replace />} /></Routes>;
  const restrictedMachine = location.pathname.startsWith('/machine/scouring') ? 'SC-01' : location.pathname.startsWith('/machine/buffing') ? 'BU-01' : location.pathname.startsWith('/machine/tenter') ? 'TE-01' : location.pathname.startsWith('/machine/unrolling') ? 'UN-01' : null;
  if (user.role === 'OPERATOR' && restrictedMachine && !(restrictedMachine === 'UN-01'
    ? user.machineIds.some((machineId) => machineId.trim().toUpperCase().startsWith('UN-'))
    : user.machineIds.includes(restrictedMachine))) return <Navigate to="/ws3" replace />;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/ws3" replace />} />
      <Route path="/" element={<Navigate to="/ws3" replace />} />
      <Route path="/setup" element={<DesignSystemDemo />} />
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/dashboard" element={<ProductionOverviewPage />} />
      <Route path="/ws3" element={<WS3OverviewPage />} />
      <Route path="/ws3/supervisor/data" element={<WS3DataSnapshotHmiPage />} />
      <Route path="/ws3/supervisor/orders/new" element={<WS3ProductionOrdersPage />} />
      <Route path="/ws3/admin/data-warehouse" element={user.role === 'ADMIN' ? <WS3DataWarehousePage /> : <Navigate to="/ws3" replace />} />
      <Route path="/supervisor/data" element={<Navigate to="/ws3/supervisor/data" replace />} />
      <Route path="/supervisor/orders/new" element={<Navigate to="/ws3/supervisor/orders/new" replace />} />
      <Route path="/machine/scouring/alarm" element={<ScouringAlarmPage />} />
      <Route path="/machine/scouring/history" element={<ScouringHistoryPage />} />
      <Route path="/machine/scouring/record/operation" element={<ScouringRecordPage />} />
      <Route path="/machine/scouring/record/inspection" element={<ScouringPhInspectionPage />} />
      <Route path="/machine/scouring/record" element={<ScouringEntrySelectionPage />} />
      {/* Scouring report is kept in the code but hidden until it is ready. */}
      <Route path="/machine/scouring" element={<Navigate to="/machine/scouring/record" replace />} />
      <Route path="/machine/buffing/record" element={<BuffingPage />} />
      <Route path="/machine/buffing/history" element={<BuffingPage />} />
      <Route path="/machine/buffing" element={<BuffingPage />} />
      <Route path="/machine/tenter/record" element={<TenterPage />} />
      <Route path="/machine/tenter" element={<Navigate to="/machine/tenter/record" replace />} />
      <Route path="/machine/unrolling/record" element={<UnrollingCollectionPage />} />
      <Route path="/machine/unrolling" element={<Navigate to="/machine/unrolling/record" replace />} />
      <Route path="/machine/:machineId" element={<MachineHMIPage />} />
      <Route path="*" element={<Navigate to="/ws3" replace />} />
    </Routes>
  );
}
