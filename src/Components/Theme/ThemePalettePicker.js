/**
 * ThemePalettePicker.js
 *
 * A fully controlled palette + mode picker modal.
 * Visibility is driven entirely by props — no internal open/close state.
 *
 * Props:
 *   open    {boolean}  — whether the modal is visible (owned by UIContext)
 *   onClose {function} — callback to close the modal (calls UIContext.closeThemePicker)
 *
 * Usage (in App.js):
 *   const { isThemePickerOpen, closeThemePicker } = useUI();
 *   <ThemePalettePicker open={isThemePickerOpen} onClose={closeThemePicker} />
 *
 * Trigger (in Navbartemp.js):
 *   const { openThemePicker } = useUI();
 *   <button onClick={openThemePicker}>Theme</button>
 */

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../Context/ThemeUI/ThemeContext';

// ─── Inline styles ────────────────────────────────────────────────────────────

const S = {
  /* Trigger button */
  triggerBtn: (tok, isOpen) => ({
    position:    'relative',
    display:     'inline-flex',
    alignItems:  'center',
    gap:         '8px',
    padding:     '10px 10px',
    borderRadius:'50px',
    border:      'none',
    cursor:      'pointer',
    fontFamily:  "'Baloo 2', cursive",
    fontWeight:  800,
    fontSize:    '1rem',
    color:       '#fff',
    background:  tok.accentGradient,
    boxShadow:   isOpen
      ? `0 0 0 3px ${tok.accentGlow}, 0 8px 30px ${tok.accentGlow}`
      : `0 4px 18px ${tok.accentGlow}`,
    transition:  'box-shadow 0.25s, transform 0.18s',
    transform:   isOpen ? 'scale(1.04)' : 'scale(1)',
    zIndex:      200,
    letterSpacing:'0.3px',
  }),

  /* Backdrop overlay */
  overlay: {
    position:       'fixed',
    inset:          0,
    zIndex:         9999,
    background:     'rgba(0,0,0,0.55)',
    backdropFilter: 'blur(4px)',
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '16px',
    animation:      'tpp-fade-in 0.22s ease',
  },

  /* Modal panel */
  modal: (tok) => ({
    background:   tok.bgCard,
    borderRadius: '24px',
    boxShadow:    `0 24px 72px rgba(0,0,0,0.45), 0 0 0 1px ${tok.border}`,
    padding:      'clamp(20px, 4vw, 28px) clamp(16px, 4vw, 24px)',
    width:        '100%',
    maxWidth:     '480px',
    maxHeight:    '90vh',
    overflowY:    'auto',
    zIndex:       10000,
    animation:    'tpp-slide-up 0.28s cubic-bezier(0.34,1.56,0.64,1)',
    position:     'relative',
  }),

  modalTitle: (tok) => ({
    fontFamily:    "'Baloo 2', cursive",
    fontWeight:    800,
    fontSize:      '1.4rem',
    color:         tok.textHeading,
    margin:        '0 0 4px',
    textAlign:     'center',
    letterSpacing: '-0.3px',
  }),

  modalSub: (tok) => ({
    fontSize:  '0.82rem',
    color:     tok.textMuted,
    textAlign: 'center',
    margin:    '0 0 20px',
  }),

  sectionLabel: (tok) => ({
    fontSize:      '0.72rem',
    fontWeight:    700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    color:         tok.textMuted,
    marginBottom:  '10px',
  }),

  modeRow: {
    display:       'flex',
    gap:           '10px',
    marginBottom:  '20px',
  },

  modeBtn: (tok, active) => ({
    flex:           1,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            '8px',
    padding:        '12px',
    borderRadius:   '14px',
    border:         active ? `2px solid ${tok.accent}` : `2px solid ${tok.border}`,
    cursor:         'pointer',
    background:     active ? tok.accentGlow : tok.bgCardAlt,
    color:          active ? tok.accent : tok.textSecondary,
    fontFamily:     "'Nunito', sans-serif",
    fontWeight:     700,
    fontSize:       '0.9rem',
    transition:     'all 0.18s',
    boxShadow:      active ? `0 0 0 3px ${tok.accentGlow}` : 'none',
  }),

  paletteGrid: {
    display:             'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap:                 '10px',
    marginBottom:        '20px',
  },

  paletteCard: (tok, active) => ({
    display:       'flex',
    flexDirection: 'column',
    alignItems:    'center',
    gap:           '6px',
    padding:       '12px 8px',
    borderRadius:  '14px',
    cursor:        'pointer',
    border:        active ? `2px solid ${tok.accent}` : `2px solid ${tok.border}`,
    background:    active ? tok.bgHover : tok.bgCardAlt,
    boxShadow:     active ? `0 0 0 3px ${tok.accentGlow}` : 'none',
    transition:    'all 0.18s',
    position:      'relative',
  }),

  paletteSwatches: {
    display: 'flex',
    gap:     '3px',
  },

  swatch: (color) => ({
    width:       '16px',
    height:      '16px',
    borderRadius:'50%',
    background:  color,
    border:      '1.5px solid rgba(255,255,255,0.3)',
    boxShadow:   '0 1px 4px rgba(0,0,0,0.25)',
    flexShrink:  0,
  }),

  paletteName: (tok, active) => ({
    fontSize:      '0.72rem',
    fontWeight:    700,
    color:         active ? tok.accent : tok.textSecondary,
    letterSpacing: '0.03em',
  }),

  paletteEmoji: {
    fontSize:   '1.3rem',
    lineHeight: 1,
  },

  checkBadge: (tok) => ({
    position:       'absolute',
    top:            '6px',
    right:          '6px',
    width:          '16px',
    height:         '16px',
    borderRadius:   '50%',
    background:     tok.accent,
    display:        'flex',
    alignItems:     'center',
    justifyContent: 'center',
  }),

  applyBtn: (tok) => ({
    width:         '100%',
    padding:       '13px',
    borderRadius:  '14px',
    border:        'none',
    cursor:        'pointer',
    background:    tok.accentGradient,
    color:         '#fff',
    fontFamily:    "'Baloo 2', cursive",
    fontWeight:    800,
    fontSize:      '1rem',
    boxShadow:     `0 4px 16px ${tok.accentGlow}`,
    transition:    'transform 0.15s, box-shadow 0.15s',
    letterSpacing: '0.3px',
  }),

  closeBtn: (tok) => ({
    position:   'absolute',
    top:        '14px',
    right:      '16px',
    background: 'none',
    border:     'none',
    cursor:     'pointer',
    color:      tok.textMuted,
    fontSize:   '1.4rem',
    lineHeight: 1,
    padding:    '4px',
  }),
};

