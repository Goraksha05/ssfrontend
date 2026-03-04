import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en.json';
import translationHI from './locales/hi.json';
import translationTA from './locales/ta.json';
import translationBN from './locales/bn.json';
import translationMR from './locales/mr.json';
import translationPA from './locales/pa.json'; // Punjabi
import translationGU from './locales/gu.json'; // Gujarati
import translationTE from './locales/te.json'; // Telugu
import translationKN from './locales/kn.json'; // Kannada
import translationML from './locales/ml.json'; // Malayalam

const resources = {
  en: { translation: translationEN },
  hi: { translation: translationHI },
  ta: { translation: translationTA },
  bn: { translation: translationBN },
  mr: { translation: translationMR },
  pa: { translation: translationPA },
  gu: { translation: translationGU },
  te: { translation: translationTE },
  kn: { translation: translationKN },
  ml: { translation: translationML },
};

/**
 * Supported languages metadata — import this wherever you render a language picker.
 * e.g. in Navbartemp.js:
 *   import { SUPPORTED_LANGUAGES } from '../../i18n/i18n';
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English',    nativeLabel: 'English'    },
  { code: 'hi', label: 'Hindi',      nativeLabel: 'हिन्दी'      },
  { code: 'mr', label: 'Marathi',    nativeLabel: 'मराठी'       },
  { code: 'bn', label: 'Bengali',    nativeLabel: 'বাংলা'       },
  { code: 'ta', label: 'Tamil',      nativeLabel: 'தமிழ்'       },
  { code: 'te', label: 'Telugu',     nativeLabel: 'తెలుగు'      },
  { code: 'pa', label: 'Punjabi',    nativeLabel: 'ਪੰਜਾਬੀ'      },
  { code: 'gu', label: 'Gujarati',   nativeLabel: 'ગુજરાતી'     },
  { code: 'kn', label: 'Kannada',    nativeLabel: 'ಕನ್ನಡ'       },
  { code: 'ml', label: 'Malayalam',  nativeLabel: 'മലയാളം'      },
];

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES.map(l => l.code),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Persist language choice in localStorage under key 'i18nLang'
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: 'i18nLang',
      caches: ['localStorage'],
    },
  });

export default i18n;