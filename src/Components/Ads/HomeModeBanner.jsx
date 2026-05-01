/**
 * Components/Ads/HomeModeBanner.jsx
 *
 * Shown at the top of the home feed when the app is in Ads Manager mode
 * (mode === 'ads'). Gives the user a highly visible escape hatch back to
 * the personal feed without having to open the navbar dropdown.
 *
 * Usage in Home.js (or whatever wraps it):
 *
 *   import HomeModeBanner from '../Ads/HomeModeBanner';
 *
 *   // inside return (before your main content):
 *   <HomeModeBanner mode={mode} setMode={setMode} />
 *
 * The component renders nothing when mode !== 'ads'.
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomeModeBanner = ({ mode, setMode }) => {
  const navigate = useNavigate();

  // Only render in ads mode
  if (mode !== 'ads') return null;

  const handleGoHome = () => {
    setMode('home');
    navigate('/');
  };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
        gap:            12,
        padding:        '10px 16px',
        marginBottom:   12,
        borderRadius:   10,
        background:     'linear-gradient(90deg, rgba(56,189,248,0.12), rgba(99,102,241,0.10))',
        border:         '1px solid var(--accent, #38bdf8)',
        color:          'var(--text-primary)',
        fontSize:       13,
        flexWrap:       'wrap',
      }}
    >
      {/* Label */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Megaphone icon */}
        <svg
          width="15" height="15" viewBox="0 0 24 24"
          fill="none" stroke="var(--accent, #38bdf8)"
          strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0 }}
        >
          <path d="M3 11l19-9-9 19-2-8-8-2z" />
        </svg>
        <span style={{ fontWeight: 600, color: 'var(--accent, #38bdf8)' }}>
          Ads Manager active
        </span>
        <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
          — you're viewing in Business mode.
        </span>
      </span>

      {/* CTA */}
      <button
        onClick={handleGoHome}
        style={{
          display:        'inline-flex',
          alignItems:     'center',
          gap:            6,
          padding:        '5px 14px',
          borderRadius:   7,
          border:         '1px solid var(--border)',
          background:     'var(--bg-card)',
          color:          'var(--text-primary)',
          fontSize:       12,
          fontWeight:     700,
          cursor:         'pointer',
          whiteSpace:     'nowrap',
          transition:     'background 0.12s, border-color 0.12s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background   = 'var(--bg-hover)';
          e.currentTarget.style.borderColor  = 'var(--accent)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background   = 'var(--bg-card)';
          e.currentTarget.style.borderColor  = 'var(--border)';
        }}
        title="Switch back to your personal Home feed"
      >
        {/* House icon */}
        <svg
          width="12" height="12" viewBox="0 0 24 24"
          fill="none" stroke="currentColor"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
        ← Back to Home Feed
      </button>
    </div>
  );
};

export default HomeModeBanner;