// src/Context/Authorisation/AuthContext.js

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

const AuthContext = createContext(null);

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

// ── Token helpers ─────────────────────────────────────────────────────────────

/** Seconds until the token expires. Negative means already expired. */
function secondsUntilExpiry(token) {
  try {
    const { exp } = jwtDecode(token);
    return exp - Math.floor(Date.now() / 1000);
  } catch {
    return -1;
  }
}

/** True when the token has expired (with a 30-second safety buffer). */
const isTokenExpired = (token) => secondsUntilExpiry(token) < 30;

/**
 * Resolve the user's id from either `id` or `_id`.
 * The backend's getloggeduser endpoint returns `id`; raw documents use `_id`.
 */
const resolveUserId = (userInfo) =>
  userInfo?.id?.toString() ?? userInfo?._id?.toString() ?? null;

// ── reCAPTCHA reset ───────────────────────────────────────────────────────────
function resetCaptcha() {
  try {
    if (window.grecaptcha?.reset) window.grecaptcha.reset();
  } catch (err) {
    console.warn('[AuthContext] reCAPTCHA reset failed:', err?.message);
  }
}

// ── Daily streak dedup ────────────────────────────────────────────────────────
function maybeLogDailyStreak(token) {
  const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
  const key   = 'streak_logged_date';
  if (localStorage.getItem(key) === today) return; // already logged today
  localStorage.setItem(key, today);
  fetch(`${BACKEND_URL}/api/activity/log-daily-streak`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => { /* fire-and-forget */ });
}

// ── Provider ──────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);   // true during session restore
  const [authError,       setAuthError]       = useState(null);   // last auth error string

  const tokenRef      = useRef(localStorage.getItem('token'));   // mutable, not state
  const socketRef     = useRef(null);
  const offConnectRef = useRef(null);
  const expiryTimerRef = useRef(null);

  // ── Socket setup ────────────────────────────────────────────────────────────
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

      offConnectRef.current?.(); // remove previous listener if any
      offConnectRef.current = onSocketEvent('connect', onConnect);
      if (sock.connected) onConnect();
    } catch (err) {
      console.error('[AuthContext] setupSocket failed:', err);
    }
  }, []);

  // ── Core logout (safe to call multiple times) ───────────────────────────────
  const logout = useCallback((reason) => {
    resetCaptcha();

    const sock   = socketRef.current || getSocket();
    const userId = resolveUserId(user);
    if (sock?.connected && userId) {
      sock.emit('user-offline', userId);
    }

    offConnectRef.current?.();
    offConnectRef.current = null;
    disconnectSocket();
    socketRef.current = null;

    // Stop token-expiry timer
    if (expiryTimerRef.current) {
      clearInterval(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }

    AuthService.logout(); // clears localStorage keys
    tokenRef.current = null;

    setIsAuthenticated(false);
    setUser(null);
    setLoading(false);

    if (reason) console.info(`[AuthContext] Logout: ${reason}`);
  }, [user]);

  // ── Proactive token expiry check ────────────────────────────────────────────
  const startExpiryWatch = useCallback((token) => {
    if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);

    expiryTimerRef.current = setInterval(async () => {
      const t = localStorage.getItem('token');
      if (!t) { logout('token removed externally'); return; }

      const secs = secondsUntilExpiry(t);

      // Already expired
      if (secs < 0) {
        clearInterval(expiryTimerRef.current);
        toast.warn('Your session has expired. Please log in again.');
        logout('token expired');
        return;
      }

      // Within 5 minutes — attempt refresh
      if (secs < 300 && window.__refreshToken) {
        try {
          const newToken = await window.__refreshToken();
          if (newToken) {
            localStorage.setItem('token', newToken);
            tokenRef.current = newToken;
          } else {
            // Refresh returned nothing — let the next interval handle expiry
          }
        } catch {
          // Refresh failed — will log out when truly expired
        }
      }
    }, 60_000); // check every 60 s
  }, [logout]);

  // ── auth:unauthorized event from apiRequest ─────────────────────────────────
  useEffect(() => {
    const handler = () => {
      logout('401 from apiRequest');
    };
    window.addEventListener('auth:unauthorized', handler);
    return () => window.removeEventListener('auth:unauthorized', handler);
  }, [logout]);

  // ── Visibility-change re-validation ────────────────────────────────────────
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

  // ── Storage event: sync logout across tabs ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'token' && !e.newValue && isAuthenticated) {
        logout('token removed in another tab');
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [isAuthenticated, logout]);

  // ── Session restore on mount ─────────────────────────────────────────────────
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
        if (isMounted) {
          logout('stored token expired on mount');
        }
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
        setUser(userInfo);
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
  }, []); // intentionally runs once on mount

  // ── Login ────────────────────────────────────────────────────────────────────
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
      // Accept userInfo pre-fetched by the calling component (avoids extra round-trip)
      const resolvedUser = userInfo ?? await AuthService.getUser();
      if (resolvedUser) {
        setUser(resolvedUser);
        localStorage.setItem('User', JSON.stringify(resolvedUser));
      }

      maybeLogDailyStreak(cleanedToken);
      await setupSocket(resolvedUser ?? {});
      startExpiryWatch(cleanedToken);
    } catch (err) {
      console.error('[AuthContext] login setup failed:', err);
    }
  }, [setupSocket, startExpiryWatch]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (expiryTimerRef.current) clearInterval(expiryTimerRef.current);
      offConnectRef.current?.();
    };
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        user,
        token:    tokenRef.current,
        authtoken: tokenRef.current, // legacy alias
        loading,
        authError,
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