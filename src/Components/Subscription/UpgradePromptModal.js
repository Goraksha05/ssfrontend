/**
 * UpgradePromptModal.js
 *
 * High-conversion upgrade modal rendered via the central modal system.
 * Design direction: refined luxury SaaS — deep navy canvas, champagne-gold
 * accents, crisp typography (Sora display / DM Sans body), layered glows,
 * and purposeful motion. Every pixel earns its place.
 *
 * Props:
 *   onUpgrade     () => void   CTA clicked → caller opens subscription flow
 *   onSnooze      () => void   "Maybe Later" clicked
 *   onDismissToday() => void   "Don't show today" checkbox
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRegisterModal } from '../../Context/ModalContext';

// ── Inline styles ─────────────────────────────────────────────────────────────
// Kept inline so the component is truly self-contained (no CSS module needed).
const S = {
  /* ── Overlay ─────────────────────────────────────────────────── */
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    background: 'rgba(5, 7, 20, 0.72)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    animation: 'upm_overlayIn 0.25s ease forwards',
  },

  /* ── Card ────────────────────────────────────────────────────── */
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '480px',
    borderRadius: '28px',
    overflow: 'hidden',
    background: 'linear-gradient(155deg, #0d1232 0%, #111828 55%, #0a0d1e 100%)',
    border: '1px solid rgba(180, 150, 90, 0.22)',
    boxShadow:
      '0 0 0 1px rgba(255,255,255,0.04) inset, ' +
      '0 40px 80px rgba(0,0,0,0.6), ' +
      '0 0 60px rgba(99,102,241,0.12)',
    animation: 'upm_cardIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
    fontFamily: "'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif",
  },

  /* ── Ambient glow blobs ──────────────────────────────────────── */
  glowTopRight: {
    position: 'absolute',
    top: '-60px',
    right: '-40px',
    width: '220px',
    height: '220px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  glowBottomLeft: {
    position: 'absolute',
    bottom: '-40px',
    left: '-30px',
    width: '180px',
    height: '180px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236,183,78,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },

  /* ── Close button ────────────────────────────────────────────── */
  closeBtn: {
    position: 'absolute',
    top: '18px',
    right: '18px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.5)',
    fontSize: '16px',
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    zIndex: 2,
  },

  /* ── Body ────────────────────────────────────────────────────── */
  body: {
    position: 'relative',
    zIndex: 1,
    padding: '40px 36px 32px',
  },

  /* ── Crown badge ─────────────────────────────────────────────── */
  crownWrap: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
  },
  crownRing: {
    width: '72px',
    height: '72px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, rgba(236,183,78,0.2), rgba(236,183,78,0.04))',
    border: '1.5px solid rgba(236,183,78,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 24px rgba(236,183,78,0.15)',
    animation: 'upm_pulse 3s ease-in-out infinite',
  },
  crownEmoji: {
    fontSize: '30px',
    lineHeight: 1,
    filter: 'drop-shadow(0 2px 8px rgba(236,183,78,0.5))',
  },

  /* ── Copy ────────────────────────────────────────────────────── */
  headline: {
    margin: '0 0 10px',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '-0.5px',
    lineHeight: 1.25,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: "'Sora', 'DM Sans', sans-serif",
  },
  subline: {
    margin: '0 0 28px',
    fontSize: '14.5px',
    lineHeight: 1.6,
    color: 'rgba(200,210,240,0.7)',
    textAlign: 'center',
  },

  /* ── Benefits list ───────────────────────────────────────────── */
  benefits: {
    listStyle: 'none',
    margin: '0 0 28px',
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  benefitItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    borderRadius: '14px',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.07)',
    transition: 'background 0.2s',
  },
  benefitIconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    fontSize: '17px',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: '13.5px',
    fontWeight: 600,
    color: '#E8EDF8',
    marginBottom: '2px',
  },
  benefitDesc: {
    fontSize: '12px',
    color: 'rgba(170,185,220,0.65)',
  },

  /* ── Urgency strip ───────────────────────────────────────────── */
  urgencyStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '9px 14px',
    borderRadius: '10px',
    background: 'rgba(236,183,78,0.08)',
    border: '1px solid rgba(236,183,78,0.18)',
    marginBottom: '24px',
  },
  urgencyDot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    background: '#ECB74E',
    animation: 'upm_blink 1.4s ease-in-out infinite',
    flexShrink: 0,
  },
  urgencyText: {
    fontSize: '12.5px',
    color: '#ECB74E',
    fontWeight: 600,
    letterSpacing: '0.1px',
  },

  /* ── CTA button ──────────────────────────────────────────────── */
  ctaBtn: {
    width: '100%',
    padding: '15px 20px',
    borderRadius: '16px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '15px',
    fontWeight: 700,
    letterSpacing: '0.2px',
    color: '#0d1232',
    background: 'linear-gradient(135deg, #ECB74E 0%, #F5D08A 50%, #ECB74E 100%)',
    backgroundSize: '200% 100%',
    boxShadow: '0 6px 24px rgba(236,183,78,0.35), 0 2px 8px rgba(0,0,0,0.3)',
    transition: 'transform 0.18s ease, box-shadow 0.18s ease, background-position 0.4s ease',
    marginBottom: '12px',
    fontFamily: "'Sora', 'DM Sans', sans-serif",
  },

  /* ── Secondary actions ───────────────────────────────────────── */
  secondaryRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '10px',
  },
  snoozeBtn: {
    flex: 1,
    padding: '10px 12px',
    borderRadius: '12px',
    border: '1px solid rgba(255,255,255,0.1)',
    background: 'transparent',
    color: 'rgba(200,210,240,0.55)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.18s ease',
    fontFamily: "'DM Sans', sans-serif",
  },

  /* ── Dismiss today ───────────────────────────────────────────── */
  dismissRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    marginTop: '16px',
    cursor: 'pointer',
  },
  dismissCheck: {
    width: '14px',
    height: '14px',
    accentColor: '#ECB74E',
    cursor: 'pointer',
  },
  dismissLabel: {
    fontSize: '12px',
    color: 'rgba(170,185,220,0.45)',
    cursor: 'pointer',
    userSelect: 'none',
  },
};

