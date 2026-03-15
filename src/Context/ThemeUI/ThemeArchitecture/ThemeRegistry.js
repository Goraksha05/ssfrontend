// ThemeRegistry.js

class ThemeRegistry {

  constructor(){
    this.themes = {};
  }

  register(name, theme){
    this.themes[name] = theme;
  }

  unregister(name){
    delete this.themes[name];
  }

  get(name){
    return this.themes[name];
  }

  list(){
    return Object.keys(this.themes);
  }

}

export const themeRegistry = new ThemeRegistry();