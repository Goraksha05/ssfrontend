/**
 * Components/KYC/KYCStatusBanner.jsx
 *
 * A slim, dismissible banner rendered just below the navbar.
 * Only shows when kyc.status === 'required' | 'rejected'.
 * Clicking "Complete KYC" navigates to /kyc.
 *
 * Usage:
 *   Place once in your main layout, just below <Navbar />:
 *   <KYCStatusBanner />
 *
 * Depends on: KycContext, react-router-dom
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ShieldX, ArrowRight, X } from 'lucide-react';
import { useKyc } from '../../Context/KYC/KycContext';

// ── Per-status config ────────────────────────────────────────────────────────
const CONFIG = {
  required: {
    bg: 'linear-gradient(90deg, #fffbeb 0%, #fef3c7 100%)',
    border: '#fcd34d',
    icon: ShieldAlert,
    iconClr: '#d97706',
    text: 'Complete your KYC verification to unlock rewards and referrals.',
    cta: 'Start Verification',
    ctaBg: 'linear-gradient(135deg, #f59e0b, #d97706)',
  },
  rejected: {
    bg: 'linear-gradient(90deg, #fff1f2 0%, #fee2e2 100%)',
    border: '#fca5a5',
    icon: ShieldX,
    iconClr: '#dc2626',
    text: 'Your KYC was rejected. Please re-upload your documents.',
    cta: 'Resubmit Documents',
    ctaBg: 'linear-gradient(135deg, #ef4444, #dc2626)',
  },
};

const FF = "'DM Sans', 'Plus Jakarta Sans', sans-serif";

const KYCStatusBanner = () => {
  const { status, needsAction, kycData } = useKyc();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  if (!needsAction || dismissed) return null;

  const cfg = CONFIG[status] || CONFIG.required;
  const Icon = cfg.icon;
  const reason = status === 'rejected' ? kycData?.rejectionReason : null;

  /*
   * Navigate to the Profile page with the KYC tab pre-selected.
   */
  const handleCTAClick = () => {
    navigate('/profile?tab=kyc', {
      state: { openTab: 'kyc' },
    });
  };

  return (
    <div
      role="alert"
      style={{
        background: cfg.bg,
        borderBottom: `1.5px solid ${cfg.border}`,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        fontFamily: FF,
        position: 'relative',
        zIndex: 90,
        animation: 'bannerSlideDown 0.35s ease',
      }}
    >
      {/* Icon */}
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: 'rgba(255,255,255,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>
        <Icon size={17} color={cfg.iconClr} />
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          margin: 0, fontSize: 13, fontWeight: 600,
          color: '#1e293b', lineHeight: 1.4,
        }}>
          {cfg.text}
        </p>
        {reason && (
          <p style={{
            margin: '2px 0 0', fontSize: 12, color: '#dc2626',
            fontWeight: 500,
          }}>
            Reason: {reason}
          </p>
        )}
      </div>

      {/* CTA */}
      <button
        onClick={handleCTAClick}
        style={{
          display:    'inline-flex',
          alignItems: 'center',
          gap:        6,
          padding:    '7px 16px',
          borderRadius: 20,
          background: cfg.ctaBg,
          color:      '#fff',
          border:     'none',
          fontSize:   12,
          fontWeight: 700,
          fontFamily: FF,
          cursor:     'pointer',
          whiteSpace: 'nowrap',
          boxShadow:  '0 2px 8px rgba(0,0,0,0.15)',
          flexShrink: 0,
          transition: 'opacity 0.15s, transform 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
        onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {cfg.cta} <ArrowRight size={13} />
      </button>

      {/* Dismiss */}
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          background: 'none', border: 'none',
          cursor: 'pointer', padding: 4,
          color: '#94a3b8', flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={16} />
      </button>

      <style>{`
        @keyframes bannerSlideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to   { transform: translateY(0);     opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default KYCStatusBanner;