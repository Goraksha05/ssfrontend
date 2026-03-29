// src/components/Rewards/RewardEligibilityStatus.jsx
//
// Full-featured eligibility status card for the rewards page.
// Shows KYC status + subscription status as progress steps,
// with actionable CTAs for each incomplete gate.
//
// Props:
//   compact      — if true, renders a slim inline status bar (default false)
//   className    — additional CSS class (optional)
//   onDismiss    — called when the user dismisses the banner (optional, adds X button)

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';
import { KYC_STATUSES }          from '../../Context/KYC/KycContext';

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */
const CheckCircle = ({ size = 20, color = '#16a34a' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="9 12 11 14 15 10" />
  </svg>
);

const XCircle = ({ size = 20, color = '#dc2626' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="9" y1="9" x2="15" y2="15" />
    <line x1="15" y1="9" x2="9" y2="15" />
  </svg>
);

const ClockCircle = ({ size = 20, color = '#2563eb' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 7 12 12 15 14" />
  </svg>
);

const GiftIcon = ({ size = 24, color = '#16a34a' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 12 20 22 4 22 4 12" />
    <rect x="2" y="7" width="20" height="5" />
    <line x1="12" y1="22" x2="12" y2="7" />
    <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
    <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
  </svg>
);

const ShieldIcon = ({ size = 20, color = '#6b7280' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const CreditCard = ({ size = 20, color = '#6b7280' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
    <line x1="1" y1="10" x2="23" y2="10" />
  </svg>
);

const LockIcon = ({ size = 20, color = '#9ca3af' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/* ── Helpers ─────────────────────────────────────────────────────────────────── */
function kycStatusDisplay(status) {
  const map = {
    [KYC_STATUSES.NOT_STARTED]: { label: 'Not started',    color: '#9ca3af', icon: <XCircle color="#9ca3af" /> },
    [KYC_STATUSES.REQUIRED]:    { label: 'Required',        color: '#dc2626', icon: <XCircle color="#dc2626" /> },
    [KYC_STATUSES.SUBMITTED]:   { label: 'Under review',    color: '#2563eb', icon: <ClockCircle color="#2563eb" /> },
    [KYC_STATUSES.REJECTED]:    { label: 'Rejected',        color: '#dc2626', icon: <XCircle color="#dc2626" /> },
    [KYC_STATUSES.VERIFIED]:    { label: 'Verified ✓',      color: '#16a34a', icon: <CheckCircle color="#16a34a" /> },
  };
  return map[status] ?? map[KYC_STATUSES.NOT_STARTED];
}

/* ── Eligible state ──────────────────────────────────────────────────────────── */
function EligibleBanner() {
  return (
    <div style={{
      display:       'flex',
      alignItems:    'center',
      gap:           '12px',
      padding:       '14px 18px',
      background:    'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
      border:        '1px solid #86efac',
      borderRadius:  '12px',
    }}>
      <GiftIcon size={22} color="#16a34a" />
      <div>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '14px', color: '#14532d' }}>
          You&apos;re eligible to claim rewards!
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#16a34a' }}>
          KYC verified · Active subscription
        </p>
      </div>
    </div>
  );
}

/* ── Step row ─────────────────────────────────────────────────────────────────── */
function StepRow({ icon, label, statusIcon, statusLabel, statusColor, ctaLabel, onCta, isLast }) {
  return (
    <div style={{
      display:        'flex',
      alignItems:     'center',
      gap:            '12px',
      padding:        '12px 0',
      borderBottom:   isLast ? 'none' : '1px solid #f3f4f6',
    }}>
      {/* Step icon */}
      <div style={{
        width:          '36px',
        height:         '36px',
        borderRadius:   '50%',
        background:     '#f9fafb',
        border:         '1px solid #e5e7eb',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        flexShrink:     0,
      }}>
        {icon}
      </div>

      {/* Label */}
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#111827' }}>
          {label}
        </p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', color: statusColor }}>
          {statusLabel}
        </p>
      </div>

      {/* Status icon + optional CTA */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {statusIcon}
        {onCta && (
          <button
            onClick={onCta}
            style={{
              padding:      '5px 12px',
              background:   '#111827',
              color:        '#ffffff',
              border:       'none',
              borderRadius: '7px',
              fontSize:     '12px',
              fontWeight:   600,
              cursor:       'pointer',
            }}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Compact status bar ───────────────────────────────────────────────────────── */
function CompactStatusBar({ kycGate, subscriptionGate, eligible, checking, blockerCode }) {
  const navigate = useNavigate();

  if (checking) {
    return (
      <div style={{
        padding:      '8px 14px',
        background:   '#f9fafb',
        borderRadius: '8px',
        fontSize:     '13px',
        color:        '#9ca3af',
        textAlign:    'center',
      }}>
        Checking eligibility…
      </div>
    );
  }

  if (eligible) {
    return (
      <div style={{
        display:      'flex',
        alignItems:   'center',
        gap:          '8px',
        padding:      '8px 14px',
        background:   '#f0fdf4',
        border:       '1px solid #86efac',
        borderRadius: '8px',
        fontSize:     '13px',
        color:        '#15803d',
        fontWeight:   600,
      }}>
        <CheckCircle size={16} color="#16a34a" />
        Eligible to claim rewards
      </div>
    );
  }

  // Primary blocker: KYC navigates to route; subscription opens modal
  const kycBlocked = !kycGate.passed;
  const primaryMessage = kycBlocked
    ? `${kycGate.label} · ${kycGate.ctaLabel}`
    : `${subscriptionGate.label} · ${subscriptionGate.ctaLabel}`;

  const handleFix = kycBlocked
    ? () => navigate(kycGate.ctaPath)
    : () => subscriptionGate.ctaAction?.();

  return (
    <div style={{
      display:      'flex',
      alignItems:   'center',
      gap:          '8px',
      padding:      '8px 14px',
      background:   '#fff7ed',
      border:       '1px solid #fed7aa',
      borderRadius: '8px',
    }}>
      <LockIcon size={16} color="#ea580c" />
      <span style={{ flex: 1, fontSize: '13px', color: '#9a3412', fontWeight: 500 }}>
        {primaryMessage}
      </span>
      <button
        onClick={handleFix}
        style={{
          padding:      '4px 10px',
          background:   '#ea580c',
          color:        '#ffffff',
          border:       'none',
          borderRadius: '6px',
          fontSize:     '12px',
          fontWeight:   600,
          cursor:       'pointer',
          whiteSpace:   'nowrap',
        }}
      >
        Fix now →
      </button>
    </div>
  );
}

/* ── Main export ──────────────────────────────────────────────────────────────── */
export function RewardEligibilityStatus({ compact = false, className = '', onDismiss }) {
  const navigate = useNavigate();
  const {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
  } = useRewardEligibility();

  const kycDisplay = kycStatusDisplay(kycGate.status);
  const subDisplay = subscriptionGate.passed
    ? { label: `Active — ${subscriptionGate.plan ?? 'Plan'}`, color: '#16a34a', icon: <CheckCircle color="#16a34a" /> }
    : subscriptionGate.expired
      ? { label: 'Expired — renew to claim rewards',          color: '#dc2626', icon: <XCircle color="#dc2626" /> }
      : { label: 'Inactive — subscribe to claim rewards',     color: '#9ca3af', icon: <XCircle color="#9ca3af" /> };

  if (compact) {
    return (
      <div className={className}>
        <CompactStatusBar
          kycGate={kycGate}
          subscriptionGate={subscriptionGate}
          eligible={eligible}
          checking={checking}
          blockerCode={blockerCode}
        />
      </div>
    );
  }

  return (
    <div className={className} style={{
      padding:      '20px',
      background:   '#ffffff',
      border:       '1px solid #e5e7eb',
      borderRadius: '16px',
      position:     'relative',
    }}>
      {/* Dismiss button */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          style={{
            position:   'absolute',
            top:        '14px',
            right:      '14px',
            background: 'none',
            border:     'none',
            cursor:     'pointer',
            color:      '#9ca3af',
            fontSize:   '18px',
            lineHeight: 1,
            padding:    '2px',
          }}
          aria-label="Dismiss"
        >
          ×
        </button>
      )}

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: '15px', color: '#111827' }}>
          Reward Eligibility
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#6b7280' }}>
          Both steps are required to claim any reward
        </p>
      </div>

      {checking ? (
        <div style={{ padding: '16px 0', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
          Checking eligibility…
        </div>
      ) : eligible ? (
        <EligibleBanner />
      ) : (
        <>
          {/* Step rows */}
          <StepRow
            icon={<ShieldIcon size={18} color="#6b7280" />}
            label="KYC Verification"
            statusIcon={kycDisplay.icon}
            statusLabel={kycDisplay.label}
            statusColor={kycDisplay.color}
            ctaLabel={kycGate.ctaLabel}
            onCta={kycGate.passed ? null : () => navigate(kycGate.ctaPath)}
            isLast={false}
          />
          <StepRow
            icon={<CreditCard size={18} color="#6b7280" />}
            label="Subscription"
            statusIcon={subDisplay.icon}
            statusLabel={subDisplay.label}
            statusColor={subDisplay.color}
            ctaLabel={subscriptionGate.ctaLabel}
            onCta={subscriptionGate.passed ? null : () => subscriptionGate.ctaAction?.()}
            isLast={true}
          />

          {/* Summary message */}
          {blockerCode && (
            <div style={{
              marginTop:    '16px',
              padding:      '12px',
              background:   '#fafafa',
              border:       '1px solid #f3f4f6',
              borderRadius: '10px',
              fontSize:     '13px',
              color:        '#6b7280',
              lineHeight:   '1.5',
            }}>
              {blockerCode === 'KYC_AND_SUBSCRIPTION' &&
                'Complete both KYC verification and subscribe to a plan to start claiming your earned rewards.'}
              {blockerCode === 'KYC_NOT_VERIFIED' && kycGate.message}
              {blockerCode === 'SUBSCRIPTION_REQUIRED' && subscriptionGate.message}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default RewardEligibilityStatus;