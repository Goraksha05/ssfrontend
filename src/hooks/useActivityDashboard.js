/**
 * hooks/useActivityDashboard.js
 *
 * Single React Query hook that replaces:
 *   - StreakContext  (manual TTL, lastFetchRef, fetchingRef)
 *   - ReferralContext (same manual caching pattern)
 *
 * One fetch.  One cache.  Zero manual TTL bugs.
 *
 * Usage:
 *   const { streakCount, referralCount, ... } = useActivityDashboard();
 *
 * Cache invalidation after a reward claim:
 *   import { useQueryClient } from '@tanstack/react-query';
 *   const qc = useQueryClient();
 *   qc.invalidateQueries({ queryKey: ['activityDashboard'] });
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

export const DASHBOARD_QUERY_KEY = ['activityDashboard'];

// ─── Fetch function (module-level — stable reference, no re-creation) ─────────

async function fetchDashboard() {
  const token = localStorage.getItem('token');
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

  const res = await fetch(`${BACKEND_URL}/api/activity/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    // Let React Query's retry logic handle transient failures.
    throw new Error(`Dashboard fetch failed: ${res.status}`);
  }

  return res.json();
}

// ─── Empty / placeholder shape used while data is loading ─────────────────────
// Using the same shape prevents destructuring crashes in consumers.

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
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error } = useQuery({
    queryKey:   DASHBOARD_QUERY_KEY,
    queryFn:    fetchDashboard,
    // staleTime / retry / refetchOnWindowFocus come from the global
    // QueryClient defaultOptions in App.js — no duplication needed here.
    // Override only if this specific query needs different settings:
    // staleTime: 60_000,   // already set globally
    // retry:     1,        // already set globally
    placeholderData: EMPTY_DATA, // prevents flicker — shows zeros, not undefined
  });

  /**
   * Force-refetch the dashboard after a reward claim, log, or referral.
   * This is the ONLY place cache invalidation needs to happen —
   * all three count displays update automatically.
   */
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  }, [queryClient]);

  // Merge live data with the empty placeholder so consumers always get
  // fully-shaped objects even during the very first load.
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
// These let components import only what they need without
// pulling in the full hook return value.

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