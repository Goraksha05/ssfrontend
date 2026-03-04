/**
 * ThemeContext.js
 *
 * Provides a dark / light mode system for the entire app.
 *
 * Usage
 * ─────
 * 1. Wrap your app with <ThemeProvider> (already wired into App.js).
 * 2. Consume in any component:
 *      import { useTheme } from '../../Context/Theme/ThemeContext';
 *      const { theme, isDark, toggleTheme, setTheme, tokens } = useTheme();
 *
 * Design tokens
 * ─────────────
 * `tokens` is a flat object of CSS-ready colour / spacing values that match
 * the existing dark palette used in HomePosts / HomePostitem, plus a clean
 * light equivalent.  Use them directly in inline styles or pass them as CSS
 * custom properties via the <body> tag (ThemeProvider does this automatically).
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ─── Design token palettes ────────────────────────────────────────────────────

const DARK_TOKENS = {
  // Backgrounds
  bgPage:          '#0d1117',
  bgCard:          '#1a2035',
  bgCardAlt:       '#141929',
  bgInput:         '#0d1117',
  bgHover:         '#1e2840',
  bgSkeleton:      '#252d45',

  // Borders
  border:          '#252d45',
  borderSubtle:    'rgba(0,180,255,0.15)',

  // Text
  textPrimary:     '#e2f3ff',
  textSecondary:   '#94a3b8',
  textMuted:       '#64748b',
  textInverse:     '#0d1117',

  // Brand / accent
  accent:          '#0ea5e9',
  accentAlt:       '#6366f1',
  accentGradient:  'linear-gradient(135deg, #0ea5e9, #6366f1)',

  // Navbar
  navBg:           'linear-gradient(135deg,#0f1e35,#0a1628)',
  navText:         '#e2f3ff',

  // Status
  danger:          '#ef4444',
  success:         '#22c55e',
  warning:         '#f59e0b',

  // Misc
  shadow:          '0 4px 24px rgba(0,0,0,0.5)',
  radius:          '14px',
  radiusSm:        '8px',
};

const LIGHT_TOKENS = {
  // Backgrounds
  bgPage:          '#f0f4ff',
  bgCard:          '#ffffff',
  bgCardAlt:       '#f8f9ff',
  bgInput:         '#f8f9ff',
  bgHover:         '#eef0ff',
  bgSkeleton:      '#e2e8f0',

  // Borders
  border:          '#e0e4ff',
  borderSubtle:    'rgba(99,102,241,0.15)',

  // Text
  textPrimary:     '#1a1d3a',
  textSecondary:   '#475569',
  textMuted:       '#94a3b8',
  textInverse:     '#ffffff',

  // Brand / accent
  accent:          '#3b4fd8',
  accentAlt:       '#6366f1',
  accentGradient:  'linear-gradient(135deg, #3b4fd8, #6366f1)',

  // Navbar
  navBg:           'linear-gradient(135deg,#3b4fd8,#6366f1)',
  navText:         '#ffffff',

  // Status
  danger:          '#dc2626',
  success:         '#16a34a',
  warning:         '#d97706',

  // Misc
  shadow:          '0 4px 24px rgba(80,80,160,0.12)',
  radius:          '14px',
  radiusSm:        '8px',
};

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  // Initialise from localStorage, else respect OS preference
  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem('appTheme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const [theme, setThemeState] = useState(getInitialTheme);

  const isDark = theme === 'dark';
  const tokens = isDark ? DARK_TOKENS : LIGHT_TOKENS;

  /** Apply CSS custom properties to <body> so plain CSS / Bootstrap can use them too */
  const applyCSSVars = useCallback((t) => {
    const tok = t === 'dark' ? DARK_TOKENS : LIGHT_TOKENS;
    const root = document.documentElement;
    Object.entries(tok).forEach(([key, val]) => {
      // camelCase → --kebab-case  e.g. bgPage → --bg-page
      const cssVar = '--' + key.replace(/([A-Z])/g, '-$1').toLowerCase();
      root.style.setProperty(cssVar, val);
    });
    // Convenience class on <body>
    document.body.classList.toggle('theme-dark', t === 'dark');
    document.body.classList.toggle('theme-light', t === 'light');
  }, []);

  // Apply on mount + whenever theme changes
  useEffect(() => {
    applyCSSVars(theme);
    try { localStorage.setItem('appTheme', theme); } catch (_) {}
  }, [theme, applyCSSVars]);

  const setTheme = useCallback((t) => {
    if (t === 'dark' || t === 'light') setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const value = { theme, isDark, toggleTheme, setTheme, tokens };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export default ThemeContext;