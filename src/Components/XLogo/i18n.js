import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        app: {
          name: "SoShoLife"
        },
        welcome: "Welcome to {{appName}}"
      }
    },
    hi: {
      translation: {
        app: {
          name: "सोशोलाइफ"
        },
        welcome: "स्वागत आहे {{appName}} मध्ये"
      }
    },
  },
  lng: 'en', // Default language
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  }
});

export default i18n;
