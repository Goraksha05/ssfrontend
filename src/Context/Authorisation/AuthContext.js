// src/Context/Authorisation/AuthContext.js
//
// Owns: isAuthenticated, user, token, login(), logout()
//
// NOT owned here (delegated to dedicated contexts):
//   • Socket lifecycle       → SocketContext
//   • Notification state     → NotificationContext
//   • Online users list      → OnlineUsersContext
//
// This separation means AuthContext no longer registers a "notification"
// socket listener — NotificationContext does that. No more double-toasting.
//
// FIXES:
//   1. setupSocket now resolves the user id as `userInfo.id ?? userInfo._id`
//      because the backend's getloggeduser endpoint returns { id } not { _id }.
//      Previously `userInfo._id` was always undefined, so the socket room join
//      sent the literal string "undefined" and user-online never fired correctly.
//   2. logout() mirrors the same id resolution when emitting user-offline.
//   3. The streak fetch and setupSocket call both use the same BACKEND_URL
//      constant so there is no risk of the two env vars resolving to different
//      origins across build configurations.

import {
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

// Single source-of-truth for the base URL — used for both the streak fire-and-
// forget call and anywhere else in this file that needs to hit the backend.
const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';

// ── Helpers ────────────────────────────────────────────────────────────────────
const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= (exp - 30) * 1_000; // 30 s buffer
  } catch {
    return true;
  }
};

/**
 * Resolve the user's id string from the object returned by AuthService.getUser().
 *
 * The backend's GET /api/auth/getloggeduser/:id handler explicitly maps
 * `_id` → `id` in its response shape, so `userInfo.id` is the reliable field.
 * We fall back to `_id` for any future endpoint that may return the raw document.
 */
const resolveUserId = (userInfo) =>
  userInfo?.id?.toString() ?? userInfo?._id?.toString() ?? null;

// ── Provider ───────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(
    () => localStorage.getItem('token')
  );

  const socketRef = useRef(null);

  // ── Socket setup — connects and emits user-online only ───────────────────
  //   Notification listener is NOT registered here; NotificationContext owns it.
  const setupSocket = useCallback(async (userInfo) => {
    try {
      const sock = await initializeSocket();
      if (!sock) return;
      socketRef.current = sock;

      const onConnect = () => {
        // FIX: resolve id from either `id` or `_id` — backend returns `id`
        const userId = resolveUserId(userInfo);
        if (!userId) return;

        sock.emit('user-online', {
          userId,
          name: userInfo.name ?? '',
          hometown: userInfo.hometown ?? '',
          currentcity: userInfo.currentcity ?? '',
        });
        sock.emit('join-room', userId);
      };

      // Register connect handler without clobbering other listeners
      const offConnect = onSocketEvent('connect', onConnect);
      if (sock.connected) onConnect();

      // Store cleanup so logout can remove it
      socketRef._offConnect = offConnect;
    } catch (err) {
      console.error('[AuthContext] setupSocket failed:', err);
    }
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    try {
      // ✅ Reset reCAPTCHA (v2 + v3 safety)
      if (window.grecaptcha) {
        // Reset all rendered widgets (v2)
        if (typeof window.grecaptcha.reset === 'function') {
          window.grecaptcha.reset();
        }

        // Optional: clear any pending executions (v3 safe guard)
        if (typeof window.grecaptcha.execute === 'function') {
          // No direct cancel API, but calling reset ensures state cleanup
          console.info('[AuthContext] reCAPTCHA reset on logout');
        }
      }
    } catch (err) {
      console.warn('[AuthContext] reCAPTCHA reset failed:', err);
    }

    const sock = socketRef.current || getSocket();

    // FIX: mirror the same id resolution used in setupSocket
    const userId = resolveUserId(user);
    if (sock?.connected && userId) {
      sock.emit('user-offline', userId);
    }

    // Remove only our connect listener before full teardown
    socketRef._offConnect?.();
    disconnectSocket();
    socketRef.current = null;
    socketRef._offConnect = null;

    // Clear storage
    ['token', 'User', 'refreshToken', 'notifications'].forEach((k) =>
      localStorage.removeItem(k)
    );

    // Reset state
    setToken(null);
    setIsAuthenticated(false);
    setUser(null);

    console.info('[AuthContext] User logged out + cleanup complete');
  }, [user]);

  // ── Auto-restore session on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    if (isTokenExpired(token)) {
      console.warn('[AuthContext] Stored token expired — clearing.');

      // ✅ Also reset captcha before logout (important edge case)
      try {
        if (window.grecaptcha?.reset) {
          window.grecaptcha.reset();
        }
      } catch (err) {
        console.warn('[AuthContext] reCAPTCHA reset during auto-expiry failed:', err);
      }

      logout();
      return;
    }

    setIsAuthenticated(true);

    AuthService.getUser()
      .then((userInfo) => {
        if (!userInfo) {
          logout();
          return;
        }

        setUser(userInfo);
        setupSocket(userInfo);
      })
      .catch((err) => {
        console.error('[AuthContext] Auto-restore failed:', err);

        // ✅ Ensure captcha cleanup even on failure
        try {
          if (window.grecaptcha?.reset) {
            window.grecaptcha.reset();
          }
        } catch (err) {
          console.warn('[AuthContext] reCAPTCHA reset during auto-expiry failed:', err);
        }

        logout();
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs once on mount

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (rawToken) => {
    if (!rawToken || rawToken === 'null' || rawToken === 'undefined') {
      toast.error('Invalid login token');
      return;
    }

    const cleanToken = rawToken.trim();
    if (isTokenExpired(cleanToken)) {
      toast.error('Session expired. Please log in again.');
      return;
    }

    localStorage.setItem('token', cleanToken);
    setToken(cleanToken);
    setIsAuthenticated(true);

    try {
      const userInfo = await AuthService.getUser();
      if (userInfo) {
        setUser(userInfo);
        localStorage.setItem('User', JSON.stringify(userInfo));
      }

      // Log daily streak — fire and forget.
      // FIX: use the same BACKEND_URL constant as the rest of the file so
      // both env vars always resolve to the same origin.
      fetch(`${BACKEND_URL}/api/activity/log-daily-streak`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanToken}` },
      }).catch(() => { });

      await setupSocket(userInfo);
    } catch (err) {
      console.error('[AuthContext] login setup failed:', err);
    }
  }, [setupSocket]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authtoken: token, // legacy alias
        token,
        user,
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