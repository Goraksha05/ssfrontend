// src/utils/handleAuthError.js


import { toast } from 'react-toastify';

/**
 * Handle a 401 Unauthorized error from a manual fetch / non-intercepted call.
 *
 * For Axios calls routed through apiRequest.js the global response interceptor
 * already handles 401s — do not call this function for those.
 *
 * @param {Error} error  The caught error object (must have error.response)
 */
const handleAuthError = (error) => {
  if (error?.response?.status === 401) {
    toast.error('Session expired. Please log in again.');

    // Dispatch the same event that apiRequest.js uses so AuthContext's single
    // listener handles logout and state cleanup uniformly, and ProtectedRoute
    // redirects to /login without a hard page reload.
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
  }
};

export default handleAuthError;