// Services/AuthService.js
import { reconnectSocket } from "../WebSocket/WebSocketClient";

// const API_URL = `${process.env.REACT_APP_BACKEND_URL}/api/auth` || `${process.env.REACT_APP_SERVER_URL}/api/auth`;
const API_URL = `${process.env.REACT_APP_BACKEND_URL ?? process.env.REACT_APP_SERVER_URL}/api/auth`;

const AuthService = {
  login: async ({ identifier, password, role }) => {
    // console.log("Login payload:", { identifier, password, role });

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers:
        {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ identifier, password, role }),
      });

      // console.log("Sending login request to API:", { identifier, password });

      const data = await response.json();
      // console.log("Login response data:", data);

      if (response.ok && data.success && data.authtoken && data.user) {
        const cleanedToken = data.authtoken?.trim().replace(/\s/g, '');
        localStorage.setItem("token", cleanedToken);

        console.log("🚨 Token received from API:", JSON.stringify(cleanedToken));

        // ✅ Normalize and store user
        const normalizedUser = {
          ...data.user,
          id: data.user._id || data.user.id
        };
        localStorage.setItem("User", JSON.stringify(normalizedUser));
        // localStorage.setItem("user", JSON.stringify(data.user));
        reconnectSocket(); // optional here, depending on AuthContext usage
        return { success: true, user: normalizedUser, authtoken: cleanedToken };
      } else {
        return { success: false, error: data.error || "Login failed" };
      }
    } catch (error) {
      console.error("Login failed:", error);
      return { success: false, error: "Login request failed" };
    }
  },

  // signup: async ({ name, username, email, phone, password, referralno }) => {
  signup: async ({ name, username, email, phone, password, referralno, role }) => {
    try {
      const response = await fetch(`${API_URL}/createuser`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({ name, username, email, phone, password, referralno })
        body: JSON.stringify({ name, username, email, phone, password, referralno, role })
      });

      console.log("Signup payload:", { name, username, email, phone, password, referralno });

      const data = await response.json();
      console.log("Login response:", data);
      console.log("User to store:", data.user);


      if (response.ok && data.authtoken) {
        const cleanedToken = data.authtoken.trim().replace(/\s/g, '');
        localStorage.setItem("token", cleanedToken);
        console.log("📤 Cleaned Token (signup):", JSON.stringify(cleanedToken));

        const normalizedUser = {
          ...data.user,
          id: data.user._id || data.user.id
        };
        localStorage.setItem("User", JSON.stringify(normalizedUser));
        // localStorage.setItem("User", JSON.stringify(data.user));

        // ✅ Trigger socket reconnection ONLY after token is stored
        reconnectSocket();
        return { success: true, user: normalizedUser, authtoken: cleanedToken };
      } else {
        const errMsg = data.message || data.error || "Signup failed";
        console.warn("Signup failed:", errMsg);
        return { success: false, error: errMsg };
      }

    } catch (error) {
      console.error("Signup failed:", error);
      return { success: false, error: "Signup request failed" };
    }
  },

  getUser: async () => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("User");

    if (!token || !storedUser) return null;

    try {
      const user = JSON.parse(storedUser);
      const userId = user?.id || user?._id;

      if (!userId) {
        console.warn("⚠️ Cannot fetch user: ID missing");
        return null;
      }

      const response = await fetch(`${API_URL}/getloggeduser/${userId}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim().replace(/\s/g, '')}`,
        },
      })

      const data = await response.json();
      return data.success ? data.user : null;

    } catch (error) {
      console.error("Failed to get user:", error);
      return null;
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("User");
    reconnectSocket();

    try {
      const sock = window?.socket || null;
      if (sock && typeof sock.disconnect === "function") {
        sock.removeAllListeners();
        sock.disconnect();
      }
    } catch (err) {
      console.warn("⚠️ Failed to disconnect socket:", err);
    }
  },

  loginAdmin: async ({ identifier, password }) => {
    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password })
      });

      const data = await response.json();

      if (!data.user?.isAdmin) {
        return { success: false, error: "Access denied: not an admin" };
      }

      if (response.ok && data.success && data.authtoken) {
        localStorage.setItem("token", data.authtoken);
        localStorage.setItem("User", JSON.stringify(data.user));

        // ✅ Trigger socket reconnection ONLY after token is stored
        reconnectSocket();
      }

      return data;
    } catch (error) {
      console.error("Admin login failed:", error);
      return { success: false, error: "Login request failed" };
    }
  },
};

export default AuthService;
