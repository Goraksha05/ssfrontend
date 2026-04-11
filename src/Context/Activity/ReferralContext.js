// src/Context/ReferralContext.js

import React, {
  createContext, useState, useEffect,
  useContext, useCallback, useRef, useMemo,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import apiRequest from '../../utils/apiRequest';
import { emitSignal } from '../../utils/behaviorSDK';

const ReferralContext = createContext(null);

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL   ||
  '';
const CACHE_TTL_MS = 60_000; // 60 s

// ── Module-level helpers (stable references, no closure risk) ─────────────────

const getToken   = () => localStorage.getItem('token');
const getUserId  = () => {
  try {
    const t = getToken();
    return t ? jwtDecode(t)?.user?.id ?? '' : '';
  } catch {
    return '';
  }
};
const getReferralId = () => {
  try {
    const t = getToken();
    return t ? jwtDecode(t)?.user?.referralId ?? '' : '';
  } catch {
    return '';
  }
};

// ─────────────────────────────────────────────────────────────────────────────

export const ReferralProvider = ({ children }) => {
  const [referralActivities,    setReferralActivities]    = useState([]);
  const [referredUsers,         setReferredUsers]         = useState([]);
  const [referralCount,         setReferralCount]         = useState(0);
  const [activeReferralCount,   setActiveReferralCount]   = useState(0); // with active subscription
  const [referralId,            setReferralId]            = useState('');
  const [loading,               setLoading]               = useState(false);
  const [error,                 setError]                 = useState(null);

  const lastFetchRef  = useRef(0);          // timestamp of last successful fetch
  const abortRef      = useRef(null);       // AbortController for the active fetch
  const fetchingRef   = useRef(false);      // guard against concurrent calls
  const signalSentRef = useRef(false);      // emit behavior signal only once per mount

  // ── Behavior signal (once per provider lifetime) ──────────────────────────
  useEffect(() => {
    if (signalSentRef.current) return;
    signalSentRef.current = true;
    try {
      const session = window.__sdkSession;
      if (!session) return;
      const now  = Date.now();
      const last = window.__lastReferralTs ?? now;
      emitSignal(session, 'referral_sent', {
        interval_ms_since_last_referral: now - last,
      });
      window.__lastReferralTs = now;
    } catch { /* non-fatal */ }
  }, []);

  // ── fetchReferralData ─────────────────────────────────────────────────────
  /**
   * @param {boolean} [force=false]  Skip the TTL cache and always refetch.
   */
  const fetchReferralData = useCallback(async (force = false) => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) return;
    if (fetchingRef.current) return;

    // TTL cache guard
    const age = Date.now() - lastFetchRef.current;
    if (!force && age < CACHE_TTL_MS) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const [activityRes, usersRes] = await Promise.all([
        apiRequest.get(`${BACKEND_URL}/api/activity/user`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
        apiRequest.get(`${BACKEND_URL}/api/auth/users/referred`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        }),
      ]);

      const activities = Array.isArray(activityRes.data?.activities)
        ? activityRes.data.activities
        : [];

      // Filter to referral-type activities that this user triggered
      const referrals = activities.filter((act) => {
        if (act.type !== 'referral') return false;
        const refId =
          act.referral?._id?.toString() ??
          act.referral?.toString()       ??
          act.referral;
        return refId === userId;
      });
      setReferralActivities(referrals);

      const referred = Array.isArray(usersRes.data?.referredUsers)
        ? usersRes.data.referredUsers
        : [];
      setReferredUsers(referred);
      setReferralCount(referred.length);
      setActiveReferralCount(
        referred.filter((u) => u.subscription?.active).length
      );

      setReferralId(getReferralId());
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('[ReferralContext] fetchReferralData:', err);
      setError('Failed to load referral data. Please refresh.');
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, []); // stable — all deps are module-level

  // ── Fetch on mount ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchReferralData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchReferralData]);

  // ── Cache invalidation (call from sibling context on relevant mutations) ──
  const invalidate = useCallback(() => {
    lastFetchRef.current = 0;
    fetchReferralData(true);
  }, [fetchReferralData]);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    referralActivities,
    referralCount,
    activeReferralCount,
    referredUsers,
    referralId,
    loading,
    error,
    fetchReferralData,
    invalidate,
  }), [
    referralActivities, referralCount, activeReferralCount,
    referredUsers, referralId, loading, error,
    fetchReferralData, invalidate,
  ]);

  return (
    <ReferralContext.Provider value={value}>
      {children}
    </ReferralContext.Provider>
  );
};

export const useReferral = () => {
  const ctx = useContext(ReferralContext);
  if (!ctx) throw new Error('useReferral must be used within a ReferralProvider');
  return ctx;
};