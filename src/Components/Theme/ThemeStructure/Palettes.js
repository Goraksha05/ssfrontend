import { PALETTE_META } from "./paletteMeta";
import { PALETTE_TOKENS } from "./paletteTokens";

export const PALETTES = {};

Object.keys(PALETTE_META).forEach(name => {
  PALETTES[name] = {
    ...PALETTE_META[name],
    ...PALETTE_TOKENS[name]
  };
});