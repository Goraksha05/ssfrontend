/**
 * UpgradePrompt.js  (improved compact inline banner)
 *
 * Placement: dashboard, feed headers, profile sections — anywhere a
 * non-intrusive "upgrade nudge" is useful as a passive reminder.
 *
 * Design: refined editorial strip — dark navy with a gold accent
 * thread, tight typography, one strong CTA. Nothing cluttered.
 *
 * Props:
 *   compact  {boolean}  – ultra-thin one-liner variant (default: false)
 *   onDismiss {function} – optional; renders an ✕ icon when provided
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, X } from 'lucide-react';
import { useSubscription } from '../../Context/Subscription/SubscriptionContext';
import { useAuth }         from '../../Context/Authorisation/AuthContext';

// ── Keyframe injection (self-contained) ───────────────────────────────────────
function injectBannerStyles() {
  const id = '__upb_styles';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

    @keyframes upb_slideIn {
      from { opacity: 0; transform: translateY(-6px); }
      to   { opacity: 1; transform: translateY(0);     }
    }
    @keyframes upb_slideOut {
      from { opacity: 1; transform: translateY(0);     }
      to   { opacity: 0; transform: translateY(-6px);  }
    }
    @keyframes upb_shimmer {
      0%   { background-position: -200% center; }
      100% { background-position:  200% center; }
    }
    @keyframes upb_dotPulse {
      0%, 100% { opacity: 1;    transform: scale(1);    }
      50%      { opacity: 0.45; transform: scale(0.85); }
    }

    .upb-root {
      animation: upb_slideIn 0.3s ease forwards;
      font-family: 'DM Sans', -apple-system, sans-serif;
    }
    .upb-root.closing {
      animation: upb_slideOut 0.25s ease forwards;
    }

    .upb-cta-btn {
      background: linear-gradient(90deg, #ECB74E, #F5D08A, #ECB74E);
      background-size: 200% 100%;
      transition: background-position 0.4s ease, transform 0.18s ease, box-shadow 0.18s ease;
    }
    .upb-cta-btn:hover {
      background-position: 100% 0 !important;
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(236,183,78,0.35) !important;
    }
    .upb-cta-btn:active {
      transform: translateY(0);
    }
    .upb-dismiss-btn:hover {
      opacity: 0.8;
      background: rgba(255,255,255,0.1) !important;
    }

    /* Compact variant */
    .upb-compact-inner:hover .upb-compact-arrow {
      transform: translateX(3px);
    }
    .upb-compact-arrow {
      transition: transform 0.18s ease;
    }
  `;
  document.head.appendChild(style);
}

// ── Component ─────────────────────────────────────────────────────────────────
const UpgradePrompt = ({ compact = false, onDismiss }) => {
  const { openSubscription } = useSubscription();
  const { user }             = useAuth();
  const [closing, setClosing] = useState(false);
  const [gone,    setGone]    = useState(false);
  const timerRef = useRef(null);

  const isSubscribed = !!user?.subscription?.active;

  useEffect(() => {
    injectBannerStyles();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  // Don't render for subscribed users
  if (isSubscribed || gone) return null;

  const handleDismiss = () => {
    setClosing(true);
    timerRef.current = setTimeout(() => {
      setGone(true);
      if (onDismiss) onDismiss();
    }, 260);
  };

  const handleUpgrade = () => {
    openSubscription();
  };

  // ── Compact one-liner variant ─────────────────────────────────────────────
  if (compact) {
    return (
      <div
        className={`upb-root${closing ? ' closing' : ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 16px',
          borderRadius: '12px',
          background: 'linear-gradient(95deg, #0d1232 0%, #111828 100%)',
          border: '1px solid rgba(236,183,78,0.22)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.25)',
          margin: '8px 0',
        }}
      >
        <button
          className="upb-compact-inner"
          onClick={handleUpgrade}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
          }}
          aria-label="Upgrade to premium"
        >
          <span style={{ fontSize: '15px' }}>👑</span>
          <span style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#E8EDF8',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Unlock referral income & the verified badge
          </span>
          <ArrowRight
            size={14}
            color="#ECB74E"
            className="upb-compact-arrow"
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          />
        </button>

        {onDismiss && (
          <button
            className="upb-dismiss-btn"
            onClick={handleDismiss}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'rgba(200,210,240,0.4)',
              padding: '4px',
              borderRadius: '6px',
              marginLeft: '8px',
              flexShrink: 0,
            }}
            aria-label="Dismiss"
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  }

  // ── Standard banner (default) ─────────────────────────────────────────────
  return (
    <div
      className={`upb-root${closing ? ' closing' : ''}`}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '14px',
        padding: '16px 20px',
        borderRadius: '18px',
        background: 'linear-gradient(120deg, #0d1232 0%, #111828 60%, #0f1526 100%)',
        border: '1px solid rgba(236,183,78,0.2)',
        boxShadow:
          '0 4px 24px rgba(0,0,0,0.3), ' +
          '0 0 0 1px rgba(255,255,255,0.03) inset',
        margin: '14px 0',
        overflow: 'hidden',
      }}
      role="banner"
      aria-label="Upgrade to premium"
    >
      {/* Background texture dot */}
      <div style={{
        position: 'absolute',
        top: '-30px',
        right: '-20px',
        width: '140px',
        height: '140px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,183,78,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} aria-hidden="true" />

      {/* Left: icon + copy */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flex: 1,
        minWidth: '200px',
      }}>
        {/* Live indicator + icon */}
        <div style={{
          position: 'relative',
          width: '40px',
          height: '40px',
          borderRadius: '12px',
          background: 'rgba(236,183,78,0.12)',
          border: '1px solid rgba(236,183,78,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <Sparkles size={18} color="#ECB74E" />
          {/* Pulsing dot */}
          <span style={{
            position: 'absolute',
            top: '-4px',
            right: '-4px',
            width: '9px',
            height: '9px',
            borderRadius: '50%',
            background: '#ECB74E',
            border: '2px solid #0d1232',
            animation: 'upb_dotPulse 1.6s ease-in-out infinite',
          }} aria-hidden="true" />
        </div>

        <div>
          <div style={{
            fontSize: '14px',
            fontWeight: 700,
            color: '#FFFFFF',
            lineHeight: 1.3,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Start earning with SoShoLife Premium
          </div>
          <div style={{
            fontSize: '12.5px',
            color: 'rgba(180,195,230,0.6)',
            marginTop: '2px',
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Blue badge · Referral income · Reward milestones
          </div>
        </div>
      </div>

      {/* Right: CTA + optional dismiss */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        <button
          className="upb-cta-btn"
          onClick={handleUpgrade}
          style={{
            padding: '9px 18px',
            borderRadius: '11px',
            border: 'none',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 700,
            color: '#0d1232',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            whiteSpace: 'nowrap',
            fontFamily: "'DM Sans', sans-serif",
          }}
        >
          Upgrade Now
          <ArrowRight size={14} />
        </button>

        {onDismiss && (
          <button
            className="upb-dismiss-btn"
            onClick={handleDismiss}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'rgba(200,210,240,0.45)',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.18s ease',
            }}
            aria-label="Dismiss banner"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

export default UpgradePrompt;