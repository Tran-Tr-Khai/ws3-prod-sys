import { useContext } from 'react';
import { LanguageContext } from './languageContextStore';

/** Access the active language and the translated label lookup function. */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider');
  return context;
}
