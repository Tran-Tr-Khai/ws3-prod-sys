import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import './WS3DataFlowNav.css';

export function WS3DataFlowNav() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const tx = (vi: string, en: string) => (language === 'vi' ? vi : en);

  return (
    <nav className="ws3-data-flow-nav" aria-label={tx('Điều hướng WS3', 'WS3 navigation')}>
      <NavLink end to="/ws3">
        {tx('Máy móc', 'Machinery')}
      </NavLink>
      <NavLink end to="/machine/unrolling/record">
        {tx('Đơn Unrolling', 'Unrolling orders')}
      </NavLink>
      <NavLink to="/ws3/supervisor/data">{tx('Nạp dữ liệu', 'Data intake')}</NavLink>
      {user?.role === 'ADMIN' && (
        <NavLink to="/ws3/admin/data-warehouse">{tx('Kho dữ liệu', 'Data warehouse')}</NavLink>
      )}
    </nav>
  );
}
