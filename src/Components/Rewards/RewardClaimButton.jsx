// src/components/Rewards/RewardClaimButton.jsx
//
// Drop-in claim button with built-in eligibility enforcement.
//
// Replaces any existing "Claim" button in streak, referral, and post reward UIs.
// Shows a gate tooltip / popover when the user is not eligible.
// Calls the provided onClaim() handler only when eligibility passes client-side.
// Handles structured server errors from requireRewardEligibility middleware.
//
// Props:
//   onClaim      — async () => any  — actual claim function (called when eligible)
//   label        — button label (default: "Claim Reward")
//   claimed      — if true, renders a "Claimed" state (non-interactive)
//   disabled     — additional disabled condition (e.g. milestone not reached)
//   disabledTip  — tooltip for the milestone-not-reached state
//   size         — 'sm' | 'md' | 'lg' (default 'md')
//   variant      — 'primary' | 'outline' (default 'primary')
//   className    — extra CSS class
//   onSuccess    — called with claim result on success
//   onError      — called with error message on failure

import React, { useState, useRef, useEffect, useCallback } from 'react';
// import { useNavigate } from 'react-router-dom';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';
import FloatingEligibilityPopover from "./EligibilityPopover";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

/* ── Icons ───────────────────────────────────────────────────────────────────── */
const LockIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const SpinnerIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 0.8s linear infinite' }}>
    <circle cx="12" cy="12" r="10" opacity="0.25" />
    <path d="M12 2a10 10 0 0 1 10 10" />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ── Size configs ─────────────────────────────────────────────────────────────── */
const SIZE = {
  sm: { padding: '5px 12px', fontSize: '12px', borderRadius: '7px', minWidth: '90px' },
  md: { padding: '8px 18px', fontSize: '13px', borderRadius: '9px', minWidth: '120px' },
  lg: { padding: '11px 24px', fontSize: '14px', borderRadius: '10px', minWidth: '150px' },
};

/* ── Eligibility popover ─────────────────────────────────────────────────────── */
// function EligibilityPopover({ kycGate, subscriptionGate, blockerCode, onClose }) {
//   const navigate = useNavigate();

//   const items = [];
//   if (!kycGate.passed) {
//     items.push({
//       key:      'kyc',
//       message:  kycGate.message,
//       ctaLabel: kycGate.ctaLabel,
//       ctaPath:  kycGate.ctaPath,
//       color:    kycGate.status === 'submitted' ? '#2563eb' : '#dc2626',
//     });
//   }
//   if (!subscriptionGate.passed) {
//     items.push({
//       key:      'sub',
//       message:  subscriptionGate.message,
//       ctaLabel: subscriptionGate.ctaLabel,
//       ctaPath:  subscriptionGate.ctaPath,
//       color:    '#f59e0b',
//     });
//   }

//   return (
//     <div style={{
//       position:     'absolute',
//       bottom:       'calc(100% + 8px)',
//       left:         '50%',
//       transform:    'translateX(-50%)',
//       width:        '260px',
//       background:   '#ffffff',
//       border:       '1px solid #e5e7eb',
//       borderRadius: '12px',
//       boxShadow:    '0 10px 25px rgba(0,0,0,0.12)',
//       zIndex:       1000,
//       padding:      '14px',
//     }}>
//       {/* Caret */}
//       <div style={{
//         position:   'absolute',
//         bottom:     '-6px',
//         left:       '50%',
//         transform:  'translateX(-50%)',
//         width:      '12px',
//         height:     '12px',
//         background: '#ffffff',
//         border:     '1px solid #e5e7eb',
//         borderTop:  'none',
//         borderLeft: 'none',
//         rotate:     '45deg',
//       }} />

//       <p style={{ margin: '0 0 10px', fontSize: '12px', fontWeight: 700, color: '#111827' }}>
//         🔒 Rewards locked
//       </p>

//       {items.map(item => (
//         <div key={item.key} style={{ marginBottom: '10px' }}>
//           <p style={{ margin: '0 0 4px', fontSize: '12px', color: '#374151', lineHeight: '1.4' }}>
//             {item.message}
//           </p>
//           {item.ctaPath && (
//             <button
//               onClick={() => { navigate(item.ctaPath); onClose(); }}
//               style={{
//                 padding:      '4px 10px',
//                 background:   item.color,
//                 color:        '#ffffff',
//                 border:       'none',
//                 borderRadius: '6px',
//                 fontSize:     '11px',
//                 fontWeight:   600,
//                 cursor:       'pointer',
//               }}
//             >
//               {item.ctaLabel} →
//             </button>
//           )}
//         </div>
//       ))}
//     </div>
//   );
// }

