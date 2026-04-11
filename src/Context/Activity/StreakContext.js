// src/Context/Activity/StreakContext.js

import React, {
  createContext, useContext, useEffect,
  useState, useCallback, useRef, useMemo,
} from 'react';
import apiRequest from '../../utils/apiRequest';

const StreakContext = createContext(null);
const CACHE_TTL = 60 * 1000;     // ⬅️ 60 seconds
export { StreakContext };

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

const REWARD_MILESTONES = [
  30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360,
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const getToken = () => localStorage.getItem('token');

/**
 * Convert numeric days to the canonical slab key used by the backend:
 *   90 → "90days"
 */
const toSlabKey = (days) => `${Number(days)}days`;

/**
 * Extract numeric days from a slab key:
 *   "90days" → 90
*/
const fromSlabKey = (key) => parseInt(String(key), 10);

// ─────────────────────────────────────────────────────────────────────────────

export const StreakProvider = ({ children }) => {
  const [streakCount,    setStreakCount]    = useState(0);   // unique streak days
  const [streakDates,    setStreakDates]    = useState([]);  // [{ date: Date, count: N }]
  const [claimedKeys,    setClaimedKeys]   = useState(new Set()); // Set<slabKey>
  const [claimStatus,    setClaimStatus]   = useState({});  // { [slabKey]: 'idle'|'claiming'|'success'|'error' }
  const [loading,        setLoading]       = useState(false);
  const [error,          setError]         = useState(null);
  const [lastError,      setLastError]     = useState(null); // per-action error message

  const abortRef    = useRef(null);
  const fetchingRef = useRef(false);

  const lastFetchRef = useRef(0);   // ⬅️ ADD THIS

  // ── Fetch all streak data in one parallel batch ───────────────────────────
  const fetchAll = useCallback(async () => {
  const token = getToken();
  // ✅ TTL CACHE GUARD
  const now = Date.now();
    if (now - lastFetchRef.current < CACHE_TTL) return; // skip duplicate calls

    if (!token || fetchingRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [historyResult, activityResult] = await Promise.allSettled([
        apiRequest.get(`${BACKEND_URL}/api/activity/streak-history`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
        apiRequest.get(`${BACKEND_URL}/api/activity/user`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
      ]);

      // ── Streak history ────────────────────────────────────────────────────
      if (historyResult.status === 'fulfilled') {
        const data = historyResult.value.data;
        const formatted = Array.isArray(data?.streakDates)
          ? data.streakDates.map((entry) => ({
              date:  new Date(entry.date),
              count: entry.count ?? 1,
            }))
          : [];
        setStreakDates(formatted);
        // Server's totalUniqueDays is the authoritative streak count
        setStreakCount(data?.totalUniqueDays ?? formatted.length);
      } else if (historyResult.reason?.name !== 'CanceledError' &&
                 historyResult.reason?.name !== 'AbortError') {
        console.error('[StreakContext] streak-history:', historyResult.reason);
        setError('Failed to load streak history.');
      }

      // ── Claimed slabs ─────────────────────────────────────────────────────
      // Activity type 'streakreward' marks a claimed slab; 'streak' is a raw daily log.
      if (activityResult.status === 'fulfilled') {
        const activities = activityResult.value.data?.activities;
        const claimed = Array.isArray(activities)
          ? activities
              .filter((act) => act.type === 'streakreward' && act.streakslab)
              .map((act) => act.streakslab)
          : [];
        setClaimedKeys(new Set(claimed));
      } else if (activityResult.reason?.name !== 'CanceledError' &&
                 activityResult.reason?.name !== 'AbortError') {
        console.error('[StreakContext] activity/user:', activityResult.reason);
      }
      // ✅ UPDATE LAST FETCH TIME ON SUCCESS
      lastFetchRef.current = Date.now();
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []); // stable — reads token fresh on every call

  const hasFetchedRef = useRef(false);
  useEffect(() => {
    if (hasFetchedRef.current) return;   // ✅ prevent double call
    hasFetchedRef.current = true;

    fetchAll();

    return () => {
      abortRef.current?.abort();
    };
  }, [fetchAll]);

  // ── logDailyStreak ────────────────────────────────────────────────────────
  const logDailyStreak = useCallback(async () => {
    const token = getToken();
    if (!token) return { success: false, message: 'Not authenticated' };
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/log-daily-streak`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Refetch so the heatmap and count update
      await fetchAll();
      return { success: true, message: res.data?.message };
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to log streak.';
      return { success: false, message: msg };
    }
  }, [fetchAll]);

  // ── claimStreakReward (optimistic) ────────────────────────────────────────
  /**
   * @param {number} days  e.g. 90
   */
  const claimStreakReward = useCallback(async (days) => {
    const token   = getToken();
    const slabKey = toSlabKey(days);
    if (!token || claimedKeys.has(slabKey)) return;

    // Optimistic update
    setClaimedKeys((prev) => new Set([...prev, slabKey]));
    setClaimStatus((prev) => ({ ...prev, [slabKey]: 'claiming' }));
    setLastError(null);

    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/streak-reward`,
        { streakslab: slabKey },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setClaimStatus((prev) => ({ ...prev, [slabKey]: 'success' }));
      return { success: true, data: res.data };
    } catch (err) {
      // Rollback optimistic update
      setClaimedKeys((prev) => {
        const next = new Set(prev);
        next.delete(slabKey);
        return next;
      });
      setClaimStatus((prev) => ({ ...prev, [slabKey]: 'error' }));
      const msg = err.response?.data?.message || 'Failed to claim streak reward.';
      setLastError(msg);
      return { success: false, message: msg };
    }
  }, [claimedKeys]);

  // ── Computed values ───────────────────────────────────────────────────────

  // isClaimed(days) — O(1) Set lookup
  const isClaimed = useCallback(
    (days) => claimedKeys.has(toSlabKey(days)),
    [claimedKeys]
  );

  // claimedDays — array form for consumers that need to iterate
  const claimedDays = useMemo(
    () => [...claimedKeys].map(fromSlabKey).filter((d) => !isNaN(d)),
    [claimedKeys]
  );

  // First unclaimed milestone that the user has reached
  const nextMilestone = useMemo(
    () => REWARD_MILESTONES.find(
      (m) => !claimedKeys.has(toSlabKey(m)) && streakCount >= m
    ) ?? REWARD_MILESTONES.find((m) => !claimedKeys.has(toSlabKey(m))) ?? null,
    [claimedKeys, streakCount]
  );

  // Progress (0–100) toward the next unclaimed milestone
  const progressToNextMilestone = useMemo(() => {
    if (!nextMilestone) return 100;
    const prev = REWARD_MILESTONES[REWARD_MILESTONES.indexOf(nextMilestone) - 1] ?? 0;
    const range = nextMilestone - prev;
    const done  = Math.max(0, streakCount - prev);
    return Math.min(100, Math.round((done / range) * 100));
  }, [nextMilestone, streakCount]);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    streakCount,
    totalUniqueDays:          streakCount,
    streakDates,
    claimedDays,
    claimedKeys,
    isClaimed,
    claimStatus,
    nextMilestone,
    progressToNextMilestone,
    rewardMilestones:         REWARD_MILESTONES,
    loading,
    error,
    lastError,
    fetchStreakHistory:        fetchAll,
    fetchStreakData:           fetchAll,
    fetchAll,
    logDailyStreak,
    claimStreakReward,
  }), [
    streakCount, streakDates, claimedDays, claimedKeys,
    isClaimed, claimStatus, nextMilestone, progressToNextMilestone,
    loading, error, lastError,
    fetchAll, logDailyStreak, claimStreakReward,
  ]);

  return (
    <StreakContext.Provider value={value}>
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => {
  const ctx = useContext(StreakContext);
  if (!ctx) throw new Error('useStreak must be used within a StreakProvider');
  return ctx;
};