// src/Context/ReferralContext.js  — v2
//
// CHANGES from v1:
//  • inviteLink is now built inside the context via buildInviteLink() from
//    utils/inviteLink.js so every consumer gets the same canonical URL.
//  • inviteLink is exposed in the context value — consumers no longer need to
//    construct it themselves (removes ad-hoc URL building from ReferralTab,
//    ShareModal wrappers, InviteCard, etc.).
//  • parseRefParam() re-exported from utils/inviteLink.js for convenience.
//  • No other logic changes; fetching, caching, abort and behavior signal
//    handling are identical to v1.

import React, {
  createContext, useState, useEffect,
  useContext, useCallback, useRef, useMemo,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import apiRequest from '../../utils/apiRequest';
import { emitSignal } from '../../utils/behaviorSDK';
import { buildInviteLink } from '../../utils/inviteLink';

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
  const [activeReferralCount,   setActiveReferralCount]   = useState(0);
  const [referralId,            setReferralId]            = useState('');
  const [loading,               setLoading]               = useState(false);
  const [error,                 setError]                 = useState(null);

  const lastFetchRef  = useRef(0);
  const abortRef      = useRef(null);
  const fetchingRef   = useRef(false);
  const signalSentRef = useRef(false);

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
  const fetchReferralData = useCallback(async (force = false) => {
    const token  = getToken();
    const userId = getUserId();
    if (!token || !userId) return;
    if (fetchingRef.current) return;

    const age = Date.now() - lastFetchRef.current;
    if (!force && age < CACHE_TTL_MS) return;

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
  }, []);

  // ── Fetch on mount ─────────────────────────────────────────────────────────
  useEffect(() => {
    fetchReferralData();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchReferralData]);

  // ── Cache invalidation ─────────────────────────────────────────────────────
  const invalidate = useCallback(() => {
    lastFetchRef.current = 0;
    fetchReferralData(true);
  }, [fetchReferralData]);

  // ── Derived: invite link (single source of truth via utility) ─────────────
  // Consumers should read context.inviteLink instead of constructing the URL.
  const inviteLink = useMemo(() => buildInviteLink(referralId), [referralId]);

  // ── Stable context value ───────────────────────────────────────────────────
  const value = useMemo(() => ({
    referralActivities,
    referralCount,
    activeReferralCount,
    referredUsers,
    referralId,
    inviteLink,       // ← new: pre-built canonical URL
    loading,
    error,
    fetchReferralData,
    invalidate,
  }), [
    referralActivities, referralCount, activeReferralCount,
    referredUsers, referralId, inviteLink,
    loading, error,
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