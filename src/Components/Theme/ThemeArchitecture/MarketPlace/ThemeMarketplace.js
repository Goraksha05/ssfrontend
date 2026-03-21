// ThemeMarketplace.js

import { themeRegistry } from "../ThemeRegistry";

export const ThemeMarketplace = {

  install(theme){

    themeRegistry.register(theme.name,theme);

  },

  uninstall(name){

    themeRegistry.unregister(name);

  }

};