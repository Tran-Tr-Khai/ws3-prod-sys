import { Navigate, Route, Routes } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineHMIPage } from '../features/machines/MachineHMIPage';
import { ScouringHMIPage } from '../features/machines/ScouringHMIPage';
import { ScouringRecordPage } from '../features/machines/ScouringRecordPage';
import { ScouringHistoryPage } from '../features/machines/ScouringHistoryPage';
import { ScouringAlarmPage } from '../features/machines/ScouringAlarmPage';
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
      <Route path="/machine/scouring/record" element={<ScouringRecordPage />} />
      <Route path="/machine/scouring" element={<ScouringHMIPage />} />
      <Route path="/machine/:machineId" element={<MachineHMIPage />} />
      <Route path="*" element={<Navigate to="/ws3" replace />} />
    </Routes>
  );
}
