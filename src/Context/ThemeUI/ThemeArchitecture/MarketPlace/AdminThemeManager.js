// AdminThemeManager.js

import { themeRegistry } from "../ThemeRegistry";

export const AdminThemeManager = {

  enableTheme(theme){

    themeRegistry.register(theme.name,theme);

  },

  disableTheme(name){

    themeRegistry.unregister(name);

  },

  listThemes(){

    return themeRegistry.list();

  }

};