import { createContext } from 'react';
import type { Language, TranslationKey } from './LanguageContext';

export type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: TranslationKey) => string;
};

/** Internal i18n context store. UI modules should consume useLanguage instead. */
export const LanguageContext = createContext<LanguageContextValue | null>(null);
