// src/i18n/i18nContext.js
// UPDATED: Added all missing locale imports and expanded language support

import React, { createContext, useContext, useState, useEffect, useMemo } from "react";

// Translation files
import en from './locales/en.json';
import hi from './locales/hi.json';
import ta from './locales/ta.json';
import bn from './locales/bn.json';
import mr from './locales/mr.json';
import pa from './locales/pa.json';
import gu from './locales/gu.json';
import te from './locales/te.json';
import kn from './locales/kn.json';
import ml from './locales/ml.json';

// Language metadata
export const LANGUAGES = [
    { code: "en", label: "English",    flag: "🇬🇧", rtl: false },
    { code: "hi", label: "हिन्दी",      flag: "🇮🇳", rtl: false },
    { code: "mr", label: "मराठी",      flag: "🇮🇳", rtl: false },
    { code: "kn", label: "ಕನ್ನಡ",      flag: "🇮🇳", rtl: false },
    { code: "ta", label: "தமிழ்",      flag: "🇮🇳", rtl: false },
    { code: "ml", label: "മലയാളം",    flag: "🇮🇳", rtl: false },
    { code: "bn", label: "বাংলা",      flag: "🇮🇳", rtl: false },
    { code: "gu", label: "ગુજરાતી",   flag: "🇮🇳", rtl: false },
    { code: "pa", label: "ਪੰਜਾਬੀ",    flag: "🇮🇳", rtl: false },
    { code: "te", label: "తెలుగు",    flag: "🇮🇳", rtl: false },
    { code: "ja", label: "日本語",     flag: "🇯🇵", rtl: false },
    { code: "zh", label: "中文",       flag: "🇨🇳", rtl: false },
    { code: "ar", label: "العربية",   flag: "🇸🇦", rtl: true  },
    { code: "fr", label: "Français",  flag: "🇫🇷", rtl: false },
    { code: "de", label: "Deutsch",   flag: "🇩🇪", rtl: false },
    { code: "es", label: "Español",   flag: "🇪🇸", rtl: false },
];

// Translation registry
const TRANSLATIONS = { en, hi, mr, kn, ta, ml, bn, gu, pa, te };

const I18nContext = createContext();

/**
 * Recursively flatten a nested object into dot-notation keys.
 * e.g. { nav: { home: "Home" } }  →  { "nav.home": "Home" }
 */
function flattenDict(obj, prefix = "", result = {}) {
    for (const key of Object.keys(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        const val = obj[key];
        if (val !== null && typeof val === "object" && !Array.isArray(val)) {
            flattenDict(val, fullKey, result);
        } else {
            result[fullKey] = val;
        }
    }
    return result;
}

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
        // Also set lang attribute for accessibility
        document.documentElement.lang = lang;
    }, [lang]);

    const t = useMemo(() => {
        const rawDict  = TRANSLATIONS[lang] || TRANSLATIONS.en;
        const fallback = TRANSLATIONS.en;

        // Flat maps for dot-path lookup (e.g. "nav.home")
        const flatDict     = flattenDict(rawDict);
        const flatFallback = flattenDict(fallback);

        /**
         * translate(key, vars?)
         *
         * Supports both dot-path keys ("nav.home") and legacy flat keys ("welcome").
         * Falls back to English, then to the key itself.
         *
         * @param {string} key
         * @param {object} [vars] - interpolation variables, e.g. { name: "Alice" }
         * @returns {string}
         */
        const translate = (key, vars = {}) => {
            let str = flatDict[key] ?? flatFallback[key] ?? key;

            Object.keys(vars).forEach(k => {
                str = str.replace(new RegExp(`{${k}}`, "g"), String(vars[k]));
            });

            return str;
        };

        // Also expose the raw nested dict so components can do t.nav?.home
        // AND the flat map so components can do t["nav.home"]
        return {
            ...rawDict,    // nested access:   t.nav?.home
            ...flatDict,   // dot-path access: t["nav.home"]
            format: translate,  // interpolation:  t.format("nav.home", { name: "X" })
        };
    }, [lang]);

    const value = {
        lang,
        setLang,
        t,
        LANGUAGES,
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
 *
 * // Nested object access (works because rawDict is spread):
 * t.nav?.home               // "Home"
 *
 * // Dot-path string access (works because flatDict is spread):
 * t["nav.home"]             // "Home"
 *
 * // Interpolation helper:
 * t.format("nav.home")      // "Home"
 * t.format("auth.greeting", { name: "Alice" })
 */
export const useI18n = () => {
    const ctx = useContext(I18nContext);
    if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
    return ctx;
};