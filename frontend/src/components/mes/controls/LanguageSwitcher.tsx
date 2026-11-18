import { useLanguage } from '../../../i18n/useLanguage';

/** Switch the application language without leaving the current MES workspace. */
export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();
  const nextLanguage = language === 'vi' ? 'en' : 'vi';

  return (
    <button
      type="button"
      aria-label={`Switch language to ${nextLanguage.toUpperCase()}`}
      title={`Switch to ${nextLanguage.toUpperCase()}`}
      className="inline-flex min-h-7 items-center border border-white/40 px-2 text-[9px] font-bold uppercase tracking-wide text-white transition-colors hover:bg-white/10 max-[640px]:min-h-6 max-[640px]:px-1.5 max-[640px]:text-[8px]"
      onClick={() => setLanguage(nextLanguage)}
    >
      {language.toUpperCase()}
    </button>
  );
}
