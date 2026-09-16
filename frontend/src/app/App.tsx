import { Navigate, Route, Routes } from 'react-router-dom';
import { DesignSystemDemo } from '../components/DesignSystemDemo';
import { MachineListPage } from '../features/machines/MachineListPage';
import { MachineRoutePlaceholder } from '../features/machines/MachineRoutePlaceholder';
import { ProductionOverviewPage } from '../features/production/ProductionOverviewPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/setup" replace />} />
      <Route path="/setup" element={<DesignSystemDemo />} />
      <Route path="/machines" element={<MachineListPage />} />
      <Route path="/dashboard" element={<ProductionOverviewPage />} />
      <Route path="/machine/:machineId" element={<MachineRoutePlaceholder />} />
      <Route path="*" element={<Navigate to="/setup" replace />} />
    </Routes>
  );
}