// ─── Keyframes (injected once) ────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes tpp-fade-in {
    from { opacity: 0 } to { opacity: 1 }
  }
  @keyframes tpp-slide-up {
    from { opacity: 0; transform: translateY(40px) scale(0.95) }
    to   { opacity: 1; transform: translateY(0)    scale(1)    }
  }
  @keyframes tpp-ripple {
    from { transform: scale(0); opacity: 0.5 }
    to   { transform: scale(3); opacity: 0   }
  }
  @keyframes tpp-spin-slow {
    from { transform: rotate(0deg)   }
    to   { transform: rotate(360deg) }
  }
  .tpp-apply:hover {
    transform:  scale(1.02) !important;
    box-shadow: 0 8px 24px var(--accent-glow) !important;
  }
  .tpp-palette-card:hover { transform: translateY(-2px); }
  .tpp-mode-btn:hover     { opacity: 0.9; }
`;

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * @param {{ open: boolean, onClose: () => void }} props
 */
const ThemePalettePicker = ({ open, onClose }) => {
  const { tokens: tok, theme, setTheme, palette, setPalette, PALETTES } = useTheme();

  const [pendingTheme,   setPendingTheme]   = useState(theme);
  const [pendingPalette, setPendingPalette] = useState(palette);
  // const [ripples, setRipples]        = useState([]);
  // const btnRef = useRef(null);

  // Sync pending selections whenever the modal is opened
  useEffect(() => {
    if (open) {
      setPendingTheme(theme);
      setPendingPalette(palette);
    }
  }, [open, theme, palette]);

  // Escape key → onClose
  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  // Prevent background scroll while modal is open (bonus)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Ripple effect on the trigger button
  // const handleTriggerClick = (e) => {
  //   if (!btnRef.current) return;
  //   const rect = btnRef.current.getBoundingClientRect();
  //   const id   = Date.now();
  //   setRipples(r => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
  //   setTimeout(() => setRipples(r => r.filter(rr => rr.id !== id)), 600);
  //   // NOTE: opening is handled externally via the onClick passed to the trigger.
  //   // This handler is kept only for the ripple visual.
  // };

  const handleApply = () => {
    setTheme(pendingTheme);
    setPalette(pendingPalette);
    onClose();
  };

  const previewTok = PALETTES[pendingPalette]?.[pendingTheme] ?? tok;

  // ── Trigger Button (exported so Navbar can still embed it) ──────────────────
  // In the new architecture the trigger lives in Navbartemp and calls
  // openThemePicker() from UIContext. We keep the button here only as a named
  // export so it can be optionally reused, but the primary export is the modal.

  // ── Modal (via Portal so it always renders at <body>) ───────────────────────
  if (!open) return null;

  return createPortal(
    <>
      {/* Keyframes — injected once into <head> */}
      <style>{KEYFRAMES}</style>

      {/* Overlay */}
      <div
        style={S.overlay}
        onClick={onClose}
        aria-modal="true"
        role="dialog"
        aria-label="Choose your theme"
      >
        {/* Modal panel */}
        <div
          style={S.modal(previewTok)}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Close */}
          <button
            style={S.closeBtn(previewTok)}
            onClick={onClose}
            aria-label="Close theme picker"
          >
            ✕
          </button>

          {/* Title */}
          <h2 style={S.modalTitle(previewTok)}>🎨 Choose Your Theme</h2>
          <p style={S.modalSub(previewTok)}>
            Pick a palette and mode — preview updates live!
          </p>

          {/* ── Mode Row ── */}
          <div style={S.sectionLabel(previewTok)}>Mode</div>
          <div style={S.modeRow}>
            {[
              { value: 'light', icon: '☀️', label: 'Light' },
              { value: 'dark',  icon: '🌙', label: 'Dark'  },
            ].map(m => (
              <button
                key={m.value}
                className="tpp-mode-btn"
                style={S.modeBtn(previewTok, pendingTheme === m.value)}
                onClick={() => setPendingTheme(m.value)}
              >
                <span style={{ fontSize: '1.2rem' }}>{m.icon}</span>
                {m.label}
              </button>
            ))}
          </div>

          {/* ── Palette Grid ── */}
          <div style={S.sectionLabel(previewTok)}>Color Palette</div>
          <div style={S.paletteGrid}>
            {Object.entries(PALETTES).map(([key, pal]) => {
              const active = pendingPalette === key;
              return (
                <button
                  key={key}
                  className="tpp-palette-card"
                  style={S.paletteCard(previewTok, active)}
                  onClick={() => setPendingPalette(key)}
                  title={pal.label}
                >
                  {active && (
                    <span style={S.checkBadge(previewTok)}>
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <path
                          d="M2 5l2.5 2.5 4-4"
                          stroke="#fff"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}

                  <span style={S.paletteEmoji}>{pal.emoji}</span>

                  <div style={S.paletteSwatches}>
                    {pal.preview.map((c, i) => (
                      <span key={i} style={S.swatch(c)} />
                    ))}
                  </div>

                  <span style={S.paletteName(previewTok, active)}>
                    {pal.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* ── Apply ── */}
          <button
            className="tpp-apply"
            style={S.applyBtn(previewTok)}
            onClick={handleApply}
          >
            ✓ Apply Theme
          </button>
        </div>
      </div>
    </>,
    document.body
  );
};

// ── Standalone trigger button (optional reuse) ────────────────────────────────
// Import and render this in Navbartemp if you want the original glowing pill button.

export const ThemePickerTrigger = ({ onClick }) => {
  const { tokens: tok } = useTheme();
  const [ripples, setRipples] = useState([]);
  const btnRef = useRef(null);

  const handleClick = (e) => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      const id   = Date.now();
      setRipples(r => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
      setTimeout(() => setRipples(r => r.filter(rr => rr.id !== id)), 600);
    }
    onClick?.();
  };

  return (
    <>
      <style>{KEYFRAMES}</style>
      <button
        ref={btnRef}
        className="tpp-trigger"
        style={S.triggerBtn(tok, false)}
        onClick={handleClick}
        aria-label="Choose theme color palette"
        title="Choose Theme"
      >
        {ripples.map(r => (
          <span
            key={r.id}
            style={{
              position:      'absolute',
              left:          r.x,
              top:           r.y,
              width:         '10px',
              height:        '10px',
              borderRadius:  '50%',
              background:    'rgba(255,255,255,0.5)',
              transform:     'translate(-50%,-50%)',
              animation:     'tpp-ripple 0.6s ease-out forwards',
              pointerEvents: 'none',
            }}
          />
        ))}

        {/* Palette icon */}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="13.5" cy="6.5"  r="0.5" fill="currentColor" />
          <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
          <circle cx="8.5"  cy="7.5"  r="0.5" fill="currentColor" />
          <circle cx="6.5"  cy="12.5" r="0.5" fill="currentColor" />
          <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
        </svg>

        {/* Theme */}

        <span style={{
          position:      'absolute',
          inset:         '-3px',
          borderRadius:  '50px',
          border:        '1.5px dashed rgba(255,255,255,0.3)',
          pointerEvents: 'none',
        }} />
      </button>
    </>
  );
};

export default ThemePalettePicker;