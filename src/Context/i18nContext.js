// src/Context/i18nContext.js

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

// Translation files
import en from '../i18n/locales/en.json';
import hi from '../i18n/locales/hi.json';
import ta from '../i18n/locales/ta.json';
import bn from '../i18n/locales/bn.json';
import mr from '../i18n/locales/mr.json';
import pa from '../i18n/locales/pa.json'; // Punjabi
import gu from '../i18n/locales/gu.json'; // Gujarati
import te from '../i18n/locales/te.json'; // Telugu
import kn from '../i18n/locales/kn.json'; // Kannada
import ml from '../i18n/locales/ml.json'; // Malayalam

// Language metadata
export const LANGUAGES = [
    { code: "en", label: "English", flag: "🇬🇧", rtl: false },
    { code: "hi", label: "हिन्दी", flag: "🇮🇳", rtl: false },
    { code: "mr", label: "मराठी", flag: "🇮🇳", rtl: false },
    { code: "kn", label: "ಕನ್ನಡ", flag: "🇮🇳", rtl: false },
    { code: "ta", label: "தமிழ்", flag: "🇮🇳", rtl: false },
    { code: "ml", label: "മലയാളം", flag: "🇮🇳", rtl: false },
    { code: "bn", label: "বাংলা", flag: "🇮🇳", rtl: false }, // Bengali
    { code: "gu", label: "ગુજરાતી", flag: "🇮🇳", rtl: false }, // Gujarati
    { code: "pa", label: "ਪੰਜਾਬੀ", flag: "🇮🇳", rtl: false }, // Punjabi
    { code: "te", label: "తెలుగు", flag: "🇮🇳", rtl: false }, // Telugu
    { code: "ja", label: "日本語", flag: "🇯🇵", rtl: false },
    { code: "zh", label: "中文", flag: "🇨🇳", rtl: false },
    { code: "ar", label: "العربية", flag: "🇸🇦", rtl: true },
    { code: "fr", label: "Français", flag: "🇫🇷", rtl: false },
    { code: "de", label: "Deutsch", flag: "🇩🇪", rtl: false },
    { code: "es", label: "Español", flag: "🇪🇸", rtl: false },
];

// Translation registry
const TRANSLATIONS = { en, hi, mr, kn, ta, ml, bn, gu, pa, te, 
    // ja, zh, ar, fr, de, es, 
};

const I18nContext = createContext();

export const I18nProvider = ({ children }) => {

    // Language — persisted to localStorage
    const [lang, setLang] = useState(() =>
        localStorage.getItem("appLang") || "en"
    );

    // Persist language selection
    useEffect(() => {
        localStorage.setItem("appLang", lang);
    }, [lang]);

    // RTL handling — update <html dir> whenever language changes
    useEffect(() => {
        const current = LANGUAGES.find(l => l.code === lang);
        document.documentElement.dir = current?.rtl ? "rtl" : "ltr";
    }, [lang]);

    // Translation function
    const t = useMemo(() => {
        const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;

        /**
         * translate(key, vars)
         * @param {string} key  - Translation key
         * @param {object} vars - Optional interpolation variables, e.g. { name: "Alice" }
         * @returns {string}
         */
        const translate = (key, vars = {}) => {
            let str = dict[key] ?? key;

            Object.keys(vars).forEach(k => {
                str = str.replace(new RegExp(`{${k}}`, "g"), vars[k]);
            });

            return str;
        };

        return {
            ...dict,       // direct key access:  t.welcomeMessage
            format: translate, // interpolation:  t.format("greeting", { name: "Alice" })
        };
    }, [lang]);

    const value = {
        lang,       // current language code, e.g. "en"
        setLang,    // (code: string) => void
        t,          // translation object with .format() helper
        LANGUAGES,  // full language list for building a language switcher UI
    };

    return (
        <I18nContext.Provider value={value}>
            {children}
        </I18nContext.Provider>
    );
};

/**
 * useI18n — consume i18n context anywhere inside <I18nProvider>
 *
 * @example
 * const { lang, setLang, t } = useI18n();
 * return <h1>{t.welcomeMessage}</h1>;
 */
export const useI18n = () => {
    const ctx = useContext(I18nContext);

    if (!ctx) {
        throw new Error("useI18n must be used inside <I18nProvider>");
    }

    return ctx;
};