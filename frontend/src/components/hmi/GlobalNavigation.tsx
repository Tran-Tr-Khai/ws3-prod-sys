import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';
type GlobalNavigationProps = { embedded?: boolean };

export function GlobalNavigation({ embedded = false }: GlobalNavigationProps) {
  const { t } = useLanguage();
  return (
    <nav aria-label="Global navigation" className={`flex shrink-0 items-center ${embedded ? '' : 'border-l border-line'} bg-hmiSection px-2 py-1 max-[640px]:px-1`}>
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
  return <button type="button" aria-label={`Switch language to ${nextLanguage.toUpperCase()}`} title={`Switch to ${nextLanguage.toUpperCase()}`} className="inline-flex min-h-7 items-center border border-white/40 px-2 text-[9px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 max-[640px]:min-h-6 max-[640px]:px-1.5 max-[640px]:text-[8px]" onClick={() => setLanguage(nextLanguage)}>{language.toUpperCase()}</button>;
}
