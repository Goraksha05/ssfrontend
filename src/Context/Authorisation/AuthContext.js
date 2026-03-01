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

const API_URL =
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

// ── Provider ───────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user,            setUser]            = useState(null);
  const [token,           setToken]           = useState(
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
        if (!userInfo?._id) return;
        sock.emit('user-online', {
          userId:      userInfo._id,
          name:        userInfo.name,
          hometown:    userInfo.hometown    ?? '',
          currentcity: userInfo.currentcity ?? '',
        });
        sock.emit('join-room', String(userInfo._id));
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
    const sock = socketRef.current || getSocket();
    if (sock?.connected && user?._id) {
      sock.emit('user-offline', user._id);
    }
    // Remove only our connect listener before full teardown
    socketRef._offConnect?.();
    disconnectSocket();
    socketRef.current     = null;
    socketRef._offConnect = null;

    ['token', 'User', 'refreshToken', 'notifications'].forEach((k) =>
      localStorage.removeItem(k)
    );

    setToken(null);
    setIsAuthenticated(false);
    setUser(null);
  }, [user]);

  // ── Auto-restore session on mount ─────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    if (isTokenExpired(token)) {
      console.warn('[AuthContext] Stored token expired — clearing.');
      logout();
      return;
    }

    setIsAuthenticated(true);

    AuthService.getUser()
      .then((userInfo) => {
        if (!userInfo) { logout(); return; }
        setUser(userInfo);
        setupSocket(userInfo);
      })
      .catch((err) => {
        console.error('[AuthContext] Auto-restore failed:', err);
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

      // Log daily streak — fire and forget
      fetch(`${API_URL}/api/activity/log-daily-streak`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${cleanToken}` },
      }).catch(() => {});

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