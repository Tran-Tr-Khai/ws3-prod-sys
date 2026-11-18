import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import { SupportChatWidget } from '../../features/support/SupportChatWidget';
import './WS3MesShell.css';

type Breadcrumb = { label: string; to: string };

type WS3MesShellProps = {
  module: string;
  breadcrumbs: Breadcrumb[];
  children: ReactNode;
  navigation?: ReactNode;
  showSupportWidget?: boolean;
};

export function WS3MesShell({
  module,
  breadcrumbs,
  children,
  navigation,
  showSupportWidget = true,
}: WS3MesShellProps) {
  const { user, logout } = useAuth();
  const { language, setLanguage } = useLanguage();
  const [currentTime, setCurrentTime] = useState(() =>
    new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false }),
  );

  useEffect(() => {
    const updateTime = () =>
      setCurrentTime(
        new Date().toLocaleTimeString(language === 'vi' ? 'vi-VN' : 'en-GB', { hour12: false }),
      );
    updateTime();
    const timer = window.setInterval(updateTime, 1000);
    return () => window.clearInterval(timer);
  }, [language]);

  return (
    <main className="ws3-mes-shell">
      <header className="ws3-mes-shell__topbar">
        <Link to="/ws3" className="ws3-mes-shell__brand" aria-label="WS3 MES">
          <strong>WS3</strong>
          <span>MES</span>
        </Link>
        <span className="ws3-mes-shell__module">{module}</span>
        <div className="ws3-mes-shell__account">
          <time>{currentTime}</time>
          <span>{user?.username}</span>
          {showSupportWidget && <SupportChatWidget />}
          <button type="button" onClick={() => setLanguage(language === 'vi' ? 'en' : 'vi')}>
            {language.toUpperCase()}
          </button>
          <button type="button" onClick={logout}>
            {language === 'vi' ? 'Đăng xuất' : 'Log out'}
          </button>
        </div>
      </header>
      <div className="ws3-mes-shell__context">
        {breadcrumbs.length > 0 && (
          <nav
            className="ws3-mes-shell__breadcrumb"
            aria-label={language === 'vi' ? 'Điều hướng' : 'Breadcrumb'}
          >
            {breadcrumbs.map((item, index) => (
              <span key={`${item.label}-${index}`} className="ws3-mes-shell__crumb">
                {index > 0 && <i aria-hidden="true">›</i>}
                <Link to={item.to}>{item.label}</Link>
              </span>
            ))}
          </nav>
        )}
        {navigation && <div className="ws3-mes-shell__navigation">{navigation}</div>}
      </div>
      <div className="ws3-mes-shell__main">{children}</div>
    </main>
  );
}
