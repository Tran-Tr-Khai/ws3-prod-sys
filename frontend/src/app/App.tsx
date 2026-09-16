import { Navigate, Route, Routes } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineHMIPage } from '../features/machines/MachineHMIPage';
import { ProductionOverviewPage } from '../features/production/ProductionOverviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="/setup" element={<DesignSystemDemo />} />
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/dashboard" element={<ProductionOverviewPage />} />
      <Route path="/machine/:machineId" element={<MachineHMIPage />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}
