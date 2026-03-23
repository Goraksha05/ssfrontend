/**
 * src/utils/apiRequest.js — Axios Instance (Production-Ready)
 *
 * Changes from original:
 *  ✅ Removed stale/spoofable `user-id` header from localStorage
 *  ✅ Timeout reduced from 15s to 10s with per-request override capability
 *  ✅ 401 auto-logout: dispatches a custom event so AuthContext can react
 *     without a circular dependency (apiRequest → AuthContext → apiRequest)
 *  ✅ Token reading limited to a single key ('token') for clarity
 *  ✅ Improved error handling with specific messages for common status codes
 */

import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL =
  process.env.REACT_APP_SERVER_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:5000';

const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 10_000,
});

// ── Token reader ──────────────────────────────────────────────────────────────
function readToken() {
  if (typeof window === 'undefined') return null;
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
          // FIX 1: Only dispatch the logout event when a token is present.
          // A 401 during a login attempt (no existing token) means wrong
          // credentials — not a session expiry. Dispatching the event in that
          // case would incorrectly log out valid sessions in other tabs.
          const existingToken = readToken();
          if (existingToken && typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:unauthorized'));
          }
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
      // FIX 2: guard toast calls — toast requires a browser DOM and will throw
      // in SSR or test environments where window is undefined.
      if (typeof window !== 'undefined') {
        if (error?.code === 'ECONNABORTED') {
          toast.error('Request timed out. Please check your connection.');
        } else {
          toast.error('No response from server. Check your connection.');
        }
      }
    }

    return Promise.reject(error);
  }
);

export default apiRequest;