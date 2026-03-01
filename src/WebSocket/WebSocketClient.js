// src/WebSocket/WebSocketClient.js
//
// Singleton Socket.IO client with:
//   • Token-based auth (Bearer JWT)
//   • Manual exponential back-off reconnect
//   • Multi-tab awareness (BroadcastChannel keeps tabs in sync)
//   • Safe listener management — core listeners use a private namespace
//     so removeAllListeners() is NEVER called, preventing app-level
//     listeners added by chat components from being clobbered on reconnect.

import { io } from "socket.io-client";

// ─── Config ──────────────────────────────────────────────────────────────────
const SERVER_URL =
  process.env.REACT_APP_SERVER_URL  ||
  process.env.REACT_APP_BACKEND_URL ||
  "http://127.0.0.1:5000";

// ─── Module-level state ──────────────────────────────────────────────────────
let socket            = null;
let reconnectTimer    = null;
let reconnectAttempts = 0;

// BroadcastChannel lets other tabs know about connect/disconnect events so they
// can update their UI without polling.
let broadcastChannel = null;
try {
  if (typeof BroadcastChannel !== "undefined") {
    broadcastChannel = new BroadcastChannel("ssl_socket_presence");
  }
} catch {
  // Not supported — gracefully degrade
}

// ─── Token helpers ────────────────────────────────────────────────────────────
function getToken() {
  try {
    const raw = localStorage.getItem("token");
    if (!raw || raw === "null" || raw === "undefined") return null;
    return raw.trim().replace(/\s/g, "");
  } catch {
    return null;
  }
}

function isValidToken(t) {
  return !!t && t.split(".").length === 3;
}

// ─── Core listener management ─────────────────────────────────────────────────
//   We track the core listeners we register ourselves so we can replace them
//   on reconnect without touching app-level listeners.
const CORE_EVENTS = ["connect", "disconnect", "connect_error", "notification", "online-users"];
const _coreHandlers = {};

function detachCoreListeners(sock) {
  CORE_EVENTS.forEach((evt) => {
    if (_coreHandlers[evt]) {
      sock.off(evt, _coreHandlers[evt]);
      delete _coreHandlers[evt];
    }
  });
}

function attachCoreListeners(sock) {
  detachCoreListeners(sock); // Swap out old handlers only

  _coreHandlers["connect"] = () => {
    console.log("[Socket] Connected:", sock.id);
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    broadcastChannel?.postMessage({ type: "connected", socketId: sock.id });
  };

  _coreHandlers["disconnect"] = (reason) => {
    console.warn("[Socket] Disconnected:", reason);
    broadcastChannel?.postMessage({ type: "disconnected", reason });
    // Do not reconnect on explicit client disconnect (logout)
    if (reason !== "io client disconnect") {
      scheduleReconnect();
    }
  };

  _coreHandlers["connect_error"] = (err) => {
    console.error("[Socket] Connection error:", err.message);
    scheduleReconnect();
  };

  // Native browser notification when the tab is hidden
  _coreHandlers["notification"] = (payload) => {
    try {
      if (
        document.visibilityState === "hidden" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        new Notification(payload.title || "SoShoLife", {
          body: payload.message || "",
          data: { url: payload.url || "/" },
        });
      }
    } catch {
      // Notification API unavailable — ignore
    }
  };

  _coreHandlers["online-users"] = (userIds) => {
    console.debug("[Socket] online-users count:", userIds?.length);
    // Individual contexts add their own listeners for this event separately
  };

  CORE_EVENTS.forEach((evt) => {
    sock.on(evt, _coreHandlers[evt]);
  });
}

// ─── Reconnect with exponential back-off ──────────────────────────────────────
function scheduleReconnect() {
  const token = getToken();
  if (!token) {
    console.warn("[Socket] No token — reconnect aborted");
    return;
  }
  if (reconnectTimer) return; // already scheduled

  reconnectAttempts++;
  const delay = Math.min(1_000 * 2 ** reconnectAttempts, 30_000); // cap 30 s
  console.log(`[Socket] Scheduling reconnect #${reconnectAttempts} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (socket) {
      socket.auth = { token };
      attachCoreListeners(socket); // swap core handlers only
      socket.connect();
    } else {
      await initializeSocket();
    }
  }, delay);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create (or return) the socket singleton.
 * Safe to call multiple times — returns existing socket if already initialised.
 */
export const initializeSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn("[Socket] Invalid/missing token — aborting initialisation");
    return null;
  }
  if (socket?.connected) return socket;

  // If socket exists but is not connected, reconnect it instead of creating a new one
  if (socket) {
    socket.auth = { token };
    attachCoreListeners(socket);
    socket.connect();
    return socket;
  }

  socket = io(SERVER_URL, {
    path:            "/socket.io",
    transports:      ["websocket"],
    autoConnect:     false,
    reconnection:    false, // manual back-off above
    auth:            { token },
    withCredentials: false,
  });

  attachCoreListeners(socket);
  socket.connect();
  return socket;
};

/**
 * Reconnect an existing socket (e.g. after login or token refresh).
 * Creates a new socket if none exists.
 */
export const reconnectSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn("[Socket] Cannot reconnect — token missing or invalid");
    return;
  }
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      attachCoreListeners(socket);
      socket.connect();
    }
  } else {
    await initializeSocket();
  }
};

/** Return the current socket instance (may be null before initialisation). */
export const getSocket = () => socket;

/** True only when the socket exists and is currently connected. */
export const isSocketReady = () => !!(socket?.connected);

/**
 * Emit safely — logs a warning instead of throwing if the socket is not ready.
 */
export const safeEmit = (event, payload = {}, callback) => {
  if (!isSocketReady()) {
    console.warn(`[Socket] Not connected — cannot emit '${event}'`);
    return false;
  }
  if (typeof callback === "function") {
    socket.emit(event, payload, callback);
  } else {
    socket.emit(event, payload);
  }
  return true;
};

// Alias kept for backward-compatibility
export const emitEvent = safeEmit;

/**
 * Fully disconnect and destroy the socket singleton.
 * Call on logout — clears all listeners and prevents reconnect.
 */
export const disconnectSocket = () => {
  clearTimeout(reconnectTimer);
  reconnectTimer    = null;
  reconnectAttempts = 0;

  if (socket) {
    detachCoreListeners(socket);
    socket.removeAllListeners(); // OK here: full teardown on logout
    socket.disconnect();
    socket = null;
    broadcastChannel?.postMessage({ type: "disconnected", reason: "logout" });
    console.log("[Socket] Manually disconnected and cleared.");
  }
};

/**
 * Subscribe to a socket event safely.
 * Returns an unsubscribe function — call it in useEffect cleanup.
 *
 *   useEffect(() => {
 *     return onSocketEvent("notification", handler);
 *   }, []);
 */
export const onSocketEvent = (event, handler) => {
  if (!socket) {
    console.warn(`[Socket] Cannot subscribe to '${event}' — socket not initialised`);
    return () => {};
  }
  socket.on(event, handler);
  return () => socket?.off(event, handler);
};

export default getSocket;