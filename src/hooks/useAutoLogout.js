import { useEffect, useRef } from "react";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";
// import AuthService from "../Services/AuthService";
import { AuthContext } from "../Context/Authorisation/AuthContext";

// export default function useAutoLogout(logoutCallback) {
export default function useAutoLogout(overrideLogoutCallback) {
  const { logout } = useContext(AuthContext);
  const hasLoggedOut = useRef(false); // 🛡️ Prevent multiple logout triggers

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    let payload;
    try {
      payload = jwtDecode(token);
      // } catch (err) {
      //   console.error("❌ Failed to decode token:", err.message);
      //   toast.error("Session invalid. Please log in again.");
      //   if (!hasLoggedOut.current) {
      //     hasLoggedOut.current = true;
      //     if (typeof logoutCallback === "function") logoutCallback();
      //     else AuthService.logout();
      //   }
      //   return;
      // }
    } catch (err) {
      console.error("❌ Failed to decode token:", err.message);
      toast.error("Session invalid. Please log in again.");
      triggerLogout();
      return;
    }

    const expiry = payload.exp * 1000;
    const timeUntilExpiry = expiry - Date.now();

    // if (timeUntilExpiry <= 0) {
    //   console.warn("⏰ Token already expired. Logging out immediately.");
    //   toast.warning("Your session has expired. Please log in again.");
    //   if (!hasLoggedOut.current) {
    //     hasLoggedOut.current = true;
    //     if (typeof logoutCallback === "function") logoutCallback();
    //     else AuthService.logout();
    //   }
    //   return;
    // }

    if (timeUntilExpiry <= 0) {
      console.warn("⏰ Token already expired.");
      toast.warning("Your session has expired. Please log in again.");
      triggerLogout();
      return;
    }

    const timeoutId = setTimeout(() => {
      console.warn("⏰ Token expired. Auto-logging out user.");
      toast.warning("Your session has expired. Please log in again.");
      // if (!hasLoggedOut.current) {
      //   hasLoggedOut.current = true;
      //   if (typeof logoutCallback === "function") logoutCallback();
      //   else AuthService.logout();
      // }
      triggerLogout();
    }, timeUntilExpiry);

    return () => clearTimeout(timeoutId);
    // }, [logoutCallback]);
  }, [logout, overrideLogoutCallback])

  const triggerLogout = () => {
    if (hasLoggedOut.current) return;
    hasLoggedOut.current = true;

    if (typeof overrideLogoutCallback === "function") {
      overrideLogoutCallback();
    } else {
      logout(); // ✅ use context logout by default
    }
  };
}
