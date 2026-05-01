/**
 * context/SpecialOfferContext.jsx
 *
 * ── UPGRADE (adminKycRoutes v2 alignment) ─────────────────────────────────────
 *
 * The Special-Offer-aware KYC routes (verifyKyc / rejectSpOfferKyc) emit two
 * NEW socket events directly to the affected user's personal room:
 *
 *   'kyc_verified'  { status: 'verified', verifiedAt }
 *     Fired by verifyKyc() after setting kyc.status → 'verified' AND (if the
 *     user was referred) triggering creditReferralReward() via setImmediate.
 *
 *   'kyc_rejected'  { status: 'rejected', reason }
 *     Fired by rejectSpOfferKyc() after setting kyc.status → 'rejected'.
 *
 * This context cares about these events for two reasons:
 *
 *   a) canWithdraw gate — the withdraw() action is blocked server-side when
 *      kyc.status !== 'verified'.  If the user's KYC is approved while they
 *      have the withdrawal UI open, we want the "Withdraw" button to unlock
 *      immediately without a manual page refresh.
 *
 *   b) creditReferralReward fires inside verifyKyc → special_offer_reward is
 *      emitted to the REFERRER's socket room.  The context already handles
 *      'special_offer_reward' (calls refresh()).  But we also need the REFERRED
 *      user's context to refresh its status when their own KYC is verified —
 *      because the server recalculates canEarnMore and totalEarned after every
 *      verification.
 *
 * Changes in this version:
 *   1. Added socket listeners for 'kyc_verified' and 'kyc_rejected'.
 *   2. On 'kyc_verified': set kycVerified flag → true, re-fetch offer status
 *      (server may recalculate canEarnMore, totalEarned).
 *   3. On 'kyc_rejected': set kycVerified flag → false so withdraw UI can
 *      show a "KYC rejected — resubmit" message without waiting for refetch.
 *   4. Exposed kycVerified and kycStatus in context value so consuming
 *      components (withdraw modal, offer dashboard) can gate UI without
 *      importing useSpecialOfferEligibility separately.
 *   5. The socket prop remains optional — SSR / non-socket environments
 *      degrade gracefully.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Constants ─────────────────────────────────────────────────────────────────

/** How often (ms) to re-fetch status from the server in background. */
const POLL_INTERVAL_MS = 60_000; // 1 minute

/** Matches server constant: ₹100 per verified referral. */
export const REWARD_PER_REFERRAL = 100;

/** Matches server constant: ₹1800/day cap. */
export const DAILY_CAP_INR = 1800;

// ── Default state shapes ──────────────────────────────────────────────────────

const DEFAULT_STATUS = {
  isActive:          false,
  expiresIn:         0,
  expiresAt:         null,
  startAt:           null,
  earned:            0,
  referrals:         0,
  pendingCount:      0,
  todayEarned:       0,
  dailyCap:          DAILY_CAP_INR,
  canEarnMore:       false,
  rewardPerReferral: REWARD_PER_REFERRAL,
};

const DEFAULT_REWARDS_SUMMARY = {
  total:    0,
  pending:  0,
  approved: 0,
  rejected: 0,
  totalINR: 0,
};

// ── Context ───────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SpecialOfferContextValue
 *
 * @property {typeof DEFAULT_STATUS}          status           - Live offer status from server
 * @property {object[]}                       lockedRewards    - Individual reward records
 * @property {typeof DEFAULT_REWARDS_SUMMARY} rewardsSummary   - Aggregate counts and totals
 * @property {boolean}                        loading          - True during initial fetch
 * @property {boolean}                        rewardsLoading   - True while fetching locked rewards
 * @property {string|null}                    error            - Last fetch error, or null
 * @property {number}                         countdown        - Seconds remaining (live)
 * @property {Function}                       refresh          - Re-fetch status + rewards
 * @property {Function}                       refreshRewards   - Re-fetch locked rewards only
 * @property {Function}                       withdraw         - Submit a withdrawal request
 * @property {boolean}                        withdrawing      - True while withdraw is in-flight
 * @property {string|null}                    withdrawError    - Withdraw error message, or null
 * @property {object|null}                    lastWithdrawal   - Last successful withdrawal response
 *
 * ── NEW (adminKycRoutes v2) ───────────────────────────────────────────────────
 * @property {boolean}                        kycVerified      - True once kyc_verified socket fires
 *                                                               or KYC was already verified on load
 * @property {string}                         kycStatus        - 'not_started'|'submitted'|
 *                                                               'verified'|'rejected'|null
 */

const SpecialOfferContext = createContext(null);

