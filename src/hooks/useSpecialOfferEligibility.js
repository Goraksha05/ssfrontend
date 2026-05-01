/**
 * hooks/useSpecialOfferEligibility.js
 *
 * KYC-only eligibility hook for the Special Offer system.
 *
 * ── UPGRADE (adminKycRoutes v2 alignment) ─────────────────────────────────────
 *
 * PROBLEM with previous version:
 *   The hook read `user?.kyc?.status` exclusively from AuthContext. AuthContext
 *   typically hydrates user from a login response or a /api/auth/me fetch —
 *   it does NOT re-fetch automatically when an admin approves or rejects KYC.
 *
 *   With the new Special-Offer-aware routes (verifyKyc / rejectSpOfferKyc),
 *   the server emits 'kyc_verified' / 'kyc_rejected' directly to the user's
 *   socket room.  KycContext (upgraded in parallel) listens to these events,
 *   optimistically updates its local state, and then force-fetches the
 *   canonical record.
 *
 *   If this hook continued to read only from AuthContext, the eligibility gate
 *   would stay stale (e.g. canWithdraw: false) even after the socket event
 *   updated KycContext to 'verified', creating a scenario where:
 *     • KycContext says VERIFIED   (correct, up-to-date)
 *     • AuthContext.user says SUBMITTED (stale — not yet re-fetched)
 *     • This hook said canWithdraw: false  (WRONG — blocked the withdraw UI)
 *
 * SOLUTION:
 *   1. Try to read status from KycContext first (via useKyc()).
 *      KycContext is always fresher: it reacts to socket events in real time.
 *   2. Fall back to AuthContext user.kyc.status only when KycContext is not
 *      mounted in the component tree (i.e. useKyc() throws or returns null).
 *   3. The `overrideUser` escape hatch is preserved for Storybook / tests.
 *
 * Hook call order is kept unconditional (React rules):
 *   - useAuth()  is always called (result ignored when overrideUser present)
 *   - useKycContextSafe() is always called (wraps useKyc in a try/catch via
 *     a context-nullable pattern so it never throws at the hook boundary)
 *
 * ── Dependency-array hygiene (react-hooks/exhaustive-deps) ───────────────────
 *
 *   Two rounds of ESLint warnings were fixed before arriving at the current
 *   pattern.  The lesson learned from both:
 *
 *   Round 1 — deep property chain in the dep array:
 *     `authCtx?.user?.kyc?.status` was listed alongside `authCtx?.user`.
 *     ESLint flagged the chain as "unnecessary" because it treats nested
 *     property accesses as redundant when the parent object is already tracked.
 *
 *   Round 2 — property access off a stable context object:
 *     After AuthContext exposed `userKycStatus` as a flat primitive, the dep
 *     array used `authCtx?.userKycStatus` alongside `authCtx?.user`.  ESLint
 *     flagged it again for the same underlying reason: `authCtx` is the object
 *     returned by useAuth(), and any property access off it is treated as
 *     redundant vs. the whole-object reference.
 *
 *   Final fix — destructure at the call site:
 *     `const { user: authUser, userKycStatus } = useAuth();`
 *     `const kycCtxStatus = kycCtx?.status ?? null;`
 *
 *     Each extracted name is an independent binding.  The dep array lists
 *     `authUser`, `userKycStatus`, and `kycCtxStatus` directly — no parent
 *     object in scope that ESLint can treat as "already covering" them.
 *     Zero warnings, correct reactivity, no eslint-disable comments needed.
 *
 * ── Design rationale ──────────────────────────────────────────────────────────
 *
 *   Special Offer rewards are earned during the 12-hour registration window.
 *   At that point a new user may not yet have an active subscription, so the
 *   standard useRewardEligibility gate (KYC + Subscription) is deliberately
 *   too strict here. This hook checks ONLY KYC status.
 *
 *   Gate summary:
 *     • KYC verified  → can earn AND withdraw
 *     • KYC pending   → can earn, CANNOT withdraw yet
 *     • KYC rejected  → can earn, must resubmit to unlock withdrawal
 *     • KYC missing   → can earn, must complete KYC to unlock withdrawal
 *
 * USAGE:
 *   // Simplest — reads from KycContext (preferred) or AuthContext
 *   const { kycVerified, canWithdraw, kycStatus, kycMessage, kycGate } =
 *     useSpecialOfferEligibility();
 *
 *   // With an explicit user object (Storybook / tests)
 *   const eligibility = useSpecialOfferEligibility({ overrideUser: localUser });
 *
 * RETURN VALUE:
 *   {
 *     kycVerified:     boolean   — true only when status === 'verified'
 *     canWithdraw:     boolean   — alias for kycVerified
 *     canEarn:         boolean   — always true (earning never requires KYC)
 *     kycStatus:       string    — live status string (from KycContext or AuthContext)
 *     kycMessage:      string | null
 *     kycLabel:        string
 *     kycCtaLabel:     string
 *     kycCtaPath:      string
 *     kycSeverity:     'none' | 'info' | 'warning' | 'error'
 *     kycGate:         { passed, status, label, message, ctaLabel, ctaPath,
 *                        ctaAttention, severity }
 *     // Source metadata (debugging)
 *     _kycSource:      'override' | 'kycContext' | 'authContext' | 'default'
 *   }
 */

