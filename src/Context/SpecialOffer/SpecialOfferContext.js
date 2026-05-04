/**
 * Context/SpecialOffer/SpecialOfferContext.js  — REFACTORED
 *
 * SINGLE SOURCE OF TRUTH for the entire Special Offer system.
 *
 * Responsibilities:
 *   • All API calls   (/status, /locked-rewards, /withdraw)
 *   • All state       (offer data, rewards, countdown, withdraw)
 *   • All sockets     (special_offer_reward, kyc_verified, kyc_rejected)
 *   • All derived UI values (countdown, urgency, progress, canWithdraw)
 *
 * What it does NOT do:
 *   • Does NOT manage KYC state (owned by KycContext)
 *   • Does NOT duplicate business logic (backend owns it)
 *   • Does NOT duplicate fetch calls (every component reads context)
 *
 * Data flow:
 *   Backend API ──► fetchStatus / fetchRewards ──► state
 *   Socket events ──► optimistic update ──► refresh() ──► state
 *   KycContext ──► kycStatus / kycVerified / canWithdraw (read-only)
 *   Components ──► useSpecialOffer() ──► derived values
 *
 * Usage:
 *   // Mount once, high in the tree (e.g. inside RewardsHub or a route wrapper):
 *   <SpecialOfferProvider>
 *     <SpecialOfferTab />
 *     <SomeOtherRewardComponent />
 *   </SpecialOfferProvider>
 *
 *   // Consume anywhere below the provider:
 *   const { countdown, urgency, withdraw, canWithdraw } = useSpecialOffer();
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useContext as useReactContext } from 'react';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../Authorisation/AuthContext';
import { onSocketEvent } from '../../WebSocket/WebSocketClient';
import KycContext from '../KYC/KycContext';

// ── Constants ─────────────────────────────────────────────────────────────────

export const REWARD_PER_REFERRAL = 100;  // ₹ — mirrors backend constant
export const DAILY_CAP_INR       = 1800; // ₹ — mirrors backend constant
export const POLL_INTERVAL_MS    = 60_000;

export const URGENCY = Object.freeze({
  HIGH:    'high',    // < 1 hour
  MEDIUM:  'medium',  // < 3 hours
  LOW:     'low',     // > 3 hours
  EXPIRED: 'expired',
});

// ── Pure helpers (exported for tests) ─────────────────────────────────────────

/**
 * @param {number} totalSeconds
 * @returns {{ hours, minutes, seconds, formatted }}
 */
export function formatCountdown(totalSeconds) {
  const s       = Math.max(0, Math.floor(totalSeconds));
  const hours   = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad     = (n) => String(n).padStart(2, '0');
  return {
    hours, minutes, seconds,
    formatted: `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`,
  };
}

/** @param {boolean} isActive @param {number} secondsLeft @returns {string} */
export function classifyUrgency(isActive, secondsLeft) {
  if (!isActive || secondsLeft <= 0) return URGENCY.EXPIRED;
  if (secondsLeft < 3_600)           return URGENCY.HIGH;
  if (secondsLeft < 10_800)          return URGENCY.MEDIUM;
  return URGENCY.LOW;
}

function isCancellation(err) {
  return (
    err?.name === 'CanceledError' ||
    err?.name === 'AbortError'    ||
    err?.code === 'ERR_CANCELED'
  );
}

// ── Default shapes ─────────────────────────────────────────────────────────────

