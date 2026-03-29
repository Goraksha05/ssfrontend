// src/Context/Activity/StreakContext.js
//
// FIXES:
//   1. fetchStreakHistory double-wrapped already-shaped objects.
//      The backend GET /api/activity/streak-history returns:
//        { streakDates: [{ date: "2024-01-01", count: 2 }, ...], totalUniqueDays: N }
//      The old code mapped each element as `{ date: new Date(element), count: 1 }`,
//      treating the whole object as if it were a raw date string. This lost the
//      server's count value and produced `{ date: Invalid Date, count: 1 }`.
//      Fix: read `entry.date` and `entry.count` from the already-shaped objects.
//
//   2. fetchClaimedStreakSlabs filtered on `act.type === 'streak'` but the
//      backend activity formatter returns `type: 'streakreward'` for streak
//      reward claims. The filter always produced an empty array so `claimedDays`
//      was always `[]`, making every already-claimed milestone appear claimable.
//      Fix: filter on `act.type === 'streakreward'`.
//
//   3. streakCount was set to `formatted.length` (the number of date entries
//      in the response array) rather than `totalUniqueDays` returned by the
//      backend. The backend deduplicates by calendar day server-side, so its
//      value is the authoritative count.
//      Fix: use `data.totalUniqueDays ?? formatted.length` as the count.

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

const StreakContext = createContext();
export { StreakContext };

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export const StreakProvider = ({ children }) => {
  const [streakCount,      setStreakCount]      = useState(0);
  const [streakDates,      setStreakDates]       = useState([]);
  const [claimedDays,      setClaimedDays]       = useState([]);
  const [rewardMilestones] = useState([30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360]);
  const [message,          setMessage]           = useState('');

  // Read token inside each callback to avoid stale closure when token changes
  const getToken = () => localStorage.getItem('token');

  const safeJson = async (res) => {
    try {
      return await res.json();
    } catch (e) {
      const text = await res.text().catch(() => '');
      console.error('❌ JSON parse failed:', text);
      return {};
    }
  };

  const apiRequest = useCallback(async (method, path, options = {}) => {
    const token = getToken();
    const headers = {
      'Content-Type': 'application/json',
      Authorization:  `Bearer ${token}`,
      ...(options.headers || {}),
    };

    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      ...options,
    });
    return res;
  }, []); // no token dep — reads fresh from localStorage each call

  // ── Fetch streak history ──────────────────────────────────────────────────
  //
  // Backend response shape:
  //   { streakDates: [{ date: "YYYY-MM-DD", count: N }, ...], totalUniqueDays: N }
  const fetchStreakHistory = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res  = await apiRequest('GET', '/api/activity/streak-history');
      const data = await safeJson(res);

      // FIX 1: entries are already shaped { date, count } — read their fields
      // rather than treating the whole object as a date string.
      const formatted = Array.isArray(data.streakDates)
        ? data.streakDates.map((entry) => ({
            date:  new Date(entry.date),
            count: entry.count ?? 1,
          }))
        : [];

      setStreakDates(formatted);

      // FIX 3: prefer the server's authoritative unique-day count
      setStreakCount(data.totalUniqueDays ?? formatted.length);
    } catch (err) {
      console.error('Failed to fetch streak history:', err);
    }
  }, [apiRequest]);

  // ── Fetch claimed streak slabs ────────────────────────────────────────────
  //
  // Backend activity formatter returns type 'streakreward' (not 'streak') for
  // streak reward claim activity documents.
  const fetchClaimedStreakSlabs = useCallback(async () => {
    if (!getToken()) return;
    try {
      const res  = await apiRequest('GET', '/api/activity/user');
      const data = await safeJson(res);

      // FIX 2: the activity formatter sets type to 'streakreward' for claimed
      // streak reward slabs — 'streak' is used for raw daily streak log entries.
      const claimed = Array.isArray(data.activities)
        ? data.activities
            .filter((act) => act.type === 'streakreward' && act.streakslab)
            .map((act) => act.streakslab)
        : [];

      setClaimedDays(claimed);
    } catch (err) {
      console.error('Failed to fetch claimed streaks:', err);
    }
  }, [apiRequest]);

  // ── Claim streak reward ───────────────────────────────────────────────────
  //
  // Backend accepts streakslab as "90days" or the number 90.
  // We send the "90days" string form to match the Activity schema enum.
  const claimStreakReward = useCallback(async (streakDay) => {
    if (!getToken() || !streakDay) return;
    try {
      const res = await apiRequest('POST', '/api/activity/streak-reward', {
        body: JSON.stringify({ streakslab: `${streakDay}days` }),
      });

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data.message || 'Claim failed');

      setMessage(data.message || '✅ Reward claimed!');
      await fetchClaimedStreakSlabs();
    } catch (err) {
      console.error('Error claiming streak reward:', err);
      setMessage('❌ Failed to claim streak reward');
    }
  }, [apiRequest, fetchClaimedStreakSlabs]);

  useEffect(() => {
    fetchStreakHistory();
    fetchClaimedStreakSlabs();
  }, [fetchStreakHistory, fetchClaimedStreakSlabs]);

  return (
    <StreakContext.Provider
      value={{
        streakCount,
        totalUniqueDays: streakCount, // streakCount IS the unique-day count (set from data.totalUniqueDays)
        streakDates,
        claimedDays,
        fetchStreakHistory,
        fetchStreakData: fetchStreakHistory, // alias consumed by DailyStreak after a claim
        claimStreakReward,
        message,
        rewardMilestones,
      }}
    >
      {children}
    </StreakContext.Provider>
  );
};

export const useStreak = () => useContext(StreakContext);