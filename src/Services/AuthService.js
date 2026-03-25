// src/Services/AuthService.js
//
// Thin service layer for auth API calls.
// Does NOT manage React state — that belongs in AuthContext.
//


import { reconnectSocket } from '../WebSocket/WebSocketClient';

const BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL ||
  '';

const API_URL = `${BASE}/api/auth`;

// ─── Token helper ─────────────────────────────────────────────────────────────
const cleanToken = (raw) => (raw ?? '').trim().replace(/\s/g, '');

// ─── AuthService ──────────────────────────────────────────────────────────────
const AuthService = {

  /**
   * Log in with identifier (email | username | phone) + password.
   * On success stores token + user in localStorage and reconnects the socket.
   */
  login: async ({ identifier, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      // Hybrid fallback — backend signals v2 is required
      if (res.status === 403 && data.fallback === 'v2_required') {
        return { success: false, fallback: 'v2_required' };
      }

      if (res.ok && data.success && data.authtoken && data.user) {
        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);

        // Normalise: backend returns `id` (not `_id`) from getloggeduser but
        // the login endpoint exposes the raw document which uses `_id`.
        // Store both so downstream code using either field works correctly.
        const user = { ...data.user, id: data.user._id || data.user.id };
        localStorage.setItem('User', JSON.stringify(user));

        await reconnectSocket();
        return { success: true, user, authtoken: token };
      }

      return {
        success: false,
        error: data.error || data.message || 'Login failed',
      };
    } catch (err) {
      console.error('[AuthService] login error:', err);
      return { success: false, error: 'Login request failed' };
    }
  },

  /**
   * Create a new account.
   * On success stores token + user in localStorage and reconnects the socket.
   *
   * FIX 3: now checks `data.success` in addition to `data.authtoken` to match
   * the backend's createuser response contract exactly.
   */
  signup: async ({ name, username, email, phone, password, referralno, role, captchaToken, captchaType = 'v3', captchaAction = 'signup' }) => {
    try {
      const res = await fetch(`${API_URL}/createuser`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name, username, email, phone, password, referralno, role, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      // Hybrid fallback
      if (res.status === 403 && data.fallback === 'v2_required') {
        return { success: false, fallback: 'v2_required' };
      }

      // FIX 3: backend returns { success: true, authtoken, user } — check all three
      if (res.ok && data.success && data.authtoken && data.user) {
        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);

        const user = { ...data.user, id: data.user._id || data.user.id };
        localStorage.setItem('User', JSON.stringify(user));

        await reconnectSocket();
        return { success: true, user, authtoken: token };
      }

      return {
        success: false,
        error: data.message || data.error || data.errors?.[0]?.msg || 'Signup failed',
      };
    } catch (err) {
      console.error('[AuthService] signup error:', err);
      return { success: false, error: 'Signup request failed' };
    }
  },

  /**
   * Fetch the current user from the server using the token + stored user ID.
   * Returns null on any failure so callers decide what to do (not throws).
   *
   * FIX 2: checks res.ok before attempting to parse the body as a success
   * response so callers receive a meaningful null on 401/500 instead of a
   * silent null that looks the same as "user not found".
   */
  getUser: async () => {
    const rawToken   = localStorage.getItem('token');
    const storedUser = localStorage.getItem('User');

    if (!rawToken || !storedUser) return null;

    let userId;
    try {
      const parsed = JSON.parse(storedUser);
      userId = parsed?.id || parsed?._id;
    } catch {
      console.warn('[AuthService] getUser: could not parse stored User');
      return null;
    }

    if (!userId) {
      console.warn('[AuthService] getUser: no user ID in stored User');
      return null;
    }

    try {
      const res = await fetch(`${API_URL}/getloggeduser/${userId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization:  `Bearer ${cleanToken(rawToken)}`,
        },
      });

      // FIX 2: distinguish HTTP errors from "user not found" application errors
      if (!res.ok) {
        console.warn(`[AuthService] getUser: server responded ${res.status}`);
        return null;
      }

      const data = await res.json();
      return data.success ? data.user : null;
    } catch (err) {
      console.error('[AuthService] getUser error:', err);
      return null;
    }
  },

  /**
   * Client-side storage cleanup.
   *
   * FIX 4: This method now ONLY clears localStorage.
   * Socket disconnection is AuthContext's responsibility because it owns the
   * socket lifecycle (socketRef, onConnect listeners, user-offline emission).
   * Calling disconnectSocket() here as well caused double-disconnect races
   * when AuthContext.logout() and AuthService.logout() were both called, and
   * could clear tokens written by a concurrent login.
   *
   * AuthContext.logout() calls this method for storage cleanup, then handles
   * socket teardown itself. Do NOT add socket logic back here.
   */
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('User');
  },

  /**
   * Admin login — identical to login() but validates the isAdmin flag
   * AFTER confirming the HTTP request succeeded.
   *
   * FIX 1: the admin guard now runs only inside the `res.ok` branch.
   * Previously `if (!data.user?.isAdmin)` ran first, so any network error
   * or server error (where data.user is undefined) returned the misleading
   * "Access denied: not an admin" message instead of the real error.
   */
  loginAdmin: async ({ identifier, password, captchaToken, captchaType = 'v3', captchaAction = 'login' }) => {
    try {
      const res = await fetch(`${API_URL}/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ identifier, password, captchaToken, captchaType, captchaAction }),
      });

      const data = await res.json();

      // Hybrid fallback
      if (res.status === 403 && data.fallback === 'v2_required') {
        return { success: false, fallback: 'v2_required' };
      }      

      // FIX 1: check HTTP success first, THEN validate admin role
      if (res.ok && data.success && data.authtoken && data.user) {
        if (!data.user.isAdmin) {
          return { success: false, error: 'Access denied: not an admin' };
        }

        const token = cleanToken(data.authtoken);
        localStorage.setItem('token', token);

        // Normalise id field for consistency with login()
        const user = { ...data.user, id: data.user._id || data.user.id };
        localStorage.setItem('User', JSON.stringify(user));

        await reconnectSocket();
        return { success: true, user, authtoken: token };
      }

      return {
        success: false,
        error: data.error || data.message || 'Admin login failed',
      };
    } catch (err) {
      console.error('[AuthService] loginAdmin error:', err);
      return { success: false, error: 'Login request failed' };
    }
  },
};

export default AuthService;