// ── Benefit data ──────────────────────────────────────────────────────────────
const BENEFITS = [
  {
    icon:  '💎',
    color: 'rgba(99,102,241,0.15)',
    title: 'Blue Verified Badge',
    desc:  'Stand out on every post, comment, and profile view',
  },
  {
    icon:  '💸',
    color: 'rgba(52,211,153,0.15)',
    title: 'Earn Referral Income',
    desc:  'Unlock grocery coupons, shares & tokens for every referral',
  },
  {
    icon:  '🚀',
    color: 'rgba(236,183,78,0.15)',
    title: 'Premium Features',
    desc:  'Priority access to new features and exclusive community tools',
  },
  {
    icon:  '🔒',
    color: 'rgba(244,114,182,0.15)',
    title: 'Reward Milestones',
    desc:  'Claim post, streak & referral rewards — all gated behind membership',
  },
];

// ── Keyframe injection ────────────────────────────────────────────────────────
function injectKeyframes() {
  const id = '__upm_keyframes';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

    @keyframes upm_overlayIn {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
    @keyframes upm_cardIn {
      from { opacity: 0; transform: scale(0.88) translateY(16px); }
      to   { opacity: 1; transform: scale(1)    translateY(0);    }
    }
    @keyframes upm_pulse {
      0%, 100% { box-shadow: 0 0 24px rgba(236,183,78,0.15); }
      50%      { box-shadow: 0 0 36px rgba(236,183,78,0.32); }
    }
    @keyframes upm_blink {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.35; }
    }
    .upm-cta:hover {
      transform: translateY(-2px) !important;
      box-shadow: 0 10px 32px rgba(236,183,78,0.45), 0 2px 10px rgba(0,0,0,0.4) !important;
      background-position: 100% 0 !important;
    }
    .upm-cta:active {
      transform: translateY(0px) !important;
    }
    .upm-snooze:hover {
      background: rgba(255,255,255,0.06) !important;
      color: rgba(200,210,240,0.85) !important;
    }
    .upm-benefit:hover {
      background: rgba(255,255,255,0.07) !important;
    }
    .upm-close:hover {
      background: rgba(255,255,255,0.12) !important;
      color: rgba(255,255,255,0.9) !important;
    }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────
const UpgradePromptModal = ({ onUpgrade, onSnooze, onDismissToday, subscriptionProgress }) => {
  const [dismissToday, setDismissToday] = useState(false);
  const [closing,      setClosing]      = useState(false);
  const overlayRef = useRef(null);

  // Register with central modal manager (handles scroll lock)
  useRegisterModal(true);

  // Inject fonts + keyframes once
  useEffect(() => { injectKeyframes(); }, []);

  // Fetch progress for the referral count teaser
  const referred = subscriptionProgress?.referredCount ?? 0;
  const target   = subscriptionProgress?.referralTarget ?? 10;

  // ── Animated close ────────────────────────────────────────────────────────
  const animateClose = useCallback((cb) => {
    setClosing(true);
    setTimeout(cb, 220);
  }, []);

  const handleSnooze = useCallback(() => {
    if (dismissToday) {
      animateClose(onDismissToday);
    } else {
      animateClose(onSnooze);
    }
  }, [dismissToday, animateClose, onSnooze, onDismissToday]);

  const handleUpgrade = useCallback(() => {
    animateClose(onUpgrade);
  }, [animateClose, onUpgrade]);

  const handleOverlayClick = useCallback((e) => {
    if (e.target === overlayRef.current) {
      animateClose(onSnooze);
    }
  }, [animateClose, onSnooze]);

  // ── Keyboard escape ───────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') animateClose(onSnooze);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [animateClose, onSnooze]);

  const cardStyle = {
    ...S.card,
    ...(closing ? {
      animation: 'none',
      opacity: 0,
      transform: 'scale(0.92) translateY(10px)',
      transition: 'all 0.22s ease',
    } : {}),
  };

  const overlayStyle = {
    ...S.overlay,
    ...(closing ? {
      animation: 'none',
      opacity: 0,
      transition: 'opacity 0.22s ease',
    } : {}),
  };

  return (
    <div style={overlayStyle} ref={overlayRef} onClick={handleOverlayClick}>
      <div style={cardStyle} role="dialog" aria-modal="true" aria-labelledby="upm-title">

        {/* Ambient blobs */}
        <div style={S.glowTopRight}  aria-hidden="true" />
        <div style={S.glowBottomLeft} aria-hidden="true" />

        {/* Close */}
        <button
          className="upm-close"
          style={S.closeBtn}
          onClick={handleSnooze}
          aria-label="Close"
        >
          ×
        </button>

        <div style={S.body}>

          {/* Crown icon */}
          <div style={S.crownWrap} aria-hidden="true">
            <div style={S.crownRing}>
              <span style={S.crownEmoji}>👑</span>
            </div>
          </div>

          {/* Headline */}
          <h2 style={S.headline} id="upm-title">
            Unlock the Full&nbsp;SoShoLife&nbsp;Experience
          </h2>
          <p style={S.subline}>
            You're one step away from earning real money through referrals,
            getting verified, and unlocking every reward milestone.
          </p>

          {/* Benefits */}
          <ul style={S.benefits} aria-label="Premium benefits">
            {BENEFITS.map((b, i) => (
              <li key={i} className="upm-benefit" style={S.benefitItem}>
                <div style={{ ...S.benefitIconWrap, background: b.color }}>
                  {b.icon}
                </div>
                <div style={S.benefitText}>
                  <div style={S.benefitTitle}>{b.title}</div>
                  <div style={S.benefitDesc}>{b.desc}</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Referral progress teaser */}
          {referred > 0 && referred < target && (
            <div style={S.urgencyStrip} aria-live="polite">
              <div style={S.urgencyDot} aria-hidden="true" />
              <span style={S.urgencyText}>
                You've already referred {referred}/{target} friends — subscribe to claim your reward!
              </span>
            </div>
          )}

          {referred === 0 && (
            <div style={S.urgencyStrip}>
              <div style={S.urgencyDot} aria-hidden="true" />
              <span style={S.urgencyText}>
                Limited access mode active — upgrade to remove all restrictions
              </span>
            </div>
          )}

          {/* CTA */}
          <button
            className="upm-cta"
            style={S.ctaBtn}
            onClick={handleUpgrade}
          >
            🚀&nbsp;&nbsp;Upgrade Now — Start Earning
          </button>

          {/* Secondary */}
          <div style={S.secondaryRow}>
            <button
              className="upm-snooze"
              style={S.snoozeBtn}
              onClick={handleSnooze}
            >
              {dismissToday ? "Won't show today ✓" : 'Maybe Later'}
            </button>
          </div>

          {/* Dismiss for today */}
          <label style={S.dismissRow} htmlFor="upm-dismiss-check">
            <input
              id="upm-dismiss-check"
              type="checkbox"
              style={S.dismissCheck}
              checked={dismissToday}
              onChange={(e) => setDismissToday(e.target.checked)}
            />
            <span style={S.dismissLabel}>Don't show again today</span>
          </label>

        </div>
      </div>
    </div>
  );
};

export default UpgradePromptModal;