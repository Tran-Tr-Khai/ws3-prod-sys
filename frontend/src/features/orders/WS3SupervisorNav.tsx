import { useNavigate } from 'react-router-dom';
import { HMIButton } from '../../components/hmi/HMIButton';
import { useLanguage } from '../../i18n/LanguageContext';
import { HMINavigation } from '../../components/hmi/HMINavigation';
import { useAuth } from '../../auth/AuthContext';

export function WS3SupervisorNav() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { user } = useAuth();
  const tx = (vi: string, en: string) => language === 'vi' ? vi : en;
  return <div><HMINavigation ariaLabel="WS3 supervisor navigation" context="WS3" tabs={[
    { label: tx('NẠP DỮ LIỆU', 'DATA INTAKE'), to: '/ws3/supervisor/data' },
    { label: tx('XEM ĐƠN', 'PRODUCTION ORDERS'), to: '/ws3/supervisor/orders/new' },
    ...(user?.role === 'ADMIN' ? [{ label: tx('KHO DỮ LIỆU', 'DATA WAREHOUSE'), to: '/ws3/admin/data-warehouse' }] : []),
  ]} trailing={<HMIButton size="compact" onClick={() => navigate('/ws3')}>{tx('TRANG CHỦ', 'HOME')}</HMIButton>} /></div>;
}
