/**
 * hooks/useSpecialOfferTimer.js
 *
 * Changes from previous version
 * ─────────────────────────────
 * • Removed local `getToken()` helper — token is now owned exclusively by
 *   AuthContext and injected automatically by the apiRequest interceptor.
 * • Removed custom `fetchJson()` wrapper around the native `fetch` API.
 *   All network calls now go through `apiRequest` (axios instance) so that
 *   token attachment, 401 → refresh queue, retry logic, and toast errors are
 *   handled in one place.
 * • Each exported hook that makes API calls now pulls `{ token }` from
 *   `useAuth()` and skips the fetch when no token is present (unauthenticated).
 **/

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import apiRequest from '../utils/apiRequest';
import { useAuth } from '../Context/Authorisation/AuthContext';

// ── Constants ──────────────────────────────────────────────────────────────────
const REWARD_PER_REFERRAL = 100; 
const DAILY_CAP_INR       = 1800;

const URGENCY = {
  HIGH:    'high',     
  MEDIUM:  'medium',
  LOW:     'low',     
  EXPIRED: 'expired',
};

// ── Countdown formatter ────────────────────────────────────────────────────────
/**
 * @param {number} totalSeconds
 * @returns {{ hours: number, minutes: number, seconds: number, formatted: string }}
 */
export function formatCountdown(totalSeconds) {
  const s       = Math.max(0, Math.floor(totalSeconds));
  const hours   = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const pad       = n => String(n).padStart(2, '0');
  const formatted = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return { hours, minutes, seconds, formatted };
}

// ── Urgency classifier ─────────────────────────────────────────────────────────
function classifyUrgency(isActive, secondsLeft) {
  if (!isActive || secondsLeft <= 0) return URGENCY.EXPIRED;
  if (secondsLeft < 3600)            return URGENCY.HIGH;
  if (secondsLeft < 10800)           return URGENCY.MEDIUM;
  return URGENCY.LOW;
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIMARY HOOK: useSpecialOfferTimer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} SpecialOfferTimerOptions
 * @property {number}  [pollInterval]    - Background re-fetch interval (ms). Default: 60_000.
 * @property {boolean} [includeRewards]  - Also fetch locked-rewards on mount. Default: true.
 * @property {boolean} [autoStart]       - Begin fetching immediately. Default: true.
 * @property {object}  [socket]          - Socket.IO client instance (optional).
 *   When provided, 'kyc_verified', 'kyc_rejected', and 'special_offer_reward'
 *   events are handled to update state in real time without a poll interval wait.
 */

/**
 * @typedef {Object} SpecialOfferTimerResult
 *
 * // Raw server data
 * @property {boolean}     isActive           - 12-hour window is currently open
 * @property {number}      expiresIn          - Seconds remaining (server value on last fetch)
 * @property {string|null} expiresAt          - ISO timestamp when the offer expires
 * @property {string|null} startAt            - ISO timestamp when the offer started
 * @property {number}      earned             - Total ₹ earned in the offer window
 * @property {number}      referrals          - Number of qualifying referrals
 * @property {number}      pendingCount       - Rewards awaiting admin approval
 * @property {number}      todayEarned        - ₹ earned today (IST calendar day)
 * @property {number}      dailyCap           - Daily earning cap (₹1800)
 * @property {boolean}     canEarnMore        - todayEarned < dailyCap
 * @property {number}      rewardPerReferral  - ₹100
 *
 * // Derived / formatted
 * @property {number}      countdown          - Live countdown (decrements each second)
 * @property {{ hours, minutes, seconds, formatted }} countdownParts
 * @property {string}      urgency            - 'high'|'medium'|'low'|'expired'
 * @property {number}      progressPct        - % of the 12-hour window elapsed (0–100)
 * @property {number}      dailyProgressPct   - todayEarned / dailyCap as % (0–100)
 * @property {number}      remainingToday     - ₹ user can still earn today
 *
 * // Locked rewards
 * @property {object[]}    lockedRewards
 * @property {{ total, pending, approved, rejected, totalINR }} rewardsSummary
 *
 * // Async state
 * @property {boolean}     loading
 * @property {boolean}     rewardsLoading
 * @property {string|null} error
 *
 * // Actions
 * @property {Function}    refresh
 * @property {Function}    refreshRewards
 *
 * @property {boolean}     kycVerified  - True once 'kyc_verified' socket fires or
 *                                        KYC was already verified on the initial fetch
 * @property {string|null} kycStatus    - Most recently known KYC status string
 * @property {boolean}     canWithdraw  - Alias for kycVerified (server gate)
 */

/**
 * useSpecialOfferTimer
 *
 * Full-featured hook with live countdown, urgency tier, progress bars,
 * optional locked-rewards fetch, and real-time KYC gate updates.
 *
 * @param {SpecialOfferTimerOptions} [options]
 * @returns {SpecialOfferTimerResult}
 */
