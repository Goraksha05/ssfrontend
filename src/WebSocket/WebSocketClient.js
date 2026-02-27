// src/WebSocket/WebSocketClient.js
import { io } from 'socket.io-client';

// ─── Module-level singleton ───────────────────────────────────────────────────
let socket           = null;
let reconnectAttempts = 0;
let reconnectTimer    = null;

const SERVER_URL =
  process.env.REACT_APP_SERVER_URL ||
  process.env.REACT_APP_BACKEND_URL ||
  'http://127.0.0.1:5000';

// ─── Token helpers ────────────────────────────────────────────────────────────
const getToken = () => {
  const raw = localStorage.getItem('token');
  if (!raw || raw === 'null' || raw === 'undefined') return null;
  return raw.trim().replace(/\s/g, '');
};

const isValidToken = (t) => !!t && t.split('.').length === 3;

// ─── Default listeners ────────────────────────────────────────────────────────
/**
 * Attach core socket listeners.
 * NOTE: we call sock.removeAllListeners() first so re-attaching after
 * reconnect never creates duplicate handlers.
 */
const attachDefaultListeners = (sock) => {
  sock.removeAllListeners(); // ← crucial: prevents listener accumulation

  sock.on('connect', () => {
    console.log('[Socket] Connected:', sock.id);
    reconnectAttempts = 0;
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  });

  sock.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
    // Only try to reconnect for recoverable reasons
    if (reason !== 'io client disconnect') {
      scheduleReconnect();
    }
  });

  sock.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    scheduleReconnect();
  });

  // Native browser notification when the tab is hidden
  sock.on('notification', (payload) => {
    try {
      if (
        document.visibilityState === 'hidden' &&
        'Notification' in window &&
        Notification.permission === 'granted'
      ) {
        new Notification(payload.title || 'SoShoLife', {
          body: payload.message || '',
          data: { url: payload.url || '/' },
        });
      }
    } catch {
      // Notification API not available — ignore
    }
  });

  sock.on('online-users', (userIds) => {
    // Individual contexts handle this via their own .on() calls
    console.debug('[Socket] online-users:', userIds?.length);
  });
};

// ─── Exponential back-off reconnect ──────────────────────────────────────────
const scheduleReconnect = () => {
  const token = getToken();
  if (!token) {
    console.warn('[Socket] No token — stopping reconnect');
    return;
  }
  if (reconnectTimer) return; // already scheduled

  reconnectAttempts++;
  const delay = Math.min(1000 * 2 ** reconnectAttempts, 30_000); // cap at 30 s
  console.log(`[Socket] Reconnect #${reconnectAttempts} in ${delay}ms`);

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (socket) {
      socket.auth = { token };
      attachDefaultListeners(socket); // re-attach before reconnecting
      socket.connect();
    } else {
      await initializeSocket();
    }
  }, delay);
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Create the socket singleton if it does not exist yet.
 * Safe to call multiple times — returns existing socket if already initialised.
 */
export const initializeSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn('[Socket] Invalid/missing token. Aborting initialisation.');
    return null;
  }
  if (socket) return socket; // already initialised

  socket = io(SERVER_URL, {
    path:          '/socket.io',
    transports:    ['websocket'],
    autoConnect:   false,
    reconnection:  false, // we handle reconnection manually
    auth:          { token },
    withCredentials: false,
  });

  attachDefaultListeners(socket);
  socket.connect();
  return socket;
};

/**
 * Reconnect an existing socket (e.g. after login / token refresh).
 * Creates a new socket if none exists.
 */
export const reconnectSocket = async () => {
  const token = getToken();
  if (!isValidToken(token)) {
    console.warn('[Socket] Cannot reconnect — token missing or invalid');
    return;
  }
  if (socket) {
    socket.auth = { token };
    if (!socket.connected) {
      console.log('[Socket] Reconnecting existing socket...');
      attachDefaultListeners(socket);
      socket.connect();
    }
  } else {
    console.log('[Socket] Initialising new socket...');
    await initializeSocket();
  }
};

/**
 * Return the current socket instance (may be null before initialisation).
 */
export const getSocket = () => socket;

/**
 * True only when the socket exists and is currently connected.
 */
export const isSocketReady = () => !!(socket?.connected);

/**
 * Emit safely — logs a warning instead of throwing if the socket is offline.
 */
export const safeEmit = (event, payload = {}, callback) => {
  if (!isSocketReady()) {
    console.warn(`[Socket] Not connected — cannot emit '${event}'`);
    return;
  }
  typeof callback === 'function'
    ? socket.emit(event, payload, callback)
    : socket.emit(event, payload);
};

// Alias kept for backward compatibility
export const emitEvent = safeEmit;

/**
 * Fully disconnect and destroy the socket singleton.
 * Called on logout.
 */
export const disconnectSocket = () => {
  clearTimeout(reconnectTimer);
  reconnectTimer    = null;
  reconnectAttempts = 0;

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
    console.log('[Socket] Manually disconnected and cleared.');
  }
};

// Default export for code that does `import getSocket from '...'`
export default getSocket;