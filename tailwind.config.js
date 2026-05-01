// tailwind.config.js
const { fontFamily } = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: ['class', '.theme-dark'],   // driven by ThemeContext adding 'dark' to <html>
  theme: {
    extend: {
      fontFamily: {
        sans:    ['Nunito', ...fontFamily.sans],
        display: ['"Baloo 2"', 'cursive'],
        ui:      ['"DM Sans"', ...fontFamily.sans],
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
          card: "#ffffff",
          border: "#e5e7eb",
          muted: "#6b7280",
        // Brand palette — maps to your CSS vars
        brand: {
          50:  '#eff6ff',
          100: '#dbeafe',
          400: '#60a5fa',
          500: '#0ea5e9',
          600: '#007FFF',
          700: '#0284c7',
          900: '#0c1e35',
        },
        surface: {
          DEFAULT: 'var(--bg-card)',
          alt:     'var(--bg-card-alt)',
          hover:   'var(--bg-hover)',
          input:   'var(--bg-input)',
          skeleton:'var(--bg-skeleton)',
          page:    'var(--bg-page)',
          sidebar: 'var(--bg-sidebar)',
        },
        text: {
          primary:   'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          heading:   'var(--text-heading)',
          link:      'var(--text-link)',
          inverse:   'var(--text-inverse)',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          alt:     'var(--accent-alt)',
        },
        nav: {
          bg:   'var(--nav-bg)',
          text: 'var(--nav-text)',
        },
        border: {
          DEFAULT: 'var(--border)',
          subtle:  'var(--border-subtle)',
        },
      },
      boxShadow: {
        card:    'var(--shadow-card)',
        hover:   'var(--shadow-hover)',
        glow:    '0 0 20px var(--accent-glow)',
        'glow-sm': '0 0 12px var(--accent-glow)',
      },
      borderRadius: {
        theme:    'var(--radius)',
        'theme-sm': 'var(--radius-sm)',
      },
      backgroundImage: {
        'accent-gradient': 'var(--accent-gradient)',
        'nav-gradient':    'var(--nav-bg)',
      },
      animation: {
        shimmer:  'shimmer 1.4s infinite linear',
        fadeUp:   'fadeUp 0.4s ease both',
        heartPop: 'heartPop 0.55s cubic-bezier(0.34, 1.56, 0.64, 1) both',
        spin:     'spin 0.8s linear infinite',
        pulse:    'pulse 2s ease-in-out infinite',
        slideIn:  'slideIn 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
        popIn:    'popIn 0.2s ease both',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-300px 0' },
          '100%': { backgroundPosition:  '300px 0' },
        },
        fadeUp: {
          from: { opacity: 0, transform: 'translateY(12px)' },
          to:   { opacity: 1, transform: 'translateY(0)' },
        },
        heartPop: {
          '0%':   { transform: 'scale(1)' },
          '40%':  { transform: 'scale(1.45)' },
          '70%':  { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        slideIn: {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        popIn: {
          from: { opacity: 0, transform: 'scale(0.96) translateY(6px)' },
          to:   { opacity: 1, transform: 'scale(1) translateY(0)' },
        },
      },
      transitionProperty: {
        theme: 'background-color, color, border-color, box-shadow',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),       // optional, for inputs
  ],
};