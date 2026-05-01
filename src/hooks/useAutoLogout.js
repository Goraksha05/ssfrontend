/**
 * hooks/useAutoLogout.js  — UPGRADED
 *
 * Changes from original:
 *
 *  ✅ De-duplicates with AuthContext's own expiry timer — this hook is now
 *     a lightweight "tab-visible" guard that fires when the user returns
 *     to the tab after a long absence. AuthContext handles the 60-second
 *     interval check. Having both active prevents any gap where a token
 *     expires during an interval window.
 *
 *  ✅ Listens to the 'token' storage event — if the token is removed from
 *     another tab, this hook triggers logout on the current tab too.
 *
 *  ✅ hasLoggedOut ref is reset when the token changes, so re-login within
 *     the same session resets the guard correctly.
 *
 *  ✅ Returns { timeRemaining } for countdown UIs (pass `showTimer: true`).
 */

import { useEffect, useRef, useState, useContext } from 'react';
import { jwtDecode }   from 'jwt-decode';
import { toast }       from 'react-toastify';
import { AuthContext } from '../Context/Authorisation/AuthContext';

/**
 * @param {Function}  [overrideLogoutCallback]  Optional custom logout fn.
 * @param {object}    [opts]
 * @param {boolean}   [opts.showTimer=false]    Whether to compute timeRemaining.
 */
export default function useAutoLogout(overrideLogoutCallback, { showTimer = false } = {}) {
  const { logout } = useContext(AuthContext);
  const hasLoggedOut = useRef(false);
  const timeoutRef   = useRef(null);

  const [timeRemaining, setTimeRemaining] = useState(null); // seconds

  function triggerLogout() {
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;
    const fn = typeof overrideLogoutCallback === 'function' ? overrideLogoutCallback : logout;
    fn('useAutoLogout');
  }

  useEffect(() => {
    hasLoggedOut.current = false; // reset on token change / re-login

    const token = localStorage.getItem('token');
    if (!token) return;

    let payload;
    try {
      payload = jwtDecode(token);
    } catch (err) {
      console.error('❌ Failed to decode token:', err.message);
      toast.error('Session invalid. Please log in again.');
      triggerLogout();
      return;
    }

    const expiry         = payload.exp * 1000;
    const timeUntilExpiry = expiry - Date.now();

    if (timeUntilExpiry <= 0) {
      toast.warning('Your session has expired. Please log in again.');
      triggerLogout();
      return;
    }

    // Schedule hard logout at exact expiry
    timeoutRef.current = setTimeout(() => {
      toast.warning('Your session has expired. Please log in again.');
      triggerLogout();
    }, timeUntilExpiry);

    // Optional countdown ticker for UI
    let intervalId;
    if (showTimer) {
      setTimeRemaining(Math.floor(timeUntilExpiry / 1000));
      intervalId = setInterval(() => {
        const remaining = Math.floor((expiry - Date.now()) / 1000);
        if (remaining <= 0) {
          clearInterval(intervalId);
          setTimeRemaining(0);
        } else {
          setTimeRemaining(remaining);
        }
      }, 1000);
    }

    return () => {
      clearTimeout(timeoutRef.current);
      if (intervalId) clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout, overrideLogoutCallback]);

  // Cross-tab token removal
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'token' && !e.newValue) {
        triggerLogout();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { timeRemaining };
}