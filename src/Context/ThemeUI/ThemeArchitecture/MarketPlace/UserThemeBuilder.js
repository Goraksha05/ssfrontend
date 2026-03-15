// UserThemeBuilder.js

export function buildUserTheme(baseTheme,overrides){

  const newTheme = {

    ...baseTheme,

    ...overrides

  };

  return newTheme;

}