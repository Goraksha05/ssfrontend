/**
 * ThemeContext.js — SoShoLife Multi-Palette Theme System
 *
 * Provides dark / light mode + multiple named color palettes for the entire app.
 * Integrates with ThemeRegistry (singleton store), ThemeLoader (async/lazy loading),
 * AdminThemeManager, ThemeMarketplace, and UserThemeBuilder.
 *
 * Usage
 * ─────
 * 1. Wrap your app with <ThemeProvider> (already wired into App.js).
 * 2. Consume in any component:
 *      import { useTheme } from '../../Context/Theme/ThemeContext';
 *      const {
 *        theme, isDark, toggleTheme, setTheme,
 *        tokens, palette, setPalette,
 *        palettes,                        // live registry snapshot (replaces static PALETTES)
 *        loadPalette,                     // async — lazy-loads a palette by name
 *        installTheme, uninstallTheme,    // runtime install/remove (marketplace / admin)
 *        buildAndInstallTheme,            // UserThemeBuilder helper
 *      } = useTheme();
 *
 * Palettes
 * ────────
 * Each palette has a `dark` and `light` variant.
 * Built-in names: 'ocean' | 'sunset' | 'forest' | 'royal' | 'rose' | 'midnight'
 * Additional palettes can be registered at runtime via installTheme() or ThemeMarketplace/AdminThemeManager.
 *
 * Design tokens
 * ─────────────
 * `tokens` is a flat object of CSS-ready colour / spacing values for the active palette + mode.
 * ThemeProvider writes them as CSS custom properties to <html>.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';

import { PALETTES }          from '../ThemeStructure/Palettes';
import { themeRegistry }     from './ThemeRegistry';
import { loadTheme }         from './ThemeLoader';
import { buildUserTheme }    from './MarketPlace/UserThemeBuilder';

// ─── Seed the registry with all built-in static palettes ──────────────────────
// This ensures ThemeLoader, AdminThemeManager, and ThemeMarketplace all see the
// default palettes via the shared registry from the moment the app boots.
Object.entries(PALETTES).forEach(([name, palette]) => {
  if (!themeRegistry.get(name)) {
    themeRegistry.register(name, palette);
  }
});

// ─── Context ──────────────────────────────────────────────────────────────────

const ThemeContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ThemeProvider = ({ children }) => {

  // ── Persistence helpers ────────────────────────────────────────────────────

  const getInitialTheme = () => {
    try {
      const stored = localStorage.getItem('appTheme');
      if (stored === 'dark' || stored === 'light') return stored;
    } catch (_) {}
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const getInitialPalette = () => {
    try {
      const stored = localStorage.getItem('appPalette');
      if (stored && themeRegistry.get(stored)) return stored;
    } catch (_) {}
    return 'ocean';
  };

  // ── State ──────────────────────────────────────────────────────────────────

  const [theme,   setThemeState]   = useState(getInitialTheme);
  const [palette, setPaletteState] = useState(getInitialPalette);

  // Live snapshot of all registered palettes — updated whenever the registry changes.
  // Components that need the full palette list (e.g. a palette picker) should read
  // this instead of the old static PALETTES export.
  const [palettes, setPalettes] = useState(() => {
    const snap = {};
    themeRegistry.list().forEach(name => { snap[name] = themeRegistry.get(name); });
    return snap;
  });

  const isDark = theme === 'dark';

  // Resolve tokens from the registry (falls back to built-in ocean).
  const activePalette = themeRegistry.get(palette) ?? themeRegistry.get('ocean');
  const tokens        = activePalette?.[theme] ?? activePalette?.dark ?? PALETTES.ocean.dark;

  // ── Registry snapshot sync ─────────────────────────────────────────────────
  // Rebuild the palettes snapshot so consumers re-render after installs/uninstalls.

  const syncPalettes = useCallback(() => {
    const snap = {};
    themeRegistry.list().forEach(name => { snap[name] = themeRegistry.get(name); });
    setPalettes(snap);
  }, []);

  // ── CSS custom-property writer ─────────────────────────────────────────────

  const applyCSSVars = useCallback((t, p) => {
    const pal = themeRegistry.get(p) ?? themeRegistry.get('ocean');
    const tok = pal?.[t] ?? pal?.dark ?? PALETTES.ocean.dark;
    const root = document.documentElement;

    const varMap = {
      '--bg-page':         tok.bgPage,
      '--bg-card':         tok.bgCard,
      '--bg-card-alt':     tok.bgCardAlt,
      '--bg-input':        tok.bgInput,
      '--bg-hover':        tok.bgHover,
      '--bg-skeleton':     tok.bgSkeleton,
      '--bg-sidebar':      tok.bgCard,
      '--bg-chat-msg':     tok.bgCardAlt,
      '--border':          tok.border,
      '--border-subtle':   tok.borderSubtle,
      '--text-primary':    tok.textPrimary,
      '--text-secondary':  tok.textSecondary,
      '--text-muted':      tok.textMuted,
      '--text-inverse':    tok.textInverse,
      '--text-heading':    tok.textHeading,
      '--text-link':       tok.textLink,
      '--accent':          tok.accent,
      '--accent-alt':      tok.accentAlt,
      '--accent-gradient': tok.accentGradient,
      '--accent-glow':     tok.accentGlow,
      '--nav-bg':          tok.navBg,
      '--nav-text':        tok.navText,
      '--scrollbar-thumb': tok.scrollbarThumb,
      '--scrollbar-track': tok.scrollbarTrack,
      '--shadow-card':     tok.shadowCard,
      '--shadow-hover':    tok.shadowHover,
      '--logo-color-a':    tok.logoColorA,
      '--logo-color-b':    tok.logoColorB,
      '--radius':          '14px',
      '--radius-sm':       '8px',
    };

    Object.entries(varMap).forEach(([k, v]) => root.style.setProperty(k, v));

    document.body.classList.toggle('theme-dark',  t === 'dark');
    document.body.classList.toggle('theme-light', t === 'light');

    // Palette body-class for any palette-specific CSS overrides
    themeRegistry.list().forEach(name =>
      document.body.classList.toggle(`palette-${name}`, name === p)
    );
  }, []);

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    applyCSSVars(theme, palette);
    try {
      localStorage.setItem('appTheme',   theme);
      localStorage.setItem('appPalette', palette);
    } catch (_) {}
  }, [theme, palette, applyCSSVars]);

  // ── Theme / palette setters ────────────────────────────────────────────────

  const setTheme = useCallback((t) => {
    if (t === 'dark' || t === 'light') setThemeState(t);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const setPalette = useCallback((p) => {
    if (themeRegistry.get(p)) setPaletteState(p);
  }, []);

  // ── Runtime palette management ─────────────────────────────────────────────

  /**
   * installTheme({ name, dark, light, label?, emoji?, preview? })
   * Mirrors ThemeMarketplace.install() / AdminThemeManager.enableTheme() but also
   * refreshes the React palette snapshot so the UI updates immediately.
   */
  const installTheme = useCallback((themeObj) => {
    themeRegistry.register(themeObj.name, themeObj);
    syncPalettes();
  }, [syncPalettes]);

  /**
   * uninstallTheme(name)
   * Mirrors ThemeMarketplace.uninstall() / AdminThemeManager.disableTheme().
   * Falls back to 'ocean' if the active palette is removed.
   */
  const uninstallTheme = useCallback((name) => {
    themeRegistry.unregister(name);
    syncPalettes();
    setPaletteState(prev => (prev === name ? 'ocean' : prev));
  }, [syncPalettes]);

  /**
   * loadPalette(name)
   * Async wrapper around ThemeLoader.loadTheme().
   * Use for code-split / marketplace palettes that aren't bundled upfront.
   * Returns the loaded theme object (or null on failure).
   */
  const loadPalette = useCallback(async (name) => {
    const loaded = await loadTheme(name);   // registers in themeRegistry internally
    if (loaded) syncPalettes();
    return loaded;
  }, [syncPalettes]);

  /**
   * buildAndInstallTheme(basePaletteName, overrides, newName)
   * Thin wrapper around UserThemeBuilder.buildUserTheme() that immediately
   * registers the result so it's available as a selectable palette.
   */
  const buildAndInstallTheme = useCallback((basePaletteName, overrides, newName) => {
    const base     = themeRegistry.get(basePaletteName) ?? PALETTES.ocean;
    const newTheme = buildUserTheme(base, overrides);
    newTheme.name  = newName;
    installTheme(newTheme);
    return newTheme;
  }, [installTheme]);

  // ── Context value ──────────────────────────────────────────────────────────

  const value = {
    // Mode
    theme,
    isDark,
    toggleTheme,
    setTheme,

    // Active palette tokens
    tokens,

    // Palette selection
    palette,
    setPalette,

    // Live registry snapshot (replaces the old static PALETTES export for consumers)
    palettes,

    // Async / runtime palette ops
    loadPalette,
    installTheme,
    uninstallTheme,
    buildAndInstallTheme,

    // Keep PALETTES accessible for consumers that still reference it directly
    PALETTES,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// ─── Hook ──────────────────────────────────────────────────────────────────────

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};

export default ThemeContext;