/* ── Main component ───────────────────────────────────────────────────────────── */
export function RewardClaimButton({
  onClaim,
  label = 'Claim Reward',
  claimed = false,
  disabled = false,
  disabledTip = '',
  size = 'md',
  variant = 'primary',
  className = '',
  onSuccess,
  onError,
}) {
  const {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
    blockerMessage,
    parseClaimError,
  } = useRewardEligibility();

  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [justClaimed, setJustClaimed] = useState(false);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e) => {
      if (!popoverRef.current?.contains(e.target) && !buttonRef.current?.contains(e.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showPopover]);

  useEffect(() => {
    if (justClaimed) {
      confetti({
        particleCount: 120,
        spread: 90,
        startVelocity: 30,
        gravity: 0.8,
        ticks: 200,
        origin: { y: 0.6 },
      });
    }
  }, [justClaimed]);

  const handleClick = useCallback(async () => {
    // Not eligible — show popover
    if (!eligible) {
      setShowPopover(prev => !prev);
      return;
    }

    // Milestone not yet reached
    if (disabled) return;

    // Already claimed
    if (claimed) return;

    setLoading(true);
    setShowPopover(false);

    try {
      const result = await onClaim();
      setJustClaimed(true);

      setTimeout(() => setJustClaimed(false), 2500);
      if (typeof onSuccess === 'function') onSuccess(result);
    } catch (err) {
      const message = parseClaimError(err);
      if (typeof onError === 'function') onError(message);
      // If the server returned an eligibility error, show the popover
      const code = err?.response?.data?.code;
      if (code && ['KYC_NOT_VERIFIED', 'SUBSCRIPTION_REQUIRED', 'KYC_AND_SUBSCRIPTION', 'REWARDS_FROZEN'].includes(code)) {
        setShowPopover(true);
      }
    } finally {
      setLoading(false);
    }
  }, [eligible, disabled, claimed, onClaim, parseClaimError, onSuccess, onError]);

  const sz = SIZE[size] ?? SIZE.md;

  // ── Claimed state ────────────────────────────────────────────────────────
  if (claimed || justClaimed) {
    return (
      <motion.button
        disabled
        className={className}
        style={{
          ...sz,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#f3f4f6',
          color: '#6b7280',
          border: '1px solid #e5e7eb',
          cursor: 'default',
          fontWeight: 600,
        }}
      >
        <CheckIcon />
        Claimed
      </motion.button>
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <motion.button
        disabled
        className={className}
        style={{
          ...sz,
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          background: '#111827',
          color: '#ffffff',
          border: 'none',
          cursor: 'wait',
          fontWeight: 600,
        }}
      >
        <SpinnerIcon />
        Claiming…
      </motion.button>
    );
  }

  // ── Checking eligibility ─────────────────────────────────────────────────
  if (checking) {
    return (
      <button
        disabled
        className={className}
        style={{
          ...sz,
          background: '#f3f4f6',
          color: '#9ca3af',
          border: '1px solid #e5e7eb',
          cursor: 'wait',
          fontWeight: 600,
        }}
      >
        …
      </button>
    );
  }

  // ── Milestone not reached (disabled by parent) ───────────────────────────
  if (disabled) {
    return (
      <button
        disabled
        title={disabledTip}
        className={className}
        style={{
          ...sz,
          background: '#f3f4f6',
          color: '#9ca3af',
          border: '1px solid #e5e7eb',
          cursor: 'not-allowed',
          fontWeight: 600,
        }}
      >
        {label}
      </button>
    );
  }

  // ── Not eligible — locked button + popover ───────────────────────────────
  if (!eligible) {
    return (
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <motion.button
          ref={buttonRef}
          onClick={handleClick}
          className={className}
          title={blockerMessage}
          style={{
            ...sz,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: '#f3f4f6',
            color: '#9ca3af',
            border: '1px solid #e5e7eb',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          <LockIcon />
          {label}
        </motion.button>

        {showPopover && (
          <motion.div ref={popoverRef}>
            <FloatingEligibilityPopover
              kycGate={kycGate}
              subscriptionGate={subscriptionGate}
              blockerCode={blockerCode}
              onClose={() => setShowPopover(false)}
            />
          </motion.div>
        )}
      </div>
    );
  }

  // ── Eligible — active button ─────────────────────────────────────────────
  const primaryStyle = {
    ...sz,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: '#111827',
    color: '#ffffff',
    border: 'none',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.15s',
  };

  const outlineStyle = {
    ...sz,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    background: 'transparent',
    color: '#111827',
    border: '1.5px solid #111827',
    cursor: 'pointer',
    fontWeight: 600,
    transition: 'background 0.15s',
  };

  return (
    <motion.button
      onClick={handleClick}
      className={className}
      style={variant === 'outline' ? outlineStyle : primaryStyle}
    >
      {label}
    </motion.button>
  );
}

export default RewardClaimButton;