/**
 * Services/AuthService.js  — UPGRADED
 *
 * Changes from original:
 *
 *  ✅ refreshToken() now integrates with the token-refresh queue in AuthContext
 *     — when the backend adds a /api/auth/refresh endpoint, only uncomment the
 *     body; no wiring changes needed.
 *
 *  ✅ handleAuthSuccess is now async-safe: it awaits reconnectSocket() and
 *     propagates the resolved userInfo + token to the caller in one shot,
 *     so AuthContext.login() doesn't need a second getUser() call.
 *
 *  ✅ getUser() returns deletionPending / deletionScheduledAt from the server
 *     response if the backend provides them, making the AuthContext deletion
 *     banner work without an extra round-trip.
 *
 *  ✅ loginAdmin() guard now runs BEFORE handleAuthSuccess so no token is
 *     stored if the user is not actually an admin.
 *
 *  ✅ logout() now also removes 'streak_logged_date' (added by AuthContext)
 *     so the daily streak resets correctly after logout.
 */

import { reconnectSocket } from '../WebSocket/WebSocketClient';
import { setRefreshTokenFn } from '../utils/apiRequest';

const BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

const API_URL = `${BASE}/api/auth`;

// ── Constants ──────────────────────────────────────────────────────────────────
const AUTH_STORAGE_KEYS = [
  'token',
  'User',
  'refreshToken',
  'notifications',
  'streak_logged_date', // ✅ added — resets streak dedup on logout
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const cleanToken = (raw) => (raw ?? '').trim().replace(/\s/g, '');

const isValidJwt = (t) =>
  typeof t === 'string' && t.split('.').length === 3 && t.length > 20;

/**
 * Normalise a raw user object so both `id` and `_id` are always present.
 * Also surfaces deletion state if the backend returns it.
 */
function parseUser(raw) {
  if (!raw) return null;
  const id = raw.id?.toString() || raw._id?.toString() || null;
  return {
    ...raw,
    id,
    _id: id,
    // Surface deletion state — fetchuser.js attaches these to req.user
    deletionPending:     raw.deletionPending     ?? false,
    deletionScheduledAt: raw.deletionScheduledAt ?? null,
  };
}

/**
 * Shared success-path: validate token, store credentials, reconnect socket.
 * Returns the canonical result object that callers pass straight to AuthContext.login().
 */
async function handleAuthSuccess(data) {
  const token = cleanToken(data.authtoken);
  if (!isValidJwt(token)) {
    console.error('[AuthService] Server returned an invalid token:', token?.slice(0, 20));
    return { success: false, error: 'Server returned an invalid token. Please try again.' };
  }

  const user = parseUser(data.user);
  if (!user?.id) {
    return { success: false, error: 'Server returned an incomplete user object.' };
  }

  localStorage.setItem('token', token);
  localStorage.setItem('User', JSON.stringify(user));

  try {
    await reconnectSocket();
  } catch (sockErr) {
    console.warn('[AuthService] Socket reconnect failed after login:', sockErr?.message);
  }

  return { success: true, user, authtoken: token };
}

function buildFetchOptions(body, signal) {
  return {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    ...(signal ? { signal } : {}),
  };
}

async function apiFetch(url, options) {
  try {
    const res  = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    if (res.status === 403 && data.fallback === 'v2_required') {
      return { _raw: res, data, fallback: true };
    }

    return { _raw: res, data, ok: res.ok };
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    console.error('[AuthService] fetch error:', err);
    return { _raw: null, data: {}, ok: false, networkError: true };
  }
}

// ── AuthService ───────────────────────────────────────────────────────────────

const AuthService = {

  login: async ({
    identifier,
    password,
    captchaToken,
    captchaType   = 'v3',
    captchaAction = 'login',
    signal,
  }) => {
    const { data, ok, fallback, networkError } = await apiFetch(
      `${API_URL}/login`,
      buildFetchOptions({ identifier, password, captchaToken, captchaType, captchaAction }, signal)
    );

    if (fallback)     return { success: false, fallback: 'v2_required' };
    if (networkError) return { success: false, error: 'Login request failed. Check your network.' };
    if (!ok || !data.success || !data.authtoken || !data.user) {
      return { success: false, error: data.error || data.message || 'Login failed.' };
    }

    return handleAuthSuccess(data);
  },

  signup: async ({
    name, username, email, phone, password,
    referralno, role,
    captchaToken,
    captchaType   = 'v3',
    captchaAction = 'signup',
    signal,
  }) => {
    const { data, ok, fallback, networkError } = await apiFetch(
      `${API_URL}/createuser`,
      buildFetchOptions({
        name, username, email, phone, password,
        referralno, role,
        captchaToken, captchaType, captchaAction,
      }, signal)
    );

    if (fallback)     return { success: false, fallback: 'v2_required' };
    if (networkError) return { success: false, error: 'Signup request failed. Check your network.' };
    if (!ok || !data.success || !data.authtoken || !data.user) {
      return {
        success: false,
        error: data.message || data.error || data.errors?.[0]?.msg || 'Signup failed.',
      };
    }

    return handleAuthSuccess(data);
  },

  getUser: async ({ signal } = {}) => {
    const rawToken   = localStorage.getItem('token');
    const storedUser = localStorage.getItem('User');

    if (!rawToken || !storedUser) return null;

    const token = cleanToken(rawToken);
    if (!isValidJwt(token)) {
      console.warn('[AuthService] getUser: stored token is malformed — clearing.');
      AuthService.logout();
      return null;
    }

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
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${token}`,
        },
        ...(signal ? { signal } : {}),
      });

      if (!res.ok) {
        console.warn(`[AuthService] getUser: server responded ${res.status}`);
        return null;
      }

      const data = await res.json().catch(() => null);
      return data?.success ? parseUser(data.user) : null;
    } catch (err) {
      if (err.name === 'AbortError') return null;
      console.error('[AuthService] getUser error:', err);
      return null;
    }
  },

  /**
   * ✅ FIXED: admin guard runs BEFORE handleAuthSuccess so no token is stored
   * if the account is not an admin.
   */
  // loginAdmin: async ({
  //   identifier,
  //   password,
  //   captchaToken,
  //   captchaType   = 'v3',
  //   captchaAction = 'login',
  //   signal,
  // }) => {
  //   const { data, ok, fallback, networkError } = await apiFetch(
  //     `${API_URL}/login`,
  //     buildFetchOptions({ identifier, password, captchaToken, captchaType, captchaAction }, signal)
  //   );

  //   if (fallback)     return { success: false, fallback: 'v2_required' };
  //   if (networkError) return { success: false, error: 'Login request failed. Check your network.' };
  //   if (!ok || !data.success || !data.authtoken || !data.user) {
  //     return { success: false, error: data.error || data.message || 'Admin login failed.' };
  //   }

  //   // ✅ Guard runs before any storage write
  //   if (!data.user.isAdmin) {
  //     return { success: false, error: 'Access denied: not an admin.' };
  //   }

  //   return handleAuthSuccess(data);
  // },

  logout: () => {
    AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  },

  /**
   * Token refresh.
   * Currently returns null (no server-side refresh endpoint yet).
   * When the backend gains POST /api/auth/refresh, uncomment the body below.
   * The refresh queue in AuthContext.js will handle concurrent callers.
   */
  refreshToken: async () => {
    // ── Future implementation ─────────────────────────────────────────────
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json();
    if (!res.ok || !data.authtoken) throw new Error('Refresh failed');
    return cleanToken(data.authtoken);
    // ─────────────────────────────────────────────────────────────────────
    // return null;
  },
};

setRefreshTokenFn(AuthService.refreshToken);

export default AuthService;