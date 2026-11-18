import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BuffingPage } from '../features/machines/BuffingPage';
import { BuffingHistoryPage } from '../features/machines/BuffingHistoryPage';
import { TenteringRecordPage } from '../features/machines/TenteringRecordPage';
import { TenteringHistoryPage } from '../features/machines/TenteringHistoryPage';
import { UnrollingOrdersPage } from '../features/orders/UnrollingOrdersPage';
import { WS3OverviewPage } from '../features/production/WS3OverviewPage';
import { LoginPage } from '../features/auth/LoginPage';
import { WS3DataSnapshotPage } from '../features/orders/WS3DataSnapshotPage';
import { WS3DataWarehousePage } from '../features/orders/WS3DataWarehousePage';
import { useAuth } from '../auth/useAuth';

export default function App() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <main className="flex min-h-screen items-center justify-center bg-navy text-xs font-bold uppercase text-white">
        Loading...
      </main>
    );
  if (!user)
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  const tenteringMachine = location.pathname.match(/^\/machine\/(TE-01|TE-02)\/(record|history)$/i);
  const restrictedMachine = location.pathname.startsWith('/machine/buffing')
    ? 'BU-01'
    : (tenteringMachine?.[1].toUpperCase() ?? null);
  if (
    location.pathname.startsWith('/machine/unrolling') &&
    !['ADMIN', 'SUPERVISOR', 'PRODUCTION_MANAGER'].includes(user.role)
  )
    return <Navigate to="/ws3" replace />;
  if (user.role === 'OPERATOR' && restrictedMachine && !user.machineIds.includes(restrictedMachine))
    return <Navigate to="/ws3" replace />;
  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/ws3" replace />} />
      <Route path="/" element={<Navigate to="/ws3" replace />} />
      <Route path="/ws3" element={<WS3OverviewPage />} />
      <Route path="/ws3/supervisor/data" element={<WS3DataSnapshotPage />} />
      <Route
        path="/ws3/supervisor/orders/new"
        element={<Navigate to="/machine/unrolling/record" replace />}
      />
      <Route
        path="/ws3/admin/data-warehouse"
        element={user.role === 'ADMIN' ? <WS3DataWarehousePage /> : <Navigate to="/ws3" replace />}
      />
      <Route path="/supervisor/data" element={<Navigate to="/ws3/supervisor/data" replace />} />
      <Route
        path="/supervisor/orders/new"
        element={<Navigate to="/machine/unrolling/record" replace />}
      />
      <Route path="/machine/buffing/record" element={<BuffingPage />} />
      <Route
        path="/machine/buffing/history"
        element={
          user.role === 'OPERATOR' ? (
            <Navigate to="/machine/buffing/record" replace />
          ) : (
            <BuffingHistoryPage />
          )
        }
      />
      <Route path="/machine/buffing" element={<BuffingPage />} />
      <Route
        path="/machine/tenter/record"
        element={<Navigate to="/machine/TE-01/record" replace />}
      />
      <Route
        path="/machine/TE-01/record"
        element={<TenteringRecordPage key="TE-01" machineId="TE-01" />}
      />
      <Route
        path="/machine/TE-02/record"
        element={<TenteringRecordPage key="TE-02" machineId="TE-02" />}
      />
      <Route
        path="/machine/TE-01/history"
        element={
          user.role === 'OPERATOR' ? (
            <Navigate to="/machine/TE-01/record" replace />
          ) : (
            <TenteringHistoryPage key="TE-01" machineId="TE-01" />
          )
        }
      />
      <Route
        path="/machine/TE-02/history"
        element={
          user.role === 'OPERATOR' ? (
            <Navigate to="/machine/TE-02/record" replace />
          ) : (
            <TenteringHistoryPage key="TE-02" machineId="TE-02" />
          )
        }
      />
      <Route path="/machine/tenter" element={<Navigate to="/machine/tenter/record" replace />} />
      <Route path="/machine/unrolling/record" element={<UnrollingOrdersPage />} />
      <Route
        path="/machine/unrolling"
        element={<Navigate to="/machine/unrolling/record" replace />}
      />
      <Route path="*" element={<Navigate to="/ws3" replace />} />
    </Routes>
  );
}