const DEFAULT_STATUS = Object.freeze({
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

const DEFAULT_REWARDS_SUMMARY = Object.freeze({
  total:              0,
  pending:            0,
  approved:           0,
  rejected:           0,
  totalINR:           0,
  usedForSubscription:0,
  totalUsedINR:       0,
  totalEarned:        0,
});

// ── Context ────────────────────────────────────────────────────────────────────

const SpecialOfferContext = createContext(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function SpecialOfferProvider({ children }) {
  const { token } = useAuth();

  const kycCtx       = useReactContext(KycContext);
  const kycCtxStatus = kycCtx?.status ?? null;

  // Stable token ref so callbacks never go stale without re-creating.
  const tokenRef = useRef(token);
  useEffect(() => { tokenRef.current = token; }, [token]);

  // ── Offer state ────────────────────────────────────────────────────────────
  const [status,         setStatus]         = useState(DEFAULT_STATUS);
  const [lockedRewards,  setLockedRewards]  = useState([]);
  const [rewardsSummary, setRewardsSummary] = useState(DEFAULT_REWARDS_SUMMARY);

  // ── Loading / error state ──────────────────────────────────────────────────
  const [loading,        setLoading]        = useState(true);
  const [rewardsLoading, setRewardsLoading] = useState(false);
  const [statusReady,    setStatusReady]    = useState(false);
  const [error,          setError]          = useState(null);

  // ── Live countdown (ticks every second via setInterval) ───────────────────
  const [expiresAt,  setExpiresAt]  = useState(null);
  const [countdown,  setCountdown]  = useState(0);

  // ── Withdraw state ─────────────────────────────────────────────────────────
  const [withdrawing,    setWithdrawing]    = useState(false);
  const [withdrawError,  setWithdrawError]  = useState(null);
  const [lastWithdrawal, setLastWithdrawal] = useState(null);

  // ── Refs ───────────────────────────────────────────────────────────────────
  const mountedRef      = useRef(true);
  const countdownRef    = useRef(null);
  const pollRef         = useRef(null);
  const statusAbortRef  = useRef(null);
  const rewardsAbortRef = useRef(null);

  // ── fetchStatus ────────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!tokenRef.current) return;

    statusAbortRef.current?.abort();
    statusAbortRef.current = new AbortController();

    try {
      const res = await apiRequest.get('/api/special-offer/status', {
        signal:        statusAbortRef.current.signal,
        _silenceToast: true,
      });
      if (!mountedRef.current) return;

      const data = res.data;
      setStatus(data);
      setError(null);
      setStatusReady(true);

      if (data.expiresAt) {
        setExpiresAt(data.expiresAt);
        const remaining = Math.max(
          0,
          Math.floor((new Date(data.expiresAt) - Date.now()) / 1000)
        );
        setCountdown(remaining);
      } else {
        setExpiresAt(null);
        setCountdown(0);
      }
    } catch (err) {
      if (isCancellation(err)) return;
      if (!mountedRef.current) return;
      setError(err?.response?.data?.message ?? err?.message ?? 'Failed to load offer status.');
      setStatusReady(true);
    }
  }, []); // intentionally empty — reads tokenRef (stable ref)

  // ── fetchLockedRewards ─────────────────────────────────────────────────────
  const fetchRewards = useCallback(async () => {
    if (!tokenRef.current) return;

    rewardsAbortRef.current?.abort();
    rewardsAbortRef.current = new AbortController();

    setRewardsLoading(true);
    try {
      const res = await apiRequest.get('/api/special-offer/locked-rewards', {
        signal:        rewardsAbortRef.current.signal,
        _silenceToast: true,
      });
      if (!mountedRef.current) return;
      setLockedRewards(res.data.rewards  ?? []);
      setRewardsSummary(res.data.summary ?? DEFAULT_REWARDS_SUMMARY);
    } catch (err) {
      if (isCancellation(err)) return;
      // Non-fatal — locked rewards are secondary data. Log, don't surface.
      console.warn('[SpecialOfferContext] locked-rewards fetch failed:', err?.message);
    } finally {
      if (mountedRef.current) setRewardsLoading(false);
    }
  }, []);

  // ── Combined refresh (called by socket events and manual triggers) ─────────
  const refresh = useCallback(async () => {
    await Promise.allSettled([fetchStatus(), fetchRewards()]);
  }, [fetchStatus, fetchRewards]);

  // ── Initial load / auth change ─────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!token) {
      setLoading(false);
      setStatus(DEFAULT_STATUS);
      setLockedRewards([]);
      setRewardsSummary(DEFAULT_REWARDS_SUMMARY);
      setStatusReady(false);
      setError(null);
      setCountdown(0);
      setExpiresAt(null);
      return () => { mountedRef.current = false; };
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      await Promise.allSettled([fetchStatus(), fetchRewards()]);
      if (!cancelled && mountedRef.current) setLoading(false);
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      statusAbortRef.current?.abort();
      rewardsAbortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Countdown timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (!status.isActive || !expiresAt) return;

    countdownRef.current = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(expiresAt) - Date.now()) / 1000)
      );
      setCountdown(remaining);

      if (remaining <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
        // Offer just expired — re-fetch to update isActive + canEarnMore
        if (mountedRef.current) fetchStatus();
      }
    }, 1000);

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
    };
  }, [status.isActive, expiresAt, fetchStatus]);

  // ── Background poll (fallback for missed socket events) ───────────────────
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
  useEffect(() => {
    const off = onSocketEvent('special_offer_reward', () => {
      if (mountedRef.current) refresh();
    });
    return off;
  }, [refresh]);

  // ── Socket: kyc_verified ─────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('kyc_verified', () => {
      if (mountedRef.current) refresh();
    });
    return off;
  }, [refresh]);

  // ── Socket: kyc_rejected ─────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('kyc_rejected', () => {
      if (mountedRef.current) fetchStatus();
    });
    return off;
  }, [fetchStatus]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (countdownRef.current) clearInterval(countdownRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      statusAbortRef.current?.abort();
      rewardsAbortRef.current?.abort();
    };
  }, []);

  // ── withdraw ──────────────────────────────────────────────────────────────
  /**
   * POST /api/special-offer/withdraw
   * @param {{ accountNumber?, ifscCode?, panNumber? }} [bankDetails]
   * @returns {Promise<{ success: boolean, message: string, amount?: number }>}
   */
  const withdraw = useCallback(async (bankDetails) => {
    setWithdrawing(true);
    setWithdrawError(null);

    try {
      const body = bankDetails ? { bankDetails } : {};
      const res  = await apiRequest.post('/api/special-offer/withdraw', body);

      if (!mountedRef.current) return { success: true };

      setLastWithdrawal(res.data);
      // Refresh both status and rewards after a successful withdrawal
      await refresh();

      return { success: true, message: res.data.message, amount: res.data.amount };
    } catch (err) {
      if (!mountedRef.current) return { success: false, message: '' };
      const msg = err?.response?.data?.message ?? err?.message ?? 'Withdrawal failed.';
      setWithdrawError(msg);
      return { success: false, message: msg };
    } finally {
      if (mountedRef.current) setWithdrawing(false);
    }
  }, [refresh]);

  // ── Derived values (computed, not stored in state) ─────────────────────────
  // KYC: KycContext is always freshest. Fall back to AuthContext via kycCtxStatus.
  // canWithdraw is purely derived from KYC — backend enforces this too.
  const kycStatus   = kycCtxStatus;
  const kycVerified = kycCtxStatus === 'verified';
  const canWithdraw = kycVerified && rewardsSummary.approved > 0;

  // Urgency tier (HIGH / MEDIUM / LOW / EXPIRED) — pure function, no state.
  const urgency = useMemo(
    () => classifyUrgency(status.isActive, countdown),
    [status.isActive, countdown]
  );

  // ======= Time parts (hours / minutes / seconds / formatted string). ========= //

  // const countdownParts = useMemo(() => formatCountdown(countdown), [countdown]);

  function formatCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
  const formattedTime = formatCountdown(countdown);

  // Progress through the 12-hour offer window (0–100).
  const timeProgressPct = useMemo(() => {
    if (!status.isActive || !status.startAt || !expiresAt) return 0;
    const total   = new Date(expiresAt) - new Date(status.startAt);
    const elapsed = Date.now() - new Date(status.startAt);
    return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
  }, [status.isActive, status.startAt, expiresAt]);

  // Progress towards daily earnings cap (0–100).
  const dailyProgressPct = useMemo(() => {
    const cap     = status.dailyCap || DAILY_CAP_INR;
    const earned  = status.todayEarned || 0;
    return Math.min(100, Math.round((earned / cap) * 100));
  }, [status.todayEarned, status.dailyCap]);

  // Remaining INR earnable today.
  const remainingToday = useMemo(
    () => Math.max(0, (status.dailyCap || DAILY_CAP_INR) - (status.todayEarned || 0)),
    [status.todayEarned, status.dailyCap]
  );

  // ── Stable context value ───────────────────────────────────────────────────
  const value = useMemo(() => ({
    // Server state
    status,
    lockedRewards,
    rewardsSummary,

    // Loading / error
    loading,
    rewardsLoading,
    statusReady,
    error,

    // Countdown
    countdown,
    // countdownParts,
    formattedTime,
    expiresAt,

    // Derived UI values — no extra state, computed from server data
    urgency,
    timeProgressPct,
    dailyProgressPct,
    remainingToday,

    // Actions
    refresh,
    refreshRewards: fetchRewards,
    withdraw,

    // Withdraw state
    withdrawing,
    withdrawError,
    lastWithdrawal,

    // KYC gate — sourced from KycContext (always live), never duplicated
    kycStatus,
    kycVerified,
    canWithdraw,
  }), [
    status, lockedRewards, rewardsSummary,
    loading, rewardsLoading, statusReady, error,
    countdown, 
    // countdownParts, 
    formattedTime,
    expiresAt,
    urgency, timeProgressPct, dailyProgressPct, remainingToday,
    refresh, fetchRewards, withdraw,
    withdrawing, withdrawError, lastWithdrawal,
    kycStatus, kycVerified, canWithdraw,
  ]);

  return (
    <SpecialOfferContext.Provider value={value}>
      {children}
    </SpecialOfferContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * @throws {Error} if called outside <SpecialOfferProvider>
 */
export function useSpecialOffer() {
  const ctx = useContext(SpecialOfferContext);
  if (!ctx) {
    throw new Error(
      '[useSpecialOffer] must be called inside <SpecialOfferProvider>.\n' +
      'Wrap your rewards section with <SpecialOfferProvider>.'
    );
  }
  return ctx;
}

export default SpecialOfferContext;