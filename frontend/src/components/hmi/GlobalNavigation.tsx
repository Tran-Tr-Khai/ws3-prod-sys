import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useLanguage } from '../../i18n/LanguageContext';

const LANGUAGE_SWITCHER_HIDDEN_KEY = 'ws3.language-switcher-hidden';

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
  const [hidden, setHidden] = useState(() => typeof window !== 'undefined' && window.localStorage.getItem(LANGUAGE_SWITCHER_HIDDEN_KEY) === 'true');
  if (hidden) return <button type="button" aria-label="Show language selector" className="fixed bottom-3 left-0 z-50 min-h-8 border-2 border-l-0 border-industrialDark bg-industrial px-2 text-[9px] font-bold text-white shadow" onClick={() => { setHidden(false); window.localStorage.removeItem(LANGUAGE_SWITCHER_HIDDEN_KEY); }}>{language.toUpperCase()}</button>;
  return <div className="fixed bottom-3 left-3 z-50 flex min-h-8 border-2 border-line bg-white p-0.5 shadow" aria-label="Language selector"><button type="button" aria-label="Hide language selector" className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full border border-industrialDark bg-white text-xs font-bold text-industrialDark shadow" onClick={() => { setHidden(true); window.localStorage.setItem(LANGUAGE_SWITCHER_HIDDEN_KEY, 'true'); }}>×</button><button type="button" onClick={() => setLanguage('vi')} className={`min-w-8 px-1 text-[9px] font-bold ${language === 'vi' ? 'bg-industrialDark text-white' : 'text-industrialDark'}`}>VI</button><button type="button" onClick={() => setLanguage('en')} className={`min-w-8 px-1 text-[9px] font-bold ${language === 'en' ? 'bg-industrialDark text-white' : 'text-industrialDark'}`}>EN</button></div>;
}
