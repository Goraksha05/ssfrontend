// src/components/Rewards/RewardEligibilityGate.jsx
//
// Renders a contextual gate banner when the user is not eligible to claim rewards.
// Used as a wrapper around reward claim UI — eligible users see the children,
// ineligible users see an actionable banner explaining what they need to do.
//
// Props:
//   children           — reward UI rendered when eligible
//   compact            — render a slim inline banner instead of the full card (default false)
//   showWhenEligible   — if true, render children even with the gate overlay removed (default true)
//
// Usage:
//   <RewardEligibilityGate>
//     <ClaimButton onClick={handleClaim} />
//   </RewardEligibilityGate>

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';
import { KYC_STATUSES } from '../../Context/KYC/KycContext';

// ── Icons ─────────────────────────────────────────────────────────────────────
const ShieldCheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const ShieldXIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <line x1="9" y1="9" x2="15" y2="15"/>
    <line x1="15" y1="9" x2="9" y2="15"/>
  </svg>
);

const CreditCardIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
    <line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
);

const AlertIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <line x1="12" y1="8" x2="12" y2="12"/>
    <line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <polyline points="12 6 12 12 16 14"/>
  </svg>
);

const LockIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
  </svg>
);

// ── Gate item configuration ─────────────────────────────────────────────────────
function getGateConfig(kycGate, subscriptionGate, blockerCode) {
  const items = [];

  if (!kycGate.passed) {
    const isSubmitted = kycGate.status === KYC_STATUSES.SUBMITTED;
    items.push({
      id:       'kyc',
      icon:     isSubmitted ? <ClockIcon /> : <ShieldXIcon />,
      title:    isSubmitted ? 'KYC Under Review' : 'KYC Verification Required',
      message:  kycGate.message,
      ctaPath:  kycGate.ctaPath,
      ctaLabel: kycGate.ctaLabel,
      variant:  isSubmitted ? 'pending' : 'error',
    });
  }

  if (!subscriptionGate.passed) {
    items.push({
      id:       'subscription',
      icon:     <CreditCardIcon />,
      title:    subscriptionGate.expired ? 'Subscription Expired' : 'Subscription Required',
      message:  subscriptionGate.message,
      ctaPath:  subscriptionGate.ctaPath,
      ctaLabel: subscriptionGate.ctaLabel,
      variant:  'warning',
    });
  }

  return items;
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const variantStyles = {
  error: {
    bg:         '#fff0f0',
    border:     '#fca5a5',
    icon:       '#ef4444',
    title:      '#7f1d1d',
    text:       '#991b1b',
    ctaBg:      '#ef4444',
    ctaText:    '#ffffff',
    ctaHoverBg: '#dc2626',
  },
  warning: {
    bg:         '#fffbeb',
    border:     '#fcd34d',
    icon:       '#f59e0b',
    title:      '#78350f',
    text:       '#92400e',
    ctaBg:      '#f59e0b',
    ctaText:    '#ffffff',
    ctaHoverBg: '#d97706',
  },
  pending: {
    bg:         '#eff6ff',
    border:     '#93c5fd',
    icon:       '#3b82f6',
    title:      '#1e3a5f',
    text:       '#1d4ed8',
    ctaBg:      '#3b82f6',
    ctaText:    '#ffffff',
    ctaHoverBg: '#2563eb',
  },
};

// ── GateItem — single requirement card ─────────────────────────────────────────
function GateItem({ icon, title, message, ctaPath, ctaLabel, variant, compact }) {
  const navigate  = useNavigate();
  const s         = variantStyles[variant] ?? variantStyles.error;

  if (compact) {
    return (
      <div style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '8px',
        padding:        '8px 12px',
        background:     s.bg,
        border:         `1px solid ${s.border}`,
        borderRadius:   '8px',
        fontSize:       '13px',
        color:          s.text,
      }}>
        <span style={{ color: s.icon, flexShrink: 0 }}>{icon}</span>
        <span style={{ flex: 1 }}>{message}</span>
        {ctaPath && (
          <button
            onClick={() => navigate(ctaPath)}
            style={{
              padding:      '4px 10px',
              background:   s.ctaBg,
              color:        s.ctaText,
              border:       'none',
              borderRadius: '6px',
              fontSize:     '12px',
              fontWeight:   600,
              cursor:       'pointer',
              whiteSpace:   'nowrap',
              flexShrink:   0,
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{
      padding:      '16px',
      background:   s.bg,
      border:       `1px solid ${s.border}`,
      borderRadius: '12px',
    }}>
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <div style={{
          color:      s.icon,
          flexShrink: 0,
          marginTop:  '2px',
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <p style={{
            margin:     0,
            fontWeight: 700,
            fontSize:   '14px',
            color:      s.title,
            lineHeight: '1.4',
          }}>
            {title}
          </p>
          <p style={{
            margin:    '4px 0 0',
            fontSize:  '13px',
            color:     s.text,
            lineHeight: '1.5',
          }}>
            {message}
          </p>
          {ctaPath && (
            <button
              onClick={() => navigate(ctaPath)}
              style={{
                marginTop:    '10px',
                padding:      '7px 14px',
                background:   s.ctaBg,
                color:        s.ctaText,
                border:       'none',
                borderRadius: '8px',
                fontSize:     '13px',
                fontWeight:   600,
                cursor:       'pointer',
                display:      'inline-flex',
                alignItems:   'center',
                gap:          '4px',
              }}
            >
              {ctaLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Full gate card ─────────────────────────────────────────────────────────────
function GateCard({ kycGate, subscriptionGate, blockerCode, checking }) {
  const items = getGateConfig(kycGate, subscriptionGate, blockerCode);

  return (
    <div style={{
      padding:      '20px',
      background:   '#f9fafb',
      border:       '1px solid #e5e7eb',
      borderRadius: '16px',
    }}>
      {/* Header */}
      <div style={{
        display:       'flex',
        alignItems:    'center',
        gap:           '10px',
        marginBottom:  '16px',
      }}>
        <span style={{ color: '#9ca3af' }}><LockIcon /></span>
        <div>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#111827' }}>
            Rewards Locked
          </p>
          <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
            Complete the steps below to start claiming
          </p>
        </div>
      </div>

      {/* Gate items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {checking ? (
          <div style={{
            padding:    '20px',
            textAlign:  'center',
            color:      '#9ca3af',
            fontSize:   '13px',
          }}>
            Checking eligibility…
          </div>
        ) : (
          items.map(item => (
            <GateItem key={item.id} {...item} compact={false} />
          ))
        )}
      </div>
    </div>
  );
}

// ── Compact gate strip ─────────────────────────────────────────────────────────
function CompactGate({ kycGate, subscriptionGate, blockerCode, checking }) {
  const items = getGateConfig(kycGate, subscriptionGate, blockerCode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {checking ? (
        <div style={{
          padding:    '8px 12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          fontSize:   '13px',
          color:      '#9ca3af',
        }}>
          Checking eligibility…
        </div>
      ) : (
        items.map(item => (
          <GateItem key={item.id} {...item} compact={true} />
        ))
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function RewardEligibilityGate({
  children,
  compact = false,
  showWhenEligible = true,
}) {
  const {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
  } = useRewardEligibility();

  // Still loading — render a placeholder instead of flashing the gate
  if (checking) {
    if (compact) {
      return (
        <div style={{
          padding:    '8px 12px',
          background: '#f3f4f6',
          borderRadius: '8px',
          fontSize:   '13px',
          color:      '#9ca3af',
        }}>
          Checking eligibility…
        </div>
      );
    }
    return (
      <div style={{
        padding:    '20px',
        textAlign:  'center',
        color:      '#9ca3af',
        fontSize:   '14px',
      }}>
        Checking eligibility…
      </div>
    );
  }

  if (eligible) {
    return showWhenEligible ? <>{children}</> : null;
  }

  if (compact) {
    return (
      <CompactGate
        kycGate={kycGate}
        subscriptionGate={subscriptionGate}
        blockerCode={blockerCode}
        checking={checking}
      />
    );
  }

  return (
    <GateCard
      kycGate={kycGate}
      subscriptionGate={subscriptionGate}
      blockerCode={blockerCode}
      checking={checking}
    />
  );
}

// ── useClaimWithEligibility — drop-in claim handler wrapper ───────────────────
// Wraps any existing claim function to prepend a client-side eligibility check.
// Prevents unnecessary API round-trips when the user is obviously ineligible.
//
// Usage:
//   const claim = useClaimWithEligibility(originalClaimFn, { onIneligible: toast.warn });
//
export function useClaimWithEligibility(claimFn, { onIneligible } = {}) {
  const { eligible, blockerMessage, parseClaimError } = useRewardEligibility();

  return async (...args) => {
    if (!eligible) {
      if (typeof onIneligible === 'function') onIneligible(blockerMessage);
      return { success: false, code: 'INELIGIBLE', message: blockerMessage };
    }

    try {
      const result = await claimFn(...args);
      return { success: true, result };
    } catch (err) {
      const message = parseClaimError(err);
      if (typeof onIneligible === 'function') onIneligible(message);
      return { success: false, message, raw: err };
    }
  };
}

export default RewardEligibilityGate;