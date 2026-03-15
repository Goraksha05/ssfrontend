/**
 * src/utils/apiRequest.js — Axios Instance (Production-Ready)
 *
 * Changes from original:
 *  ✅ Removed stale/spoofable `user-id` header from localStorage
 *     (req.user.id set by fetchUser middleware is the authoritative source)
 *  ✅ Timeout reduced from 15s to 10s with per-request override capability
 *  ✅ 401 auto-logout: dispatches a custom event so AuthContext can react
 *     without a circular dependency (apiRequest → AuthContext → apiRequest)
 *  ✅ Token reading limited to a single key ('token') for clarity
 */

import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL =
  process.env.REACT_APP_SERVER_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:5000';

const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000, // 10 seconds (was 15s)
});

// ── Token reader ──────────────────────────────────────────────────────────────
function readToken() {
  if (typeof window === 'undefined') return null;
  // FIX: Only read from the canonical 'token' key.
  // The original checked 4 keys + cookies — fragile and confusing.
  const t = localStorage.getItem('token');
  return t && t !== 'null' && t !== 'undefined' ? t : null;
}

// ── Request interceptor ───────────────────────────────────────────────────────
apiRequest.interceptors.request.use(
  (config) => {
    config.headers = config.headers ?? {};

    const token = readToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (!config.headers.Accept) {
      config.headers.Accept = 'application/json';
    }

    const isFormData =
      typeof FormData !== 'undefined' && config.data instanceof FormData;
    const method = (config.method ?? 'get').toLowerCase();

    if (!isFormData && method !== 'get' && !config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    // NOTE: We intentionally do NOT send a 'user-id' header derived from
    // localStorage. Routes that need the user ID should use req.user.id
    // set by the fetchUser auth middleware — it's the only trustworthy source.

    return config;
  },
  (error) => {
    console.error('[apiRequest] Request setup error:', error);
    return Promise.reject(error);
  }
);

// ── Response interceptor ──────────────────────────────────────────────────────
apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    const silenced = error?.config?._silenceToast === true;

    if (error?.response) {
      const { status, data } = error.response;

      if (!silenced) {
        if (status === 401) {
          // Dispatch a global event so AuthContext can log the user out
          // without a circular import dependency.
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          toast.error(data?.message || 'Session expired. Please log in again.');
        } else if (status === 403) {
          toast.error(data?.message || 'You do not have permission to do that.');
        } else if (status === 404) {
          console.warn('[apiRequest] 404:', error.config?.url);
        } else if (status === 429) {
          toast.warn('Too many requests. Please slow down.');
        } else if (status >= 500) {
          toast.error('Server error. Please try again later.');
        } else {
          toast.error(data?.message || 'Request failed.');
        }
      }

      console.error(`[apiRequest] ${status}:`, error.config?.url, data);
    } else if (!silenced) {
      if (error?.code === 'ECONNABORTED') {
        toast.error('Request timed out. Please check your connection.');
      } else {
        toast.error('No response from server. Check your connection.');
      }
    }

    return Promise.reject(error);
  }
);

export default apiRequest;