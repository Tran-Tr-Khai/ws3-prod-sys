import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';

export function GlobalNavigation() {
  const { t } = useLanguage();
  return (
    <nav aria-label="Global navigation" className="flex shrink-0 items-center border-l border-line bg-hmiSection px-2 py-1">
      <NavLink
        to="/ws3"
        className={({ isActive }) => `inline-flex min-h-8 items-center border-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${isActive ? 'border-industrialDark bg-industrialDark text-white' : 'border-line bg-white text-industrialDark hover:border-industrialDark hover:bg-hmiHover'}`}
      >
        {t('home')}
      </NavLink>
    </nav>
  );
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  return <div className="flex min-h-8 border-2 border-line bg-white p-0.5" aria-label="Language selector"><button type="button" onClick={() => setLanguage('vi')} className={`min-w-8 px-1 text-[9px] font-bold ${language === 'vi' ? 'bg-industrialDark text-white' : 'text-industrialDark'}`}>VI</button><button type="button" onClick={() => setLanguage('en')} className={`min-w-8 px-1 text-[9px] font-bold ${language === 'en' ? 'bg-industrialDark text-white' : 'text-industrialDark'}`}>EN</button></div>;
}
