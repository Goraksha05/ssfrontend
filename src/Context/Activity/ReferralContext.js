// context/ReferralContext.js
//
// FIXES (cumulative):
//   1. Behavior-tracking signal moved into a useEffect (runs once on mount,
//      not on every render) to prevent inflating referral_sent signal counts.
//
//   2. Referral activity filter now uses .toString() comparison so Mongoose
//      ObjectId values match correctly instead of always returning false.
//
//   3. ESLint react-hooks/exhaustive-deps warning on fetchReferralData's
//      dependency array: `getUserId` was listed as missing.
//      Root cause: getToken and getUserId were defined as plain arrow functions
//      inside the component body, so React's lint rule saw them as values that
//      could change on every render and required them as deps. But adding them
//      as deps would recreate apiRequest and fetchReferralData on every render,
//      defeating memoisation entirely and causing an infinite fetch loop.
//      Fix: move both pure utility functions to module scope. Module-level
//      functions are stable references — they are never recreated, never change,
//      and correctly do NOT belong in any useCallback/useEffect dependency array.

import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import { emitSignal } from '../../utils/behaviorSDK';

const ReferralContext = createContext();
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

// ── Module-level helpers ──────────────────────────────────────────────────────
// Defined outside the component so they are stable references that never
// change between renders. This means they correctly do NOT appear in any
// useCallback or useEffect dependency array — the lint rule only flags
// functions that are declared inside the component body (and therefore
// re-created on every render). These read from localStorage/decode the JWT
// fresh on every call, so they never hold stale values either.

const getToken = () => localStorage.getItem('token');

const getUserId = () => {
  try {
    const t = getToken();
    return t ? jwtDecode(t)?.user?.id : '';
  } catch {
    return '';
  }
};

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch (e) {
    const text = await res.text().catch(() => '');
    console.error('❌ JSON parse failed:', text);
    return {};
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const ReferralProvider = ({ children }) => {
  const [referralActivities, setReferralActivities] = useState([]);
  const [referralCount,      setReferralCount]       = useState(0);
  const [referredUsers,      setReferredUsers]        = useState([]);
  const [loading,            setLoading]              = useState(true);

  // apiRequest has no deps because getToken is now a stable module-level fn
  const apiRequest = useCallback(async (method, path) => {
    const token = getToken();
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${token}`,
      },
    });
    return res;
  }, []); // stable — getToken is module-level, BACKEND_URL is a module constant

  // fetchReferralData only depends on apiRequest (also stable after the fix)
  const fetchReferralData = useCallback(async () => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) return;

    try {
      const [activityRes, usersRes] = await Promise.all([
        apiRequest('GET', '/api/activity/user'),
        apiRequest('GET', '/api/auth/users/referred'),
      ]);

      const activityData = await safeJson(activityRes);
      const usersData    = await safeJson(usersRes);

      const activities = Array.isArray(activityData.activities)
        ? activityData.activities
        : [];

      // Compare using .toString() — Mongoose ObjectIds are objects, not strings
      const referrals = activities.filter((act) => {
        if (act.type !== 'referral') return false;
        const referralId =
          act.referral?._id?.toString() ?? act.referral?.toString() ?? act.referral;
        return referralId === userId;
      });
      setReferralActivities(referrals);

      const referred = Array.isArray(usersData.referredUsers)
        ? usersData.referredUsers
        : [];
      setReferredUsers(referred);
      setReferralCount(referred.length);
    } catch (err) {
      console.error('Error fetching referral data:', err);
    } finally {
      setLoading(false);
    }
  }, [apiRequest]); // only dep is apiRequest — module-level helpers need no listing

  useEffect(() => {
    fetchReferralData();
  }, [fetchReferralData]);

  // ── Behavior signal (once on mount) ──────────────────────────────────────
  useEffect(() => {
    try {
      const session = window.__sdkSession;
      if (!session) return;

      const now           = Date.now();
      const last          = window.__lastReferralTs ?? now;
      const timeSinceLast = now - last;

      emitSignal(session, 'referral_sent', {
        interval_ms_since_last_referral: timeSinceLast,
      });

      window.__lastReferralTs = now;
    } catch (err) {
      console.warn('[ReferralContext] referral signal failed:', err);
    }
  }, []); // stable — no component-scoped values referenced

  return (
    <ReferralContext.Provider
      value={{ referralActivities, referralCount, referredUsers, fetchReferralData, loading }}
    >
      {children}
    </ReferralContext.Provider>
  );
};

export const useReferral = () => useContext(ReferralContext);