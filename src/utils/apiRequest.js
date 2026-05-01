/* src/utils/apiRequest.js — Fixed (single refresh queue, React Query safe) */

import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL =
  process.env.REACT_APP_SERVER_URL  ||
  process.env.REACT_APP_BACKEND_URL;

// ── Auth endpoints that must NOT trigger the auto-logout event ─────────────────
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/createuser',
  '/api/admin/adminlogin',
  '/api/otp/',
  '/api/auth/reset-password',
  '/api/auth/refresh',
];
const isAuthEndpoint = (url = '') =>
  AUTH_ENDPOINTS.some((ep) => url.includes(ep));

// ── Idempotent methods that are safe to retry ─────────────────────────────────
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);

// ── GET request deduplication cache ──────────────────────────────────────────
const inflightGets = new Map();

// ── Helpers ───────────────────────────────────────────────────────────────────
function readToken() {
  if (typeof window === 'undefined') return null;
  const t = localStorage.getItem('token');
  return t && t !== 'null' && t !== 'undefined' ? t : null;
}

function isSilenced(config) {
  return config?._silent === true || config?._silenceToast === true;
}

function shouldRetry(config, retryCount) {
  if (config?._retry === false) return false;
  if (retryCount >= 2) return false;
  const method = (config?.method ?? 'get').toLowerCase();
  return IDEMPOTENT_METHODS.has(method);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Axios instance ────────────────────────────────────────────────────────────
const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 12_000,
});

// ── Request interceptor ───────────────────────────────────────────────────────
apiRequest.interceptors.request.use(
  (config) => {
    config.headers    = config.headers ?? {};
    config._retryCount = config._retryCount ?? 0;

    // Attach token
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

    // ── GET deduplication ──────────────────────────────────────────────────
    if (
      method === 'get' &&
      config._dedup !== false &&
      !isAuthEndpoint(config.url)
    ) {
      const key = `${config.baseURL ?? ''}${config.url}${JSON.stringify(
        config.params ?? {}
      )}`;
      if (inflightGets.has(key)) {
        config._dedupKey    = key;
        config._dedupShared = true;
      } else {
        config._dedupKey = key;
      }
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
  (response) => {
    const key = response.config?._dedupKey;
    if (key) inflightGets.delete(key);
    return response;
  },

  async (error) => {
    const config = error.config ?? {};
    const status = error.response?.status;
    const data   = error.response?.data;
    const url    = config.url ?? '';
    const method = (config.method ?? 'get').toLowerCase();
    const silent = isSilenced(config);

    if (config._dedupKey) inflightGets.delete(config._dedupKey);

    // ── Cancelled requests ────────────────────────────────────────────────────
    if (
      error.code    === 'ERR_CANCELED'  ||
      error.name    === 'CanceledError' ||
      error.message === 'canceled'
    ) {
      return Promise.reject(error);
    }

    error.context = { url, method, status, data };

    // ── 401 handling — single source of truth: AuthContext's queue ────────────
    if (status === 401 && !isAuthEndpoint(url) && !config._isRetryAfterRefresh) {
      const queue = window.__tokenRefreshQueue;

      if (queue) {
        // If a refresh is already running, queue this request to replay later
        if (queue.isRefreshing.current) {
          return new Promise((resolve, reject) => {
            queue.subscribeTokenRefresh((newToken) => {
              if (!newToken) {
                reject(error);
                return;
              }
              config.headers.Authorization  = `Bearer ${newToken}`;
              config._isRetryAfterRefresh   = true;
              resolve(apiRequest(config));
            });
          });
        }

        // Start a refresh — mark in-flight BEFORE the async call
        queue.isRefreshing.current = true;

        try {
          const refreshFn = window.__refreshToken;
          const newToken  = refreshFn ? await refreshFn() : null;

          if (newToken) {
            localStorage.setItem('token', newToken);
            // AuthContext's onTokenRefreshed drains the subscriber queue
            // AND invalidates React Query (see AuthContext.js).
            queue.onTokenRefreshed(newToken);

            config.headers.Authorization = `Bearer ${newToken}`;
            config._isRetryAfterRefresh  = true;
            return apiRequest(config);
          } else {
            queue.onRefreshFailed();
          }
        } catch (refreshErr) {
          queue.onRefreshFailed();
        }
      }

      // No queue / refresh failed — trigger logout
      if (!silent) {
        const existingToken = readToken();
        if (existingToken && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        toast.error(data?.message || 'Session expired. Please log in again.');
      }
    }

    // ── Retry logic ───────────────────────────────────────────────────────────
    const retryCount  = config._retryCount ?? 0;
    const isRetryable =
      shouldRetry(config, retryCount) &&
      (error.code === 'ECONNABORTED' ||
       !error.response ||
       (status >= 500 && status < 600));

    if (isRetryable) {
      config._retryCount = retryCount + 1;
      const delay = 300 * Math.pow(2, retryCount);
      await sleep(delay);
      console.warn(`[apiRequest] Retry ${config._retryCount} → ${url}`);
      return apiRequest(config);
    }

    // ── Toast messages ────────────────────────────────────────────────────────
    if (!silent && typeof window !== 'undefined') {
      if (status === 403) {
        toast.error(data?.message || 'You do not have permission to do that.');
      } else if (status === 404) {
        console.warn('[apiRequest] 404:', url);
      } else if (status === 409) {
        toast.warn(data?.message || 'This action conflicts with existing data.');
      } else if (status === 413) {
        toast.error('File too large. Please upload a smaller file.');
      } else if (status === 422) {
        toast.error(data?.message || 'Invalid data submitted.');
      } else if (status === 429) {
        toast.warn('Too many requests. Please slow down.');
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else if (!error.response && error.code === 'ECONNABORTED') {
        toast.error('Request timed out. Please check your connection.');
      } else if (!error.response && error.request) {
        toast.error('Unable to reach server. Please check your network.');
      } else if (status && status !== 401) {
        toast.error(data?.message || 'Request failed.');
      }
    }

    if (status) {
      console.error(`[apiRequest] ${status}:`, url, data);
    }

    return Promise.reject(error);
  }
);

// ── Register AuthService refresh fn on window.__refreshToken ─────────────────
// Called by AuthService so the interceptor above can invoke it.
export function setRefreshTokenFn(fn) {
  if (typeof window !== 'undefined') window.__refreshToken = fn;
}

export default apiRequest;