import { useContext, useMemo } from 'react';
import { useAuth } from '../Context/Authorisation/AuthContext';
import KycContext from '../Context/KYC/KycContext'; // the context object (not the hook)
                                                    // imported directly so we can
                                                    // useContext() without throwing

// ─── KYC status constants ──────────────────────────────────────────────────────
export const SPECIAL_OFFER_KYC_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  REQUIRED:    'required',
  SUBMITTED:   'submitted',
  VERIFIED:    'verified',
  REJECTED:    'rejected',
});

const VALID_STATUSES = new Set(Object.values(SPECIAL_OFFER_KYC_STATUSES));

// ─── Severity map ─────────────────────────────────────────────────────────────
const SEVERITY_BY_STATUS = {
  not_started: 'warning',
  required:    'warning',
  submitted:   'info',
  verified:    'none',
  rejected:    'error',
};

// ─── Message / label map ──────────────────────────────────────────────────────
const CONFIG_BY_STATUS = {
  not_started: {
    label:        'KYC required',
    message:      'Complete KYC verification to withdraw your approved Special Offer rewards. You can still earn now.',
    ctaLabel:     'Start KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
  required: {
    label:        'KYC required',
    message:      'KYC verification is required before you can withdraw rewards. You can still earn now.',
    ctaLabel:     'Complete KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
  submitted: {
    label:        'KYC under review',
    message:      'Your KYC documents are under review. You can still earn rewards — withdrawal unlocks once KYC is approved (usually 1–2 business days).',
    ctaLabel:     'Check status',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: false,
  },
  verified: {
    label:        'KYC verified',
    message:      null,
    ctaLabel:     'View KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: false,
  },
  rejected: {
    label:        'KYC rejected',
    message:      'Your KYC was not approved. Please resubmit your documents to enable withdrawals. You can still earn rewards now.',
    ctaLabel:     'Resubmit KYC',
    ctaPath:      '/profile?tab=kyc',
    ctaAttention: true,
  },
};

// ─── Core resolver (pure — easy to test in isolation) ─────────────────────────
/**
 * @param {object|null|undefined} user      Full or partial user (for AuthContext path)
 * @param {string|null|undefined} kycStatus Raw status string from KycContext (takes priority)
 * @param {'override'|'kycContext'|'authContext'|'default'} source
 * @returns {object}
 */
export function resolveSpecialOfferKycGate(user, kycStatus, source = 'default') {
  // Determine the raw status from whichever source is most live
  const rawStatus = kycStatus ?? user?.kyc?.status ?? SPECIAL_OFFER_KYC_STATUSES.NOT_STARTED;

  const status = VALID_STATUSES.has(rawStatus)
    ? rawStatus
    : SPECIAL_OFFER_KYC_STATUSES.NOT_STARTED;

  const kycVerified = status === SPECIAL_OFFER_KYC_STATUSES.VERIFIED;
  const cfg         = CONFIG_BY_STATUS[status] ?? CONFIG_BY_STATUS.not_started;
  const severity    = SEVERITY_BY_STATUS[status] ?? 'warning';

  const kycGate = {
    passed:       kycVerified,
    status,
    label:        cfg.label,
    message:      cfg.message,
    ctaLabel:     cfg.ctaLabel,
    ctaPath:      cfg.ctaPath,
    ctaAttention: cfg.ctaAttention,
    severity,
  };

  return {
    kycVerified,
    canWithdraw:  kycVerified,
    canEarn:      true,            // Special Offer earning never requires KYC

    kycStatus:    status,
    kycMessage:   cfg.message,
    kycLabel:     cfg.label,
    kycCtaLabel:  cfg.ctaLabel,
    kycCtaPath:   cfg.ctaPath,
    kycSeverity:  severity,

    kycGate,

    // Source metadata — useful for debugging which data path was used
    _kycSource: source,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * @param {object}          [opts]
 * @param {object|null}     [opts.overrideUser]  Explicit user object.
 *   When provided, both AuthContext and KycContext are ignored entirely.
 *   Useful for Storybook / unit tests.
 *
 * @returns {ReturnType<typeof resolveSpecialOfferKycGate>}
 */
export function useSpecialOfferEligibility(opts = {}) {
  // ── Always call both context hooks unconditionally (React hook rules) ──────

  // AuthContext — always available anywhere in the app.
  // Destructure immediately so the dep array holds direct variable references
  // rather than property lookups off `authCtx`.  ESLint treats `authCtx?.user`
  // and `authCtx?.userKycStatus` as "unnecessary" when `authCtx` is already an
  // implicit stable reference — it knows property accesses on the same object
  // cannot change independently.  Destructuring moves each value to its own
  // named binding, which ESLint (and React) track individually.
  const { user: authUser, userKycStatus } = useAuth();

  // KycContext — may not be mounted in every subtree.
  // useContext() never throws; it returns null when there is no Provider.
  // This is safer than calling useKyc() which throws by design.
  // Extract .status to a named variable for the same reason as above.
  const kycCtx       = useContext(KycContext);
  const kycCtxStatus = kycCtx?.status ?? null;

  // ── Resolve the status and source ─────────────────────────────────────────
  return useMemo(() => {
    // 1. Explicit override (Storybook / tests) — ignore all contexts
    if (opts.overrideUser !== undefined) {
      return resolveSpecialOfferKycGate(
        opts.overrideUser,
        opts.overrideUser?.kyc?.status ?? null,
        'override'
      );
    }

    // 2. KycContext is mounted and has a status  ← preferred, most live source
    //    KycContext updates in real time via 'kyc_verified' / 'kyc_rejected'
    //    socket events (from verifyKyc / rejectSpOfferKyc admin routes), so
    //    this path reflects approval/rejection within milliseconds of the admin
    //    action, without waiting for an AuthContext re-fetch.
    if (kycCtxStatus) {
      return resolveSpecialOfferKycGate(
        null,          // user object not needed — status is already resolved
        kycCtxStatus,  // live status string from KycContext
        'kycContext'
      );
    }

    // 3. AuthContext user object — used when KycContext is not mounted
    //    (e.g. components outside the KycProvider tree such as the Navbar).
    //    This path may be up to USER_CACHE_TTL_MS (30 s) stale relative to
    //    KycContext, which is acceptable for badge-only usage.
    //    `authUser` and `userKycStatus` are destructured above so ESLint sees
    //    them as independent bindings, not property chains off a parent object.
    if (userKycStatus) {
      return resolveSpecialOfferKycGate(authUser, userKycStatus, 'authContext');
    }

    // 4. No data yet (initial load or logged-out) — return safe defaults
    return resolveSpecialOfferKycGate(null, null, 'default');

  }, [
    opts.overrideUser,
    authUser,       // re-run on login / logout (full user swap)
    userKycStatus,  // re-run when KYC status mutates inside the same user object
    kycCtxStatus,   // re-run when KycContext status changes via socket events
  ]);
}

export default useSpecialOfferEligibility;