/**
 * ThemeContext.js — SoShoLife Multi-Palette Theme System
 *
 * Provides dark / light mode + multiple named color palettes for the entire app.
 *
 * Usage
 * ─────
 * 1. Wrap your app with <ThemeProvider> (already wired into App.js).
 * 2. Consume in any component:
 *      import { useTheme } from '../../Context/Theme/ThemeContext';
 *      const { theme, isDark, toggleTheme, setTheme, tokens, palette, setPalette, PALETTES } = useTheme();
 *
 * Palettes
 * ────────
 * Each palette has a `dark` and `light` variant.
 * palette name options: 'ocean' | 'sunset' | 'forest' | 'royal' | 'rose' | 'midnight'
 *
 * Design tokens
 * ─────────────
 * `tokens` is a flat object of CSS-ready colour / spacing values.
 * ThemeProvider writes them as CSS custom properties to <html>.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { PALETTES } from '../../Components/Theme/ThemeStructure/Palettes';
// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem('appTheme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    // return 'dark';
  };

  const getInitialPalette = () => {
    try {
      const stored = localStorage.getItem('appPalette');
      if (stored && PALETTES[stored]) return stored;
    } catch (_) {}
    return 'ocean';
  };

  const [theme, setThemeState] = useState(getInitialTheme);
  const [palette, setPaletteState] = useState(getInitialPalette);

  const isDark = theme === 'dark';
  const tokens = PALETTES[palette]?.[theme] ?? PALETTES.ocean[theme];

  /** Apply CSS custom properties to <html> */
  const applyCSSVars = useCallback((t, p) => {
    const pal = PALETTES[p] ?? PALETTES.ocean;
    const tok = pal[t] ?? pal.dark;
    const root = document.documentElement;

    // Write all tokens as CSS variables
    const varMap = {
      '--bg-page':          tok.bgPage,
      '--bg-card':          tok.bgCard,
      '--bg-card-alt':      tok.bgCardAlt,
      '--bg-input':         tok.bgInput,
      '--bg-hover':         tok.bgHover,
      '--bg-skeleton':      tok.bgSkeleton,
      '--bg-sidebar':       tok.bgCard,
      '--bg-chat-msg':      tok.bgCardAlt,
      '--border':           tok.border,
      '--border-subtle':    tok.borderSubtle,
      '--text-primary':     tok.textPrimary,
      '--text-secondary':   tok.textSecondary,
      '--text-muted':       tok.textMuted,
      '--text-inverse':     tok.textInverse,
      '--text-heading':     tok.textHeading,
      '--text-link':        tok.textLink,
      '--accent':           tok.accent,
      '--accent-alt':       tok.accentAlt,
      '--accent-gradient':  tok.accentGradient,
      '--accent-glow':      tok.accentGlow,
      '--nav-bg':           tok.navBg,
      '--nav-text':         tok.navText,
      '--scrollbar-thumb':  tok.scrollbarThumb,
      '--scrollbar-track':  tok.scrollbarTrack,
      '--shadow-card':      tok.shadowCard,
      '--shadow-hover':     tok.shadowHover,
      '--logo-color-a':     tok.logoColorA,
      '--logo-color-b':     tok.logoColorB,
      '--radius':           '14px',
      '--radius-sm':        '8px',
      // Bubble colours — driven entirely by the active palette + mode
      '--sent-bg':          tok.sentBg,
      '--sent-text':        tok.sentText,
      '--sent-time':        tok.sentTime,
      '--received-bg':      tok.receivedBg,
      '--received-text':    tok.receivedText,
      '--received-time':    tok.receivedTime,
      '--read-tick':        tok.readTick,
    };

    Object.entries(varMap).forEach(([k, v]) => root.style.setProperty(k, v));

    document.body.classList.toggle('theme-dark', t === 'dark');
    document.body.classList.toggle('theme-light', t === 'light');

    // Palette class for palette-specific overrides
    Object.keys(PALETTES).forEach(name =>
      document.body.classList.toggle(`palette-${name}`, name === p)
    );
  }, []);

  useEffect(() => {
    applyCSSVars(theme, palette);
    try {
      localStorage.setItem('appTheme', theme);
      localStorage.setItem('appPalette', palette);
    } catch (_) {}
  }, [theme, palette, applyCSSVars]);

  const setTheme = useCallback((t) => {
    if (t === 'dark' || t === 'light') setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const setPalette = useCallback((p) => {
    if (PALETTES[p]) setPaletteState(p);
  }, []);

  const value = { theme, isDark, toggleTheme, setTheme, tokens, palette, setPalette, PALETTES };

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