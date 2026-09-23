import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';

export function GlobalNavigation() {
  const { t } = useLanguage();
  return (
    <nav aria-label="Global navigation" className="flex shrink-0 items-center border-l border-line bg-hmiSection px-2 py-1 max-[640px]:px-1">
      <NavLink
        to="/ws3"
        className={({ isActive }) => `inline-flex min-h-8 items-center border-2 px-3 text-[10px] font-bold uppercase tracking-[0.12em] transition-colors max-[640px]:min-h-7 max-[640px]:px-2 max-[640px]:text-[9px] ${isActive ? 'border-industrialDark bg-industrialDark text-white' : 'border-line bg-white text-industrialDark hover:border-industrialDark hover:bg-hmiHover'}`}
      >
        {t('home')}
      </NavLink>
    </nav>
  );
}

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'vi' ? 'en' : 'vi';
  return <button type="button" aria-label={`Switch language to ${nextLanguage.toUpperCase()}`} title={`Switch to ${nextLanguage.toUpperCase()}`} className="fixed bottom-3 left-3 z-50 inline-flex min-h-8 items-center border-2 border-line bg-white px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-industrialDark transition-colors hover:border-industrialDark hover:bg-hmiHover" onClick={() => setLanguage(nextLanguage)}>{language.toUpperCase()}</button>;
}
