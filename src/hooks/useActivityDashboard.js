/**
 * hooks/useActivityDashboard.js — v2
 *
 * CHANGES from v1:
 *  • Replaced raw `fetch()` with `apiRequest.get()` so the token-refresh
 *    queue, 401 handling, retry logic, and auth interceptors apply uniformly.
 *    The Authorization header is injected by the apiRequest interceptor —
 *    no manual header construction needed here.
 *  • `fetchDashboard` no longer reads from localStorage; it receives the
 *    token as a parameter only to gate early-return (no token = no fetch),
 *    while the actual header is handled by the interceptor.
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useAuth } from '../Context/Authorisation/AuthContext';
import apiRequest from '../utils/apiRequest';

// ─── Constants ────────────────────────────────────────────────────────────────
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

export const DASHBOARD_QUERY_KEY = ['activityDashboard'];

// ─── Fetch function (module-level — stable reference, no re-creation) ─────────
// token is passed in only to gate the request; the interceptor attaches the
// actual Authorization header from localStorage via apiRequest.

async function fetchDashboard(token) {
  if (!token || token === 'null' || token === 'undefined') {
    // Return safe empty shape so consumers never need null-checks.
    return {
      streakCount:         0,
      streakDates:         [],
      referralCount:       0,
      activeReferralCount: 0,
      referredUsers:       [],
    };
  }

  // apiRequest interceptor injects Authorization header automatically
  const res = await apiRequest.get(`${BACKEND_URL}/api/activity/dashboard`);
  return res.data;
}

// ─── Empty / placeholder shape used while data is loading ─────────────────────
const EMPTY_DATA = {
  streakCount:         null,  // null = "loading", 0 = "loaded but zero"
  streakDates:         [],
  referralCount:       null,
  activeReferralCount: null,
  referredUsers:       [],
};

// ─── Main hook ─────────────────────────────────────────────────────────────────

/**
 * @returns {{
 *   streakCount:         number | null,
 *   streakDates:         Array<{ date: string, count: number }>,
 *   referralCount:       number | null,
 *   activeReferralCount: number | null,
 *   referredUsers:       Array,
 *   isLoading:           boolean,
 *   isError:             boolean,
 *   error:               Error | null,
 *   invalidate:          () => void,
 * }}
 */
export function useActivityDashboard() {
  const { token } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey:        DASHBOARD_QUERY_KEY,
    queryFn:         () => fetchDashboard(token),
    placeholderData: EMPTY_DATA,
    staleTime:       30_000, // 30 seconds
    cacheTime:       5 * 60_000, // 5 minutes
    retry:           false, // no retries; errors are surfaced to the UI
  });

  /**
   * Force-refetch the dashboard after a reward claim, log, or referral.
   */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  }, [queryClient]);

  const resolved = data ?? EMPTY_DATA;

  return {
    // Streak
    streakCount:         resolved.streakCount,
    streakDates:         resolved.streakDates,

    // Referral
    referralCount:       resolved.referralCount,
    activeReferralCount: resolved.activeReferralCount,
    referredUsers:       resolved.referredUsers,

    // Meta
    isLoading,
    isError,
    error,
    invalidate,
  };
}

// ─── Convenience aliases ───────────────────────────────────────────────────────

/**
 * Lightweight hook for components that only need streak data.
 * Still backed by the same shared cache — no extra fetch.
 */
export function useStreakData() {
  const { streakCount, streakDates, isLoading, invalidate } =
    useActivityDashboard();
  return { streakCount, streakDates, isLoading, invalidate };
}

/**
 * Lightweight hook for components that only need referral data.
 * Still backed by the same shared cache — no extra fetch.
 */
export function useReferralData() {
  const { referralCount, activeReferralCount, referredUsers, isLoading, invalidate } =
    useActivityDashboard();
  return { referralCount, activeReferralCount, referredUsers, isLoading, invalidate };
}