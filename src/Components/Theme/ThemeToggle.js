/**
 * ThemeToggle.js
 *
 * A self-contained dark / light mode toggle button.
 * Now palette-aware — shows the current palette emoji.
 *
 * Usage:
 *   import ThemeToggle from '../Theme/ThemeToggle';
 *   <ThemeToggle />
 *
 * Optional props:
 *   size   — icon size in px  (default 22)
 *   style  — extra inline styles for the outer button
 */

import React from 'react';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';

const ThemeToggle = ({ size = 22, style = {} }) => {
  const { isDark, toggleTheme, tokens, 
    // palette, PALETTES 
  } = useTheme();
  // const currentPalette = PALETTES?.[palette];

  const btnStyle = {
    background:     'none',
    border:         `1.5px solid ${tokens.border}`,
    borderRadius:   tokens.radiusSm ?? '8px',
    minWidth:       36,
    height:         36,
    padding:        '0 8px',
    cursor:         'pointer',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '4px',
    color:          tokens.textPrimary,
    flexShrink:     0,
    transition:     'background 0.2s, border-color 0.2s, color 0.2s',
    fontSize:       '0.8rem',
    fontWeight:     700,
    ...style,
  };

  return (
    <button
      onClick={toggleTheme}
      style={btnStyle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {/* Palette emoji indicator */}
      {/* {currentPalette && (
        <span style={{ fontSize: '0.9rem', lineHeight: 1 }}>
          {currentPalette.emoji}
        </span>
      )} */}

      {/* Sun / Moon icon */}
      {isDark
        ? (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <line x1="12" y1="1"  x2="12" y2="3"/>
            <line x1="12" y1="21" x2="12" y2="23"/>
            <line x1="4.22" y1="4.22"  x2="5.64" y2="5.64"/>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
            <line x1="1" y1="12" x2="3" y2="12"/>
            <line x1="21" y1="12" x2="23" y2="12"/>
            <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
            <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
          </svg>
        )
        : (
          <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
          </svg>
        )
      }
    </button>
  );
};

export default ThemeToggle;