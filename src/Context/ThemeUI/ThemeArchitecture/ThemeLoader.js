// ThemeLoader.js

import { themeRegistry } from "./ThemeRegistry";

export async function loadTheme(name){

  if(themeRegistry.get(name)){
    return themeRegistry.get(name);
  }

  try{

    const themeModule = await import(`./themes/${name}.js`);

    const theme = themeModule.default;

    themeRegistry.register(name, theme);

    return theme;

  }catch(err){

    console.warn("Theme load failed:", name);

    return null;

  }

}