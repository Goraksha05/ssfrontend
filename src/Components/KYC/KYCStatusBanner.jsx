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
        padding: '12px 14px',
        fontFamily: FF,
        position: 'relative',
        zIndex: 90,
        animation: 'bannerSlideDown 0.35s ease',
      }}
    >
      <div className="kyc-banner-container">

        {/* Left Section */}
        <div className="kyc-left">
          <div className="kyc-icon-box">
            <Icon size={16} color={cfg.iconClr} />
          </div>

          <div className="kyc-text">
            <p className="kyc-main-text">{cfg.text}</p>

            {reason && (
              <p className="kyc-reason">
                Reason: {reason}
              </p>
            )}
          </div>
        </div>

        {/* Right Section */}
        <div className="kyc-actions">
          <button
            onClick={handleCTAClick}
            className="kyc-btn"
          >
            {cfg.cta} <ArrowRight size={13} />
          </button>

          <button
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
            className="kyc-close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      <style>{`
      .kyc-banner-container {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .kyc-left {
        display: flex;
        flex: 1;
        min-width: 0;
      }

      .kyc-icon-box {
        width: 32px;
        height: 32px;
        border-radius: 10px;
        background: rgba(255,255,255,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }

      .kyc-text {
        display: flex;
        flex-direction: column;
      }

      .kyc-main-text {
        margin: 0;
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        line-height: 1.4;
      }

      .kyc-reason {
        margin-top: 2px;
        font-size: 12px;
        color: #dc2626;
      }

      .kyc-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }

      .kyc-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 7px 14px;
        border-radius: 18px;
        background: ${cfg.ctaBg};
        color: #fff;
        border: none;
        font-size: 12px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        transition: all 0.2s ease;
      }

      .kyc-btn:hover {
        opacity: 0.9;
        transform: translateY(-1px);
      }

      .kyc-close {
        background: none;
        border: none;
        cursor: pointer;
        color: #94a3b8;
        padding: 4px;
      }

      /* 🔥 MOBILE FIX */
      @media (max-width: 576px) {
        .kyc-banner-container {
          flex-direction: column;
          align-items: flex-start;
        }

        .kyc-actions {
          width: 100%;
          justify-content: space-between;
        }

        .kyc-btn {
          width: 50%;
          justify-content: center;
        }
      }

      @keyframes bannerSlideDown {
        from { transform: translateY(-100%); opacity: 0; }
        to   { transform: translateY(0); opacity: 1; }
      }
    `}</style>
    </div>
  );
};

export default KYCStatusBanner;