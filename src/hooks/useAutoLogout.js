// hooks/useAutoLogout.js
//
// FIX: `useContext` was called but never imported — this caused a ReferenceError
// crash at runtime that would silently break the auto-logout feature.

import { useEffect, useRef, useContext } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
import { AuthContext } from "../Context/Authorisation/AuthContext";

export default function useAutoLogout(overrideLogoutCallback) {
  const { logout } = useContext(AuthContext);
  const hasLoggedOut = useRef(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let payload;
    try {
      payload = jwtDecode(token);
    } catch (err) {
      console.error("❌ Failed to decode token:", err.message);
      toast.error("Session invalid. Please log in again.");
      triggerLogout();
      return;
    }

    const expiry = payload.exp * 1000;
    const timeUntilExpiry = expiry - Date.now();

    if (timeUntilExpiry <= 0) {
      console.warn("⏰ Token already expired.");
      toast.warning("Your session has expired. Please log in again.");
      triggerLogout();
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn("⏰ Token expired. Auto-logging out user.");
      toast.warning("Your session has expired. Please log in again.");
      triggerLogout();
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logout, overrideLogoutCallback]);

  // FIX: Moved triggerLogout inside the hook body so it closes over
  // the current `logout` and `overrideLogoutCallback` values.
  function triggerLogout() {
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;

    if (typeof overrideLogoutCallback === "function") {
      overrideLogoutCallback();
    } else {
      logout();
    }
  }
}