// src/Services/AuthService.js

import { reconnectSocket } from '../WebSocket/WebSocketClient';
import { setRefreshTokenFn } from '../utils/apiRequest';

const BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

const API_URL = `${BASE}/api/auth`;

// ── Constants ──────────────────────────────────────────────────────────────────
const AUTH_STORAGE_KEYS = ['token', 'User', 'refreshToken', 'notifications'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Strip whitespace and carriage returns that some proxies inject. */
const cleanToken = (raw) =>
  (raw ?? '').trim().replace(/\s/g, '');

/** Return true only when `t` looks like a well-formed JWT (three base64 segments). */
const isValidJwt = (t) =>
  typeof t === 'string' && t.split('.').length === 3 && t.length > 20;

/**
 * Normalise the user object returned by the backend so every consumer
 * always receives `{ id, _id, name, email, … }` regardless of which
 * endpoint populated the response.
 *
 * The login endpoint returns the raw Mongoose document (uses `_id`).
 * The getloggeduser endpoint explicitly maps `_id → id` in its response.
 * We ensure both fields are present so callers using either work correctly.
 */
function parseUser(raw) {
  if (!raw) return null;
  const id = raw.id?.toString() || raw._id?.toString() || null;
  return { ...raw, id, _id: id };
}

/**
 * Shared success-path handler used by login / signup / loginAdmin.
 * Validates the token, stores credentials, reconnects the socket, and
 * returns the canonical result object.
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
    // Non-fatal — socket reconnect failure should not block login
    console.warn('[AuthService] Socket reconnect failed after login:', sockErr?.message);
  }

  return { success: true, user, authtoken: token };
}

/** Build fetch options, merging in an optional AbortSignal. */
function buildFetchOptions(body, signal) {
  return {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
    ...(signal ? { signal } : {}),
  };
}

/** Central fetch wrapper that surfaces network errors as `{ success: false }`. */
async function apiFetch(url, options) {
  try {
    const res  = await fetch(url, options);
    const data = await res.json().catch(() => ({}));

    // Hybrid captcha fallback — backend signals v2 is required
    if (res.status === 403 && data.fallback === 'v2_required') {
      return { _raw: res, data, fallback: true };
    }

    return { _raw: res, data, ok: res.ok };
  } catch (err) {
    if (err.name === 'AbortError') throw err; // propagate cancellation
    console.error('[AuthService] fetch error:', err);
    return { _raw: null, data: {}, ok: false, networkError: true };
  }
}

// ── AuthService ───────────────────────────────────────────────────────────────

const AuthService = {

  /**
   * Log in with identifier (email | username | phone) + password.
   *
   * @param {{ identifier, password, captchaToken, captchaType, captchaAction, signal }} params
   */
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

    if (fallback)      return { success: false, fallback: 'v2_required' };
    if (networkError)  return { success: false, error: 'Login request failed. Check your network.' };
    if (!ok || !data.success || !data.authtoken || !data.user) {
      return { success: false, error: data.error || data.message || 'Login failed.' };
    }

    return handleAuthSuccess(data);
  },

  /**
   * Create a new account.
   *
   * @param {{ name, username, email, phone, password, referralno, role, captchaToken, captchaType, captchaAction, signal }} params
   */
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

    if (fallback)      return { success: false, fallback: 'v2_required' };
    if (networkError)  return { success: false, error: 'Signup request failed. Check your network.' };
    if (!ok || !data.success || !data.authtoken || !data.user) {
      return {
        success: false,
        error: data.message || data.error || data.errors?.[0]?.msg || 'Signup failed.',
      };
    }

    return handleAuthSuccess(data);
  },

  /**
   * Fetch the current user from the server using the stored token + user ID.
   * Returns null (never throws) on any failure so callers can decide action.
   *
   * @param {{ signal? }} [opts]
   */
  getUser: async ({ signal } = {}) => {
    const rawToken   = localStorage.getItem('token');
    const storedUser = localStorage.getItem('User');

    if (!rawToken || !storedUser) return null;

    // Validate token shape before hitting the network
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
   * Admin login — validates isAdmin AFTER confirming HTTP success.
   *
   * @param {{ identifier, password, captchaToken, captchaType, captchaAction, signal }} params
   */
  loginAdmin: async ({
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

    if (fallback)      return { success: false, fallback: 'v2_required' };
    if (networkError)  return { success: false, error: 'Login request failed. Check your network.' };
    if (!ok || !data.success || !data.authtoken || !data.user) {
      return { success: false, error: data.error || data.message || 'Admin login failed.' };
    }

    // Guard must come AFTER HTTP success is confirmed
    if (!data.user.isAdmin) {
      return { success: false, error: 'Access denied: not an admin.' };
    }

    return handleAuthSuccess(data);
  },

  /**
   * Client-side logout: clears all auth-related localStorage keys.
   * Socket teardown is intentionally NOT done here — AuthContext owns that.
   */
  logout: () => {
    AUTH_STORAGE_KEYS.forEach((k) => localStorage.removeItem(k));
  },

  /**
   * Token refresh stub.
   * Currently returns null (no server-side refresh endpoint).
   * Replace the body when the backend gains POST /api/auth/refresh.
   *
   * Must return Promise<string> (new token) or throw on failure.
   */
  refreshToken: async () => {
    // ── Future implementation ──────────────────────────────────────────────
    // const refreshToken = localStorage.getItem('refreshToken');
    // if (!refreshToken) return null;
    // const res = await fetch(`${BASE}/api/auth/refresh`, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ refreshToken }),
    // });
    // const data = await res.json();
    // if (!res.ok || !data.authtoken) throw new Error('Refresh failed');
    // return cleanToken(data.authtoken);
    // ─────────────────────────────────────────────────────────────────────
    return null;
  },
};

// Register the refresh function with apiRequest so the 401-retry queue works.
// When refreshToken() returns null, apiRequest falls through to the logout event.
setRefreshTokenFn(AuthService.refreshToken);

export default AuthService;