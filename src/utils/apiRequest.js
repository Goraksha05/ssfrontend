/* src/utils/apiRequest.js — Axios Instance (Production-Ready) */

import axios from 'axios';
import { toast } from 'react-toastify';

const BASE_URL =
  process.env.REACT_APP_SERVER_URL  ||
  process.env.REACT_APP_BACKEND_URL;
  /*// 'http://127.0.0.1:5000';*/

// ── Auth endpoints that must NOT trigger the auto-logout event ─────────────────
const AUTH_ENDPOINTS = [
  '/api/auth/login',
  '/api/auth/createuser',
  '/api/admin/adminlogin',
  '/api/otp/',
  '/api/auth/reset-password',
];
const isAuthEndpoint = (url = '') =>
  AUTH_ENDPOINTS.some((ep) => url.includes(ep));

// ── Idempotent methods that are safe to retry ─────────────────────────────────
const IDEMPOTENT_METHODS = new Set(['get', 'head', 'options']);

// ── GET request deduplication cache ──────────────────────────────────────────
// Maps cacheKey → Promise. Cleared when the promise settles.
const inflightGets = new Map();

// ── Token-refresh queue ───────────────────────────────────────────────────────
let isRefreshing  = false;
let refreshQueue  = [];          // [{ resolve, reject }]

function processRefreshQueue(newToken, error) {
  refreshQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(newToken)
  );
  refreshQueue = [];
}

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
    config.headers = config.headers ?? {};
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

    // ── GET deduplication ─────────────────────────────────────────────────────
    // Only deduplicate non-auth, non-silent GETs that haven't opted out.
    if (
      method === 'get' &&
      config._dedup !== false &&
      !isAuthEndpoint(config.url)
    ) {
      const key = `${config.baseURL ?? ''}${config.url}${JSON.stringify(config.params ?? {})}`;
      if (inflightGets.has(key)) {
        // Attach the key so the response interceptor knows to skip re-caching
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
    // Clean up GET dedup cache on success
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

    // Clean up GET dedup cache on error
    if (config._dedupKey) inflightGets.delete(config._dedupKey);

    // ── Cancelled requests — never retry or toast ─────────────────────────────
    if (
      error.code    === 'ERR_CANCELED'  ||
      error.name    === 'CanceledError' ||
      error.message === 'canceled'
    ) {
      return Promise.reject(error);
    }

    // ── Attach structured context for upstream catch handlers ─────────────────
    error.context = { url, method, status, data };

    // ── 401 handling ──────────────────────────────────────────────────────────
    if (status === 401) {
      const refreshFn = typeof window !== 'undefined' && window.__refreshToken;
      if (refreshFn && !isAuthEndpoint(url) && !config._isRetryAfterRefresh) {
        if (isRefreshing) {
          // Queue this request until the refresh resolves
          return new Promise((resolve, reject) => {
            refreshQueue.push({ resolve, reject });
          }).then((newToken) => {
            config.headers.Authorization = `Bearer ${newToken}`;
            config._isRetryAfterRefresh  = true;
            return apiRequest(config);
          });
        }

        isRefreshing = true;
        try {
          const newToken = await refreshFn();
          if (newToken) {
            localStorage.setItem('token', newToken);
            processRefreshQueue(newToken, null);
            config.headers.Authorization = `Bearer ${newToken}`;
            config._isRetryAfterRefresh  = true;
            return apiRequest(config);
          }
        } catch (refreshError) {
          processRefreshQueue(null, refreshError);
        } finally {
          isRefreshing = false;
        }
      }

      // No refresh available — dispatch logout event (only for non-auth endpoints)
      if (!isAuthEndpoint(url) && !silent) {
        const existingToken = readToken();
        if (existingToken && typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:unauthorized'));
        }
        toast.error(data?.message || 'Session expired. Please log in again.');
      }
    }

    // ── Retry logic (idempotent requests only) ────────────────────────────────
    const retryCount = config._retryCount ?? 0;
    const isRetryable =
      shouldRetry(config, retryCount) &&
      (error.code === 'ECONNABORTED' ||   // timeout
       !error.response ||                  // network failure
       (status >= 500 && status < 600));   // server error

    if (isRetryable) {
      config._retryCount = retryCount + 1;
      const delay = 300 * Math.pow(2, retryCount); // 300ms, 600ms
      await sleep(delay);
      console.warn(`[apiRequest] Retry ${config._retryCount} → ${url}`);
      return apiRequest(config);
    }

    // ── Toast messages ────────────────────────────────────────────────────────
    if (!silent && typeof window !== 'undefined') {
      if (status === 403) {
        toast.error(data?.message || 'You do not have permission to do that.');
      } else if (status === 404) {
        // 404s are usually handled by the caller — just log, don't toast
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
        // Catch-all for other 4xx (except 401 already handled above)
        toast.error(data?.message || 'Request failed.');
      }
    }

    if (status) {
      console.error(`[apiRequest] ${status}:`, url, data);
    }

    return Promise.reject(error);
  }
);


export function setRefreshTokenFn(fn) {
  if (typeof window !== 'undefined') window.__refreshToken = fn;
}

export default apiRequest;