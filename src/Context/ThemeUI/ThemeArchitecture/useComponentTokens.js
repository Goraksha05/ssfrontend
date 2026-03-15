// useComponentTokens.js

import { useTheme } from "./ThemeProvider";

export const useComponentTokens = (component)=>{

  const {tokens} = useTheme();

  const COMPONENT_TOKENS = {

    button:{
      bg:tokens.accent,
      text:tokens.textInverse,
      hover:tokens.accentAlt
    },

    card:{
      bg:tokens.bgCard,
      border:tokens.border,
      shadow:tokens.shadowCard
    },

    navbar:{
      bg:tokens.navBg,
      text:tokens.navText
    }

  };

  return COMPONENT_TOKENS[component];

};