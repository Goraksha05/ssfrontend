// src/Context/Authorisation/AuthContext.js — Improved
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
} from '../../WebSocket/WebSocketClient';
import AuthService from '../../Services/AuthService';

const AuthContext = createContext(null);

const API_URL =
  process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';

// ── Helpers ────────────────────────────────────────────────────────────────────
/** Safely parse JSON from localStorage, returns fallback on error */
const safeParse = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

/** Check if a JWT token is expired (with 30 s buffer) */
const isTokenExpired = (token) => {
  try {
    const { exp } = jwtDecode(token);
    return Date.now() >= (exp - 30) * 1000;
  } catch {
    return true;
  }
};

// ── Provider ───────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated,    setIsAuthenticated]    = useState(false);
  const [user,               setUser]               = useState(null);
  const [token,              setToken]              = useState(() => localStorage.getItem('token'));
  const [notificationCount,  setNotificationCount]  = useState(0);
  const [notifications,      setNotifications]      = useState(() => safeParse('notifications', []));

  const socketRef      = useRef(null);
  const refreshTimerRef = useRef(null);

  // ── Sync notifications → localStorage + badge ───────────────────────────────
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
    setNotificationCount(notifications.filter((n) => !n.isRead).length);
  }, [notifications]);

  // ── Mark notification as read ───────────────────────────────────────────────
  const markNotificationRead = useCallback((notifId) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === notifId ? { ...n, isRead: true } : n))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // ── Cleanup socket ──────────────────────────────────────────────────────────
  const cleanupSocket = useCallback(() => {
    const sock = socketRef.current || getSocket();
    if (sock) {
      sock.removeAllListeners();
      sock.disconnect();
    }
    disconnectSocket();
    socketRef.current = null;
  }, []);

  // ── Logout ──────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    const sock = socketRef.current || getSocket();
    if (sock?.connected && user?._id) {
      sock.emit('user-offline', user._id);
    }
    cleanupSocket();
    clearInterval(refreshTimerRef.current);

    ['token', 'User', 'refreshToken', 'notifications'].forEach((k) =>
      localStorage.removeItem(k)
    );

    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
    setNotificationCount(0);
    setNotifications([]);
  }, [user, cleanupSocket]);

  // ── Setup socket (called after login or session restore) ────────────────────
  const setupSocket = useCallback(async (userInfo, cleanToken) => {
    try {
      const sock = await initializeSocket();
      if (!sock) return;
      socketRef.current = sock;

      const onConnect = () => {
        sock.off('notification');
        sock.on('notification', (payload) => {
          // Prevent toasting the same notification twice (by _id)
          setNotifications((prev) => {
            if (payload._id && prev.some((n) => n._id === payload._id)) return prev;
            toast.info(payload.message || 'New notification', { autoClose: 4000 });
            return [payload, ...prev];
          });
          setNotificationCount((c) => c + 1);
        });

        if (userInfo?._id) {
          const presence = {
            userId:      userInfo._id,
            name:        userInfo.name,
            hometown:    userInfo.hometown,
            currentcity: userInfo.currentcity,
            timestamp:   new Date().toISOString(),
          };
          sock.emit('user-online', presence);
          sock.emit('join-room', String(userInfo._id));
        }
      };

      if (sock.connected) onConnect();
      else sock.once('connect', onConnect);

      sock.on('connect_error', (err) =>
        console.error('[AuthContext] Socket error:', err.message)
      );
    } catch (err) {
      console.error('[AuthContext] setupSocket failed:', err);
    }
  }, []);

  // ── Auto-restore session on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    // Guard: expired token → clear immediately
    if (isTokenExpired(token)) {
      console.warn('[AuthContext] Stored token is expired — clearing.');
      logout();
      return;
    }

    setIsAuthenticated(true);
    AuthService.getUser()
      .then((userInfo) => {
        if (!userInfo) { logout(); return; }
        setUser(userInfo);
        setupSocket(userInfo, token);
      })
      .catch((err) => {
        console.error('[AuthContext] Auto-restore failed:', err);
        logout();
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Login ───────────────────────────────────────────────────────────────────
  const login = useCallback(async (rawToken) => {
    if (!rawToken || rawToken === 'null' || rawToken === 'undefined') {
      toast.error('Invalid login token');
      return;
    }

    const cleanToken = rawToken.trim();

    if (isTokenExpired(cleanToken)) {
      toast.error('Session token has expired. Please log in again.');
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

      // Log daily streak (fire-and-forget — failure is non-critical)
      fetch(`${API_URL}/api/activity/log-daily-streak`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${cleanToken}` },
      }).catch(() => {});

      await setupSocket(userInfo, cleanToken);
    } catch (err) {
      console.error('[AuthContext] login setup failed:', err);
    }
  }, [setupSocket]);

  // ── Context value ───────────────────────────────────────────────────────────
  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        authtoken: token,   // legacy alias
        token,
        user,
        login,
        logout,
        notificationCount,
        setNotificationCount,
        notifications,
        setNotifications,
        markNotificationRead,
        clearNotifications,
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