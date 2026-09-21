import { Navigate, Route, Routes } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineHMIPage } from '../features/machines/MachineHMIPage';
import { ScouringRecordPage } from '../features/machines/ScouringRecordPage';
import { ScouringEntrySelectionPage } from '../features/machines/ScouringEntrySelectionPage';
import { ScouringPhInspectionPage } from '../features/machines/ScouringPhInspectionPage';
import { ScouringHistoryPage } from '../features/machines/ScouringHistoryPage';
import { ScouringAlarmPage } from '../features/machines/ScouringAlarmPage';
import { BuffingPage } from '../features/machines/BuffingPage';
import { ProductionOverviewPage } from '../features/production/ProductionOverviewPage';
import { WS3OverviewPage } from '../features/production/WS3OverviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/ws3" replace />} />
      <Route path="/setup" element={<DesignSystemDemo />} />
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/dashboard" element={<ProductionOverviewPage />} />
      <Route path="/ws3" element={<WS3OverviewPage />} />
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
      <Route path="/machine/:machineId" element={<MachineHMIPage />} />
      <Route path="*" element={<Navigate to="/ws3" replace />} />
    </Routes>
  );
}