// ── Auth token helper ─────────────────────────────────────────────────────────
// Used only as a last-resort fallback inside apiFetch when no tokenProp was
// passed (should not happen in production — always pass token from AuthContext).
function getAuthToken() {
  try {
    const t = localStorage.getItem('authtoken') || localStorage.getItem('token') || '';
    return (t && t !== 'null' && t !== 'undefined') ? t : '';
  } catch {
    return '';
  }
}

// ── API fetch helper ──────────────────────────────────────────────────────────
async function apiFetch(path, options = {}, tokenOverride) {
  const token = tokenOverride || getAuthToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const message = data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }

  return data;
}

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * SpecialOfferProvider
 *
 * @param {{
 *   children: React.ReactNode,
 *   socket?:  object,
 *   token?:   string | null,
 * }} props
 *
 * Always pass `token` from AuthContext:
 *   const { token } = useAuth();
 *   <SpecialOfferProvider token={token} socket={socket}>
 */
export function SpecialOfferProvider({ children, socket, token: tokenProp }) {

  // ── Core offer state ───────────────────────────────────────────────────────
  const [status,        setStatus]        = useState(DEFAULT_STATUS);
  const [lockedRewards, setLockedRewards] = useState([]);
  const [rewardsSummary, setRewardsSummary] = useState(DEFAULT_REWARDS_SUMMARY);

  const [loading,       setLoading]       = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [error,         setError]         = useState(null);
  const [statusReady,   setStatusReady]   = useState(false);
  const [countdown,     setCountdown]     = useState(0);

  const [withdrawing,   setWithdrawing]   = useState(false);
  const [withdrawError, setWithdrawError] = useState(null);
  const [lastWithdrawal, setLastWithdrawal] = useState(null);

  // ── NEW: KYC state derived from socket events ──────────────────────────────
  // Tracks whether this user's KYC has been verified (or rejected) as signalled
  // by 'kyc_verified' / 'kyc_rejected' events from the SP-offer admin routes.
  // Initialised to null (unknown) so components can distinguish "not yet loaded"
  // from "explicitly not verified".
  const [kycStatus,   setKycStatus]   = useState(null);   // null | 'submitted' | 'verified' | 'rejected' | ...
  const [kycVerified, setKycVerified] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const countdownRef = useRef(null);
  const pollRef      = useRef(null);
  const mountedRef   = useRef(true);

  const tokenRef = useRef(tokenProp);
  useEffect(() => { tokenRef.current = tokenProp; }, [tokenProp]);

  // ── Fetch offer status ─────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;

    try {
      const data = await apiFetch('/special-offer/status', {}, token);
      if (!mountedRef.current) return;

      setStatus(data);
      setCountdown(data.expiresIn ?? 0);
      setError(null);
      setStatusReady(true);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message);
      setStatusReady(true);
    }
  }, []);

  // ── Fetch locked rewards ───────────────────────────────────────────────────
  const fetchLockedRewards = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;

    setRewardsLoading(true);
    try {
      const data = await apiFetch('/special-offer/locked-rewards', {}, token);
      if (!mountedRef.current) return;

      setLockedRewards(data.rewards ?? []);
      setRewardsSummary(data.summary ?? DEFAULT_REWARDS_SUMMARY);
    } catch (err) {
      console.warn('[SpecialOfferContext] locked-rewards fetch failed:', err.message);
    } finally {
      if (mountedRef.current) setRewardsLoading(false);
    }
  }, []);

  // ── Combined refresh ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.allSettled([fetchStatus(), fetchLockedRewards()]);
  }, [fetchStatus, fetchLockedRewards]);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!tokenProp) {
      setLoading(false);
      return () => { mountedRef.current = false; };
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.allSettled([fetchStatus(), fetchLockedRewards()]);
      if (!cancelled && mountedRef.current) setLoading(false);
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenProp]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!status.isActive || countdown <= 0) return;

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
          fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [status.isActive, fetchStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background poll ────────────────────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!status.isActive) return;

    pollRef.current = setInterval(() => {
      if (mountedRef.current) fetchStatus();
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [status.isActive, fetchStatus]);

  // ── Socket: special_offer_reward ──────────────────────────────────────────
  // Emitted by creditReferralReward() to the REFERRER's room when a referred
  // user's KYC is verified via verifyKyc(). Triggers a full refresh so the
  // referrer's earned / pendingCount / canEarnMore update immediately.
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (mountedRef.current) refresh();
    };

    socket.on('special_offer_reward', handler);
    return () => { socket.off('special_offer_reward', handler); };
  }, [socket, refresh]);

  // ── Socket: kyc_verified (NEW) ────────────────────────────────────────────
  // Emitted by verifyKyc() to io.to(userId.toString()).
  // This fires on the REFERRED USER's socket (not the referrer's).
  //
  // Why this context cares:
  //   The withdraw() action is gated on kyc.status === 'verified' server-side.
  //   Without this listener, a user who has the withdrawal UI open while an
  //   admin approves their KYC would see the "Complete KYC to withdraw" banner
  //   until they manually refresh — poor UX for a time-sensitive 12-hour offer.
  //
  //   On receipt:
  //     1. Mark kycVerified → true and kycStatus → 'verified' so any component
  //        consuming this context can unlock the withdraw UI immediately.
  //     2. Re-fetch offer status — the server may update canEarnMore or
  //        totalEarned after KYC verification.
  //     3. Re-fetch locked rewards — admin may have already approved some.
  useEffect(() => {
    if (!socket) return;

    const handler = (payload) => {
      if (!mountedRef.current) return;

      // Update KYC gate flags immediately (no refetch latency)
      setKycVerified(true);
      setKycStatus('verified');

      // Re-fetch offer data — server state may have changed post-verification
      refresh();

      console.log('[SpecialOfferContext] kyc_verified received — offer state refreshed', payload);
    };

    socket.on('kyc_verified', handler);
    return () => { socket.off('kyc_verified', handler); };
  }, [socket, refresh]);

  // ── Socket: kyc_rejected (NEW) ────────────────────────────────────────────
  // Emitted by rejectSpOfferKyc() to io.to(userId.toString()).
  //
  // On receipt:
  //   1. Mark kycVerified → false, kycStatus → 'rejected'.
  //      The withdraw UI will show "KYC rejected — resubmit to unlock" without
  //      a full page refresh.
  //   2. No need to re-fetch offer status — rejection doesn't change earned /
  //      canEarnMore (user can still earn, just can't withdraw yet).
  useEffect(() => {
    if (!socket) return;

    const handler = (payload) => {
      if (!mountedRef.current) return;

      setKycVerified(false);
      setKycStatus('rejected');

      console.log(
        '[SpecialOfferContext] kyc_rejected received — withdraw gate updated:',
        payload?.reason
      );
    };

    socket.on('kyc_rejected', handler);
    return () => { socket.off('kyc_rejected', handler); };
  }, [socket]);

  // ── Withdraw ───────────────────────────────────────────────────────────────
  /**
   * Submit a withdrawal request for all approved special-offer rewards.
   *
   * @param {{ accountNumber?, ifscCode?, panNumber? }} [bankDetails]
   * @returns {Promise<{ success: boolean, message: string, amount?: number }>}
   */
  const withdraw = useCallback(async (bankDetails) => {
    const token = tokenRef.current;
    setWithdrawing(true);
    setWithdrawError(null);

    try {
      const body = bankDetails ? { bankDetails } : {};
      const data = await apiFetch('/special-offer/withdraw', {
        method: 'POST',
        body:   JSON.stringify(body),
      }, token);

      if (!mountedRef.current) return { success: true };

      setLastWithdrawal(data);
      await refresh();

      return { success: true, message: data.message, amount: data.amount };
    } catch (err) {
      if (!mountedRef.current) return { success: false, message: err.message };
      setWithdrawError(err.message);
      return { success: false, message: err.message };
    } finally {
      if (mountedRef.current) setWithdrawing(false);
    }
  }, [refresh]);

  // ── Context value ──────────────────────────────────────────────────────────
  const value = {
    // Offer state
    status,
    lockedRewards,
    rewardsSummary,

    // Loading / error
    loading,
    rewardsLoading,
    statusReady,
    error,

    // Live countdown
    countdown,

    // Actions
    refresh,
    refreshRewards: fetchLockedRewards,
    withdraw,

    // Withdraw state
    withdrawing,
    withdrawError,
    lastWithdrawal,

    // ── NEW: KYC gate state (updated in real time via socket) ─────────────
    // Components can use these directly instead of importing
    // useSpecialOfferEligibility when they are already inside this provider.
    kycVerified,   // boolean — true once 'kyc_verified' socket fires
    kycStatus,     // string|null — 'verified'|'rejected'|'submitted'|null
  };

  return (
    <SpecialOfferContext.Provider value={value}>
      {children}
    </SpecialOfferContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * useSpecialOffer
 *
 * Returns the full SpecialOffer context value.
 * Must be called inside a <SpecialOfferProvider>.
 *
 * @throws {Error} if used outside a SpecialOfferProvider
 * @returns {SpecialOfferContextValue}
 */
export function useSpecialOffer() {
  const ctx = useContext(SpecialOfferContext);
  if (!ctx) {
    throw new Error(
      'useSpecialOffer must be used inside a <SpecialOfferProvider>. ' +
      'Wrap your component tree (or just the rewards section) with it.'
    );
  }
  return ctx;
}

export default SpecialOfferContext;