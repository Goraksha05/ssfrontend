// ThemeProvider.js

import React, { createContext, useContext, useEffect, useState } from "react";
// import { themeRegistry } from "./ThemeRegistry";
import { PALETTES } from "../ThemeStructure/Palettes";

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {

  const [theme, setTheme] = useState(
    localStorage.getItem("appTheme") || "dark"
  );

  const [palette, setPalette] = useState(
    localStorage.getItem("appPalette") || "ocean"
  );

  const tokens = PALETTES[palette]?.[theme];

  useEffect(() => {

    applyTheme(tokens);

    localStorage.setItem("appTheme", theme);
    localStorage.setItem("appPalette", palette);

  }, [theme, palette, tokens]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        palette,
        setTheme,
        setPalette,
        tokens,
        PALETTES
      }}
    >
      {children}
    </ThemeContext.Provider>
  );

};

export const useTheme = () => {

  const ctx = useContext(ThemeContext);

  if (!ctx) {
    throw new Error("useTheme must be inside ThemeProvider");
  }

  return ctx;

};


function applyTheme(tokens) {

  const root = document.documentElement;

  Object.entries(tokens).forEach(([k, v]) => {
    root.style.setProperty(`--${k}`, v);
  });

}