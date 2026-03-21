// src/Services/AuthService.js
//
// Thin service layer for auth API calls.
// Does NOT manage React state — that belongs in AuthContext.
//
// Changes from original:
//   • logout() uses disconnectSocket() instead of the broken window.socket hack
//   • loginAdmin() stores the cleaned token (was storing raw)
//   • Consistent token cleaning across all methods
//   • API_URL falls back gracefully if both env vars are missing

import { reconnectSocket, disconnectSocket } from '../WebSocket/WebSocketClient';

const BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL ||
  '';

const API_URL = `${BASE}/api/auth`;

// ─── Token helper ─────────────────────────────────────────────────────────────
const cleanToken = (raw) => (raw ?? '').trim().replace(/\s/g, '');

// ─── AuthService ──────────────────────────────────────────────────────────────
const AuthService = {

  /** Log in with identifier (username | email | phone) + password */
  login: async ({ identifier, password }) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (res.ok && data.success && data.authtoken && data.user) {
        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);

        const user = { ...data.user, id: data.user._id || data.user.id };
        localStorage.setItem('User', JSON.stringify(user));

        await reconnectSocket();
        return { success: true, user, authtoken: token };
      }

      return { success: false, error: data.error || 'Login failed' };
    } catch (err) {
      console.error('[AuthService] login error:', err);
      return { success: false, error: 'Login request failed' };
    }
  },

  /** Create a new account */
  signup: async ({ name, username, email, phone, password, referralno, role }) => {
    try {
      const res = await fetch(`${API_URL}/createuser`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, username, email, phone, password, referralno, role }),
      });
      const data = await res.json();

      if (res.ok && data.authtoken) {
        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);

        const user = { ...data.user, id: data.user._id || data.user.id };
        localStorage.setItem('User', JSON.stringify(user));

        await reconnectSocket();
        return { success: true, user, authtoken: token };
      }

      return { success: false, error: data.message || data.error || 'Signup failed' };
    } catch (err) {
      console.error('[AuthService] signup error:', err);
      return { success: false, error: 'Signup request failed' };
    }
  },

  /**
   * Fetch the current user from the server.
   * Falls back to null (not throws) so callers can decide what to do.
   */
  getUser: async () => {
    const rawToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('User');

    if (!rawToken || !storedUser) return null;

    try {
      const user = JSON.parse(storedUser);
      const userId = user?.id || user?._id;
      if (!userId) { console.warn('[AuthService] getUser: no user ID'); return null; }

      const res = await fetch(`${API_URL}/getloggeduser/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cleanToken(rawToken)}`,
        },
      });
      const data = await res.json();
      return data.success ? data.user : null;
    } catch (err) {
      console.error('[AuthService] getUser error:', err);
      return null;
    }
  },

  /**
   * Client-side logout: clears storage and disconnects socket.
   * AuthContext.logout() handles React state — this handles storage/socket.
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('User');
    disconnectSocket(); // from WebSocketClient — safe even if not connected
  },

  /** Admin login — validates isAdmin flag before accepting */
  loginAdmin: async ({ identifier, password }) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      const data = await res.json();

      if (!data.user?.isAdmin) {
        return { success: false, error: 'Access denied: not an admin' };
      }

      if (res.ok && data.success && data.authtoken) {
        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);
        localStorage.setItem('User', JSON.stringify(data.user));
        await reconnectSocket();
        return { success: true, user: data.user, authtoken: token };
      }

      return { success: false, error: data.error || 'Admin login failed' };
    } catch (err) {
      console.error('[AuthService] loginAdmin error:', err);
      return { success: false, error: 'Login request failed' };
    }
  },
};

export default AuthService;