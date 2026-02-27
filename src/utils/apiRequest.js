// src/utils/apiRequest.js
import axios from 'axios';
import { toast } from 'react-toastify';

// Base URL (falls back to localhost if env not present)
const BASE_URL = process.env.REACT_APP_SERVER_URL || process.env.REACT_APP_BACKEND_URL || 'http://127.0.0.1:5000';

// Create axios instance
const apiRequest = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

// Helper: read token from common localStorage keys or cookie
function readToken() {
  if (typeof window === 'undefined') return null;

  const keys = ['token', 'authtoken', 'authToken', 'accessToken'];
  for (const k of keys) {
    const t = localStorage.getItem(k);
    if (t && t !== 'null' && t !== 'undefined') return t;
  }

  try {
    const match = document.cookie.match('(^|;)\\s*token\\s*=\\s*([^;]+)');
    if (match) return match.pop();
  } catch (err) {
    // ignore cookie parsing errors
  }

  return null;
}

// Request interceptor: attach token, user-id, and sensible defaults
apiRequest.interceptors.request.use(
  (config) => {
    try {
      config.headers = config.headers || {};

      const token = readToken();
      if (token && !config.headers.Authorization) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      if (!config.headers.Accept) {
        config.headers.Accept = 'application/json';
      }

      const method = (config.method || 'get').toLowerCase();
      const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
      if (!isFormData && method !== 'get' && !config.headers['Content-Type']) {
        config.headers['Content-Type'] = 'application/json';
      }

      try {
        const rawUser = localStorage.getItem('User');
        if (rawUser) {
          const user = JSON.parse(rawUser);
          if (user && (user._id || user.id)) {
            config.headers['user-id'] = user._id || user.id;
          }
        }
      } catch (err) {
        console.warn('apiRequest: failed to parse User from localStorage', err);
      }
    } catch (err) {
      console.error('apiRequest request-interceptor error', err);
    }

    return config;
  },
  (error) => {
    console.error('❌ Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor: handle global errors
// Respects `config._silenceToast = true` to suppress toasts for known/handled errors
apiRequest.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the caller has opted out of the global toast, skip it entirely.
    // This is used e.g. for profile fetch where 404 is an expected new-user state.
    const silenced = error?.config?._silenceToast === true;

    if (!silenced && error?.response) {
      const { status, data } = error.response;
      console.error('❌ Response Error:', status, data);

      if (status === 401) {
        toast.error(data?.message || 'Unauthorized. Please login again.');
        // Intentionally do NOT auto-clear tokens here; let the app decide.
      } else if (status === 403) {
        toast.error(data?.message || 'Forbidden. You do not have access.');
      } else if (status === 404) {
        // 404s are often handled locally (e.g. profile not found for new users).
        // Only show a generic toast if the caller hasn't silenced it.
        // Silenced 404s (like profile fetch) are handled in the calling function.
        console.warn('❌ 404 Not Found:', error.config?.url);
      } else if (status >= 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(data?.message || 'Request failed');
      }
    } else if (!silenced && error?.request) {
      console.error('❌ No response received:', error.request);
      toast.error('No response from server. Check your connection.');
    } else if (!silenced) {
      console.error('❌ Request Setup Error:', error?.message);
    }

    return Promise.reject(error);
  }
);

export default apiRequest;