export function useSpecialOfferTimer(options = {}) {
  const {
    pollInterval   = 60_000,
    includeRewards = true,
    autoStart      = true,
    socket         = null,
  } = options;

  // Token comes from AuthContext — the single source of truth.
  // apiRequest attaches it automatically via the request interceptor,
  // but we read it here so we can skip fetches when the user is logged out.
  const { token } = useAuth();

  // ── Raw offer status ───────────────────────────────────────────────────────
  const [raw, setRaw] = useState({
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
  });

  // ── Locked rewards ─────────────────────────────────────────────────────────
  const [lockedRewards,  setLockedRewards]  = useState([]);
  const [rewardsSummary, setRewardsSummary] = useState({
    total: 0, pending: 0, approved: 0, rejected: 0, totalINR: 0,
  });

  // ── Async state ────────────────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(autoStart);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [error,          setError]          = useState(null);

  // ── Live countdown ─────────────────────────────────────────────────────────
  const [countdown, setCountdown] = useState(0);

  // ── KYC gate state ─────────────────────────────────────────────────────────
  const [kycStatus,   setKycStatus]   = useState(null);
  const [kycVerified, setKycVerified] = useState(false);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mountedRef = useRef(true);
  const timerRef   = useRef(null);
  const pollRef    = useRef(null);

  // ── Fetch offer status ─────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!token) return; // not authenticated — skip
    try {
      const { data } = await apiRequest.get('/api/special-offer/status');
      if (!mountedRef.current) return;
      setRaw(data);
      setCountdown(data.expiresIn ?? 0);
      setError(null);
    } catch (err) {
      if (mountedRef.current) setError(err.response?.data?.message ?? err.message);
    }
  }, [token]);

  // ── Fetch locked rewards ───────────────────────────────────────────────────
  const fetchLockedRewards = useCallback(async () => {
    if (!token) return; // not authenticated — skip
    setRewardsLoading(true);
    try {
      const { data } = await apiRequest.get('/api/special-offer/locked-rewards');
      if (!mountedRef.current) return;
      setLockedRewards(data.rewards ?? []);
      setRewardsSummary(data.summary ?? {});
    } catch {
      // non-fatal — toast already shown by apiRequest interceptor
    } finally {
      if (mountedRef.current) setRewardsLoading(false);
    }
  }, [token]);

  // ── Combined refresh ───────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const calls = [fetchStatus()];
    if (includeRewards) calls.push(fetchLockedRewards());
    await Promise.allSettled(calls);
  }, [fetchStatus, fetchLockedRewards, includeRewards]);

  const refreshRewards = useCallback(() => fetchLockedRewards(), [fetchLockedRewards]);

  // ── Initial fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!autoStart) return;

    (async () => {
      setLoading(true);
      await refresh();
      if (mountedRef.current) setLoading(false);
    })();

    return () => {
      mountedRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Live countdown timer ───────────────────────────────────────────────────
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!raw.isActive || countdown <= 0) return;

    timerRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          if (mountedRef.current) fetchStatus();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [raw.isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Background polling ─────────────────────────────────────────────────────
  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (!raw.isActive || pollInterval <= 0) return;

    pollRef.current = setInterval(() => {
      if (mountedRef.current) fetchStatus();
    }, pollInterval);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [raw.isActive, pollInterval, fetchStatus]);

  // ── Socket: kyc_verified ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (!mountedRef.current) return;
      setKycVerified(true);
      setKycStatus('verified');
      fetchStatus();
      if (includeRewards) fetchLockedRewards();
    };

    socket.on('kyc_verified', handler);
    return () => { socket.off('kyc_verified', handler); };
  }, [socket, fetchStatus, fetchLockedRewards, includeRewards]);

  // ── Socket: kyc_rejected ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (!mountedRef.current) return;
      setKycVerified(false);
      setKycStatus('rejected');
    };

    socket.on('kyc_rejected', handler);
    return () => { socket.off('kyc_rejected', handler); };
  }, [socket]);

  // ── Socket: special_offer_reward ──────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (mountedRef.current) refresh();
    };

    socket.on('special_offer_reward', handler);
    return () => { socket.off('special_offer_reward', handler); };
  }, [socket, refresh]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const countdownParts = useMemo(() => formatCountdown(countdown), [countdown]);

  const urgency = useMemo(
    () => classifyUrgency(raw.isActive, countdown),
    [raw.isActive, countdown]
  );

  const progressPct = useMemo(() => {
    if (!raw.isActive || !raw.startAt || !raw.expiresAt) return 0;
    const total   = new Date(raw.expiresAt) - new Date(raw.startAt);
    const elapsed = Date.now() - new Date(raw.startAt);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [raw.isActive, raw.startAt, raw.expiresAt]);

  const dailyProgressPct = useMemo(() => {
    const cap = raw.dailyCap || DAILY_CAP_INR;
    return Math.min(100, Math.round(((raw.todayEarned || 0) / cap) * 100));
  }, [raw.todayEarned, raw.dailyCap]);

  const remainingToday = useMemo(
    () => Math.max(0, (raw.dailyCap || DAILY_CAP_INR) - (raw.todayEarned || 0)),
    [raw.todayEarned, raw.dailyCap]
  );

  return {
    // Raw server fields
    ...raw,

    // Derived / formatted
    countdown,
    countdownParts,
    urgency,
    progressPct,
    dailyProgressPct,
    remainingToday,

    // Rewards
    lockedRewards,
    rewardsSummary,

    // Async state
    loading,
    rewardsLoading,
    error,

    // Actions
    refresh,
    refreshRewards,

    // KYC gate
    kycVerified,
    kycStatus,
    canWithdraw: kycVerified,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// BADGE HOOK: useSpecialOfferBadge
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Minimal hook for Navbar / bottom-tab badge indicators.
 * Fetches offer status once on mount; no countdown timer, no polling.
 *
 * @returns {{
 *   isActive:     boolean,
 *   pendingCount: number,
 *   expiresIn:    number,
 *   urgency:      string,
 *   loading:      boolean,
 * }}
 */
export function useSpecialOfferBadge() {
  const { token } = useAuth();

  const [isActive,     setIsActive]     = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [expiresIn,    setExpiresIn]    = useState(0);
  const [loading,      setLoading]      = useState(true);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!token) {
      setLoading(false);
      return;
    }

    apiRequest.get('/api/special-offer/status', { _silent: true })
      .then(({ data }) => {
        if (!mountedRef.current) return;
        setIsActive(data.isActive ?? false);
        setPendingCount(data.pendingCount ?? 0);
        setExpiresIn(data.expiresIn ?? 0);
      })
      .catch(() => { /* badge is non-critical — fail silently */ })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });

    return () => { mountedRef.current = false; };
  }, [token]);

  const urgency = useMemo(
    () => classifyUrgency(isActive, expiresIn),
    [isActive, expiresIn]
  );

  return { isActive, pendingCount, expiresIn, urgency, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION HOOK: useWithdraw
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} WithdrawOptions
 * @property {Function} [onSuccess]  - Called with server response on success.
 * @property {Function} [onError]    - Called with the Error object on failure.
 * @property {object}   [socket]     - Socket.IO client instance (optional).
 *   When provided, listens for 'kyc_verified' to unlock the withdraw button
 *   in real time if the admin approves KYC while the withdrawal modal is open.
 */

/**
 * useWithdraw
 *
 * Encapsulates the POST /api/special-offer/withdraw mutation.
 * Designed to be used inside a withdrawal modal or form component.
 *
 * @param {WithdrawOptions} [options]
 * @returns {{
 *   withdraw:       (bankDetails?: object) => Promise<void>,
 *   isWithdrawing:  boolean,
 *   error:          string | null,
 *   response:       object | null,
 *   reset:          () => void,
 *   kycVerified:    boolean,
 *   kycStatus:      string | null,
 *   canWithdraw:    boolean,
 * }}
 */
export function useWithdraw(options = {}) {
  const { onSuccess, onError, socket = null } = options;
  const { token } = useAuth();

  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [error,         setError]         = useState(null);
  const [response,      setResponse]      = useState(null);

  // ── KYC gate state ────────────────────────────────────────────────────────
  const [kycVerified, setKycVerified] = useState(false);
  const [kycStatus,   setKycStatus]   = useState(null);

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Socket: kyc_verified ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (!mountedRef.current) return;
      setKycVerified(true);
      setKycStatus('verified');
    };

    socket.on('kyc_verified', handler);
    return () => { socket.off('kyc_verified', handler); };
  }, [socket]);

  // ── Socket: kyc_rejected ──────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handler = () => {
      if (!mountedRef.current) return;
      setKycVerified(false);
      setKycStatus('rejected');
    };

    socket.on('kyc_rejected', handler);
    return () => { socket.off('kyc_rejected', handler); };
  }, [socket]);

  /**
   * @param {object} [bankDetails] - { accountNumber, ifscCode, panNumber }
   */
  const withdraw = useCallback(async (bankDetails) => {
    if (!token) {
      setError('Not authenticated');
      onError?.(new Error('Not authenticated'));
      return;
    }

    setIsWithdrawing(true);
    setError(null);

    try {
      const body = bankDetails ? { bankDetails } : {};
      const { data } = await apiRequest.post('/api/special-offer/withdraw', body);

      if (!mountedRef.current) return;

      setResponse(data);
      onSuccess?.(data);
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err.response?.data?.message ?? err.message;
      setError(message);
      onError?.(err);
    } finally {
      if (mountedRef.current) setIsWithdrawing(false);
    }
  }, [token, onSuccess, onError]);

  const reset = useCallback(() => {
    setError(null);
    setResponse(null);
  }, []);

  return {
    withdraw,
    isWithdrawing,
    error,
    response,
    reset,
    kycVerified,
    kycStatus,
    canWithdraw: kycVerified,
  };
}

// ── Re-exports ─────────────────────────────────────────────────────────────────
export { REWARD_PER_REFERRAL, DAILY_CAP_INR, URGENCY };