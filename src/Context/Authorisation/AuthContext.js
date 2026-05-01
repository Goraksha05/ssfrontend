/**
 * Context/Authorisation/AuthContext.js  — Fixed
**/

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import { toast } from 'react-toastify';
import {
  disconnectSocket,
  initializeSocket,
  getSocket,
  onSocketEvent,
} from '../../WebSocket/WebSocketClient';
import AuthService from '../../Services/AuthService';
import { useQueryClient } from '@tanstack/react-query';

export const AuthContext = createContext(null);

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

// ── Debug logger ────────────────────────────────────────────────────────────
// Enable with:  window.__AUTH_DEBUG = true
function authLog(...args) {
  if (typeof window !== 'undefined' && window.__AUTH_DEBUG) {
    console.log('[AuthContext]', ...args);
  }
}

// ── Token helpers ──────────────────────────────────────────────────────────────

function secondsUntilExpiry(token) {
  try {
    const { exp } = jwtDecode(token);
    return exp - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

const isTokenExpired = (token) => secondsUntilExpiry(token) < 30;

const resolveUserId = (userInfo) =>
  userInfo?.id?.toString() ?? userInfo?._id?.toString() ?? null;

function resetCaptcha() {
  try { if (window.grecaptcha?.reset) window.grecaptcha.reset(); }
  catch { /* non-fatal */ }
}

function maybeLogDailyStreak(token) {
  const today = new Date().toISOString().split('T')[0];
  const key   = 'streak_logged_date';
  if (localStorage.getItem(key) === today) return;
  localStorage.setItem(key, today);
  fetch(`${BACKEND_URL}/api/activity/log-daily-streak`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// ── Provider ───────────────────────────────────────────────────────────────────

export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [authError,       setAuthError]       = useState(null);

  const queryClient = useQueryClient();

  // Refs — never cause re-renders, safe to read inside stable callbacks
  const tokenRef       = useRef(localStorage.getItem('token'));
  const userRef        = useRef(null);
  const socketRef      = useRef(null);
  const offConnectRef  = useRef(null);
  const expiryTimerRef = useRef(null);

  // ── Token refresh queue ────────────────────────────────────────────────────
  //
  // THIS IS THE SINGLE SOURCE OF TRUTH FOR REFRESH STATE.
  // apiRequest.js delegates here via window.__tokenRefreshQueue.
  // AuthContext is the only place that calls AuthService.refreshToken().
  //
  // Protocol:
  //   isRefreshing.current = true   → a refresh is in flight
  //   subscribeTokenRefresh(cb)     → queue a callback to replay after refresh
  //   onTokenRefreshed(newToken)    → refresh succeeded; drain queue + sync RQ
  //   onRefreshFailed()             → refresh failed; drain queue with null
  const isRefreshing       = useRef(false);
  const refreshSubscribers = useRef([]);

  const subscribeTokenRefresh = useCallback((cb) => {
    refreshSubscribers.current.push(cb);
  }, []);

  const onTokenRefreshed = useCallback((newToken) => {
    authLog('🔄 REFRESH TOKEN — success, new token stored');

    // Drain the subscriber queue (apiRequest.js waiting callers)
    refreshSubscribers.current.forEach((cb) => cb(newToken));
    refreshSubscribers.current = [];
    isRefreshing.current = false;

    // ── React Query sync ──────────────────────────────────────────────────
    // All cached queries used the old Authorization header.  Invalidating
    // them forces a refetch with the new token on next render/focus.
    // We do NOT call queryClient.clear() here (that would wipe the cache
    // entirely and cause loading flashes); invalidate is enough.
    queryClient.invalidateQueries();
  }, [queryClient]);

  const onRefreshFailed = useCallback(() => {
    authLog('🔄 REFRESH TOKEN — failed, draining queue with null');
    refreshSubscribers.current.forEach((cb) => cb(null));
    refreshSubscribers.current = [];
    isRefreshing.current = false;
  }, []);

  // Expose the queue for apiRequest.js interceptor
  useEffect(() => {
    window.__tokenRefreshQueue = {
      isRefreshing,
      subscribeTokenRefresh,
      onTokenRefreshed,
      onRefreshFailed,
    };
    // Cleanup on unmount so a stale reference is never used
    return () => { window.__tokenRefreshQueue = null; };
  }, [subscribeTokenRefresh, onTokenRefreshed, onRefreshFailed]);

  // ── Socket setup ───────────────────────────────────────────────────────────

  const setupSocket = useCallback(async (userInfo) => {
    try {
      const sock = await initializeSocket();
      if (!sock) return;
      socketRef.current = sock;

      const onConnect = () => {
        const userId = resolveUserId(userInfo);
        if (!userId) return;
        sock.emit('user-online', {
          userId,
          name:        userInfo.name        ?? '',
          hometown:    userInfo.hometown     ?? '',
          currentcity: userInfo.currentcity  ?? '',
        });
        sock.emit('join-room', userId);
      };

      offConnectRef.current?.();
      offConnectRef.current = onSocketEvent('connect', onConnect);
      if (sock.connected) onConnect();
    } catch (err) {
      console.error('[AuthContext] setupSocket failed:', err);
    }
  }, []);

  // ── setUserState — single place that updates both state and ref ────────────

  const setUserState = useCallback((userInfo) => {
    userRef.current = userInfo;
    setUser(userInfo);
  }, []);

  // ── logout — reads user from ref, not from captured state ─────────────────

  const logout = useCallback((reason) => {
    authLog('🚪 LOGOUT:', reason ?? '(no reason given)');
    console.info(`[AuthContext] 🚪 LOGOUT: ${reason ?? '(no reason given)'}`);

    resetCaptcha();
    onRefreshFailed(); // drain any pending refresh subscribers

    const sock   = socketRef.current || getSocket();
    const userId = resolveUserId(userRef.current);
    if (sock?.connected && userId) {
      sock.emit('user-offline', userId);
    }

    offConnectRef.current?.();
    offConnectRef.current = null;
    disconnectSocket();
    socketRef.current = null;

    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    AuthService.logout();
    tokenRef.current = null;

    // Clear React Query cache completely on logout — user data must not bleed
    // between sessions (different users on shared devices, etc.)
    queryClient.clear();

    // Broadcast to other tabs
    localStorage.setItem('auth:logout', Date.now().toString());
    localStorage.removeItem('auth:logout');

    setIsAuthenticated(false);
    setUserState(null);
    setLoading(false);
  }, [onRefreshFailed, setUserState, queryClient]);

  // ── Proactive expiry watch ─────────────────────────────────────────────────
  //
  // Runs every 60 s.  When the token is within 5 min of expiry it attempts a
  // refresh via the single queue.  If apiRequest already started a refresh
  // (isRefreshing.current === true) we simply queue onto it rather than
  // starting a second one.

  const startExpiryWatch = useCallback((token) => {
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);

    expiryTimerRef.current = setInterval(async () => {
      const t = localStorage.getItem('token');
      if (!t) { logout('token removed externally'); return; }

      const secs = secondsUntilExpiry(t);

      if (secs < 0) {
        clearInterval(expiryTimerRef.current);
        toast.warn('Your session has expired. Please log in again.');
        logout('token expired');
        return;
      }

      if (secs < 300) {
        // If a refresh is already in flight (started by apiRequest interceptor),
        // don't start another — just subscribe to the result.
        if (isRefreshing.current) {
          authLog('🔄 REFRESH TOKEN — timer skipped, refresh already in flight');
          return;
        }

        authLog('🔄 REFRESH TOKEN — proactive attempt (token expires in', secs, 'seconds)');
        isRefreshing.current = true;

        try {
          const newToken = await AuthService.refreshToken();
          if (newToken) {
            localStorage.setItem('token', newToken);
            tokenRef.current = newToken;
            onTokenRefreshed(newToken); // drains queue + invalidates React Query
          } else {
            onRefreshFailed();
          }
        } catch {
          onRefreshFailed();
        }
      }
    }, 60_000);
  }, [logout, onTokenRefreshed, onRefreshFailed]);

  // ── auth:unauthorized (from apiRequest interceptor) ────────────────────────

  useEffect(() => {
    const handler = () => logout('401 from apiRequest');
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [logout]);

  // ── Visibility-change re-validation ───────────────────────────────────────

  useEffect(() => {
    const handler = () => {
      if (document.visibilityState !== 'visible') return;
      const t = localStorage.getItem('token');
      if (!t) return;
      if (isTokenExpired(t)) {
        toast.warn('Your session expired while you were away. Please log in again.');
        logout('token expired on visibility change');
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [logout]);

  // ── Cross-tab logout sync ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'auth:logout' && e.newValue && isAuthenticated) {
        toast.info('You were logged out from another tab.');
        logout('cross-tab logout');
        return;
      }
      if (e.key === 'token' && !e.newValue && isAuthenticated) {
        logout('token removed in another tab');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [isAuthenticated, logout]);

  // ── Session restore on mount ───────────────────────────────────────────────

  useEffect(() => {
    const controller = new AbortController();
    let isMounted    = true;

    async function restore() {
      const token = localStorage.getItem('token');

      if (!token) {
        if (isMounted) setLoading(false);
        return;
      }

      if (isTokenExpired(token)) {
        console.warn('[AuthContext] Stored token expired — clearing.');
        resetCaptcha();
        if (isMounted) logout('stored token expired on mount');
        return;
      }

      if (isMounted) setIsAuthenticated(true);

      try {
        const userInfo = await AuthService.getUser({ signal: controller.signal });
        if (!isMounted) return;

        if (!userInfo) {
          logout('getUser returned null on mount');
          return;
        }

        tokenRef.current = token;
        setUserState(userInfo);
        await setupSocket(userInfo);
        startExpiryWatch(token);
      } catch (err) {
        if (!isMounted || err.name === 'AbortError') return;
        console.error('[AuthContext] Session restore failed:', err);
        logout('session restore error');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    restore();

    return () => {
      isMounted = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Login ──────────────────────────────────────────────────────────────────

  const login = useCallback(async (rawToken, userInfo) => {
    setAuthError(null);

    if (!rawToken || rawToken === 'null' || rawToken === 'undefined') {
      const msg = 'Invalid login token';
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    const cleanedToken = rawToken.trim();
    if (isTokenExpired(cleanedToken)) {
      const msg = 'Session expired. Please log in again.';
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    localStorage.setItem('token', cleanedToken);
    tokenRef.current = cleanedToken;
    setIsAuthenticated(true);

    try {
      const resolvedUser = userInfo ?? await AuthService.getUser();

      authLog('✅ LOGIN:', resolvedUser?.name ?? resolvedUser?.email ?? resolvedUser?.id);
      console.info('[AuthContext] ✅ LOGIN:', resolvedUser?.name ?? resolvedUser?.email ?? resolvedUser?.id);

      if (resolvedUser) {
        setUserState(resolvedUser);
        localStorage.setItem('User', JSON.stringify(resolvedUser));
      }

      maybeLogDailyStreak(cleanedToken);
      await setupSocket(resolvedUser ?? {});
      startExpiryWatch(cleanedToken);
    } catch (err) {
      console.error('[AuthContext] login setup failed:', err);
    }
  }, [setupSocket, startExpiryWatch, setUserState]);

  // ── Cleanup ────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
      offConnectRef.current?.();
    };
  }, []);

  // ── Derived deletion state ─────────────────────────────────────────────────
  const deletionPending     = user?.deletionPending     ?? false;
  const deletionScheduledAt = user?.deletionScheduledAt ?? null;

  // ── Derived KYC state ──────────────────────────────────────────────────────
  // Exposed as a flat primitive so consumers (e.g. useSpecialOfferEligibility)
  // can depend on `authCtx.userKycStatus` directly instead of the deep chain
  // `authCtx?.user?.kyc?.status`.  Depending on the parent object reference
  // (`authCtx?.user`) alone is insufficient — the user object identity may not
  // change when only a nested field updates, so react-hooks/exhaustive-deps
  // correctly demands the leaf value too.  By deriving it here once, consumers
  // get a stable string (or null) with no redundant dependency.
  const userKycStatus = user?.kyc?.status ?? null;

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token:             tokenRef.current,
        authtoken:         tokenRef.current,
        loading,
        authError,
        deletionPending,
        deletionScheduledAt,
        userKycStatus,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};