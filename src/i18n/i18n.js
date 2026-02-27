import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import translationEN from './locales/en.json';
import translationHI from './locales/hi.json';
import translationTA from './locales/ta.json';
import translationBN from './locales/bn.json';
import translationMR from './locales/mr.json';

const resources = {
  en: { translation: translationEN },
  hi: { translation: translationHI },
  ta: { translation: translationTA },
  bn: { translation: translationBN },
  mr: { translation: translationMR },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
