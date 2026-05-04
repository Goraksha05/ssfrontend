/**
 * hooks/useSpecialOfferEligibility.js
 *
 * KYC-gate hook for the Special Offer system.
 *
 * ── Usage ─────────────────────────────────────────────────────────────────────
 *   const { kycVerified, canWithdraw, kycGate } = useSpecialOfferEligibility();
 *
 *   // Storybook / unit tests — bypass all contexts:
 *   const eligibility = useSpecialOfferEligibility({ overrideUser: mockUser });
 *
 * ── Return shape ──────────────────────────────────────────────────────────────
 *   kycVerified:   boolean      — true when status === 'verified'
 *   canWithdraw:   boolean      — alias for kycVerified
 *   canEarn:       boolean      — always true (earning never requires KYC)
 *   kycStatus:     string       — live status string
 *   kycMessage:    string|null  — human-readable gate message
 *   kycLabel:      string       — short label for badges
 *   kycCtaLabel:   string       — CTA button text
 *   kycCtaPath:    string       — CTA navigation target
 *   kycSeverity:   'none'|'info'|'warning'|'error'
 *   kycGate:       object       — full gate descriptor (see resolveKycGate)
 *   _kycSource:    string       — 'override'|'kycContext'|'authContext'|'default'
 */

import { useContext, useMemo } from 'react';
import { useAuth }   from '../Context/Authorisation/AuthContext';
import KycContext    from '../Context/KYC/KycContext';

// ── KYC status constants ──────────────────────────────────────────────────────

export const KYC_STATUS = Object.freeze({
  NOT_STARTED: 'not_started',
  REQUIRED:    'required',
  SUBMITTED:   'submitted',
  VERIFIED:    'verified',
  REJECTED:    'rejected',
});

const VALID_STATUSES = new Set(Object.values(KYC_STATUS));

// ── Static config per status ──────────────────────────────────────────────────

const STATUS_CONFIG = {
  [KYC_STATUS.NOT_STARTED]: {
    severity:     'warning',
    label:        'KYC required',
    message:      'Complete KYC verification to withdraw your approved Special Offer rewards. You can still earn now.',
    ctaLabel:     'Start KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
  [KYC_STATUS.REQUIRED]: {
    severity:     'warning',
    label:        'KYC required',
    message:      'KYC verification is required before you can withdraw rewards. You can still earn now.',
    ctaLabel:     'Complete KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
  [KYC_STATUS.SUBMITTED]: {
    severity:     'info',
    label:        'KYC under review',
    message:      'Your documents are under review. Withdrawal unlocks once approved — usually 1–2 business days. You can still earn now.',
    ctaLabel:     'Check status',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: false,
  },
  [KYC_STATUS.VERIFIED]: {
    severity:     'none',
    label:        'KYC verified',
    message:      null,
    ctaLabel:     'View KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: false,
  },
  [KYC_STATUS.REJECTED]: {
    severity:     'error',
    label:        'KYC rejected',
    message:      'Your KYC was not approved. Resubmit your documents to enable withdrawals. You can still earn now.',
    ctaLabel:     'Resubmit KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
};

// ── Pure resolver (exported for unit tests) ───────────────────────────────────

/**
 * Derive all gate values from a raw KYC status string.
 * This is a pure function — safe to call in tests without React.
 *
 * @param {string|null|undefined} rawStatus
 * @param {'override'|'kycContext'|'authContext'|'default'} source
 * @returns {object}
 */
export function resolveKycGate(rawStatus, source = 'default') {
  const status = VALID_STATUSES.has(rawStatus)
    ? rawStatus
    : KYC_STATUS.NOT_STARTED;

  const cfg         = STATUS_CONFIG[status];
  const kycVerified = status === KYC_STATUS.VERIFIED;

  return {
    kycVerified,
    canWithdraw:  kycVerified,
    // Earning never requires KYC — the 12-hour window is independent of it.
    canEarn:      true,

    kycStatus:    status,
    kycMessage:   cfg.message,
    kycLabel:     cfg.label,
    kycCtaLabel:  cfg.ctaLabel,
    kycCtaPath:   cfg.ctaPath,
    kycSeverity:  cfg.severity,

    // Full gate object — useful for rendering alert banners generically.
    kycGate: {
      passed:       kycVerified,
      status,
      label:        cfg.label,
      message:      cfg.message,
      ctaLabel:     cfg.ctaLabel,
      ctaPath:      cfg.ctaPath,
      ctaAttention: cfg.ctaAttention,
      severity:     cfg.severity,
    },

    _kycSource: source,
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * @param {object}      [opts]
 * @param {object|null} [opts.overrideUser]  Bypass all contexts (tests/Storybook).
 */
export function useSpecialOfferEligibility(opts = {}) {
  // ── Always call hooks unconditionally (React rules) ───────────────────────
  const { userKycStatus } = useAuth();

  const kycCtx       = useContext(KycContext);
  const kycCtxStatus = kycCtx?.status ?? null;

  return useMemo(() => {
    // 1. Explicit override (Storybook / unit tests) — skip all contexts.
    if (opts.overrideUser !== undefined) {
      const status = opts.overrideUser?.kyc?.status ?? null;
      return resolveKycGate(status, 'override');
    }

    // 2. KycContext — always the freshest source.
     if (kycCtxStatus) {
      return resolveKycGate(kycCtxStatus, 'kycContext');
    }

    // 3. AuthContext — used when KycContext is not mounted in this subtree.
    if (userKycStatus) {
      return resolveKycGate(userKycStatus, 'authContext');
    }

    // 4. No data (initial load or logged-out) — safe defaults.
    return resolveKycGate(null, 'default');

  }, [
    opts.overrideUser, // re-run when test override changes
    userKycStatus,     // re-run when KYC mutates inside the same user object
    kycCtxStatus,      // re-run on real-time socket events via KycContext
  ]);
}

export default useSpecialOfferEligibility;