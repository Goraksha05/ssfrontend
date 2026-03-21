// ThemeLoader.js

import { PALETTES }      from '../ThemeStructure/Palettes';
import { themeRegistry } from './ThemeRegistry';

export async function loadTheme(name) {

  // 1. Already in the registry — return immediately (covers all built-in palettes
  //    that were seeded at boot and any runtime-installed marketplace themes).
  if (themeRegistry.get(name)) {
    return themeRegistry.get(name);
  }

  // 2. Present in the static bundle (shouldn't normally reach here after registry
  //    seeding in ThemeContext, but acts as a safe synchronous fallback).
  if (PALETTES[name]) {
    themeRegistry.register(name, PALETTES[name]);
    return PALETTES[name];
  }

  // 3. Unknown palette — attempt a dynamic import from the ./themes directory.
  //    The /* webpackIgnore: true */ comment prevents Webpack from trying to
  //    statically resolve the expression at build time, which eliminates the
  //    "Module not found: Can't resolve './themes'" warning while preserving
  //    the ability to lazy-load genuinely external palette files at runtime.
  try {
    const themeModule = await import(/* webpackIgnore: true */ `./themes/${name}.js`);
    const theme = themeModule.default;
    themeRegistry.register(name, theme);
    return theme;
  } catch (err) {
    console.warn(`ThemeLoader: could not load palette "${name}".`, err);
    return null;
  }

}