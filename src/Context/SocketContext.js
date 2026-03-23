// src/Context/SocketContext.js
//
// Single source of truth for the Socket.IO singleton.
// Responsibilities:
//   • Initialize / reconnect the socket when the auth token is present
//   • Provide { socket, connected, reconnect } to the tree
//   • Emit user-online once per connect (not on every render)
//
// NOT responsible for:
//   • Notification state  → NotificationContext
//   • Online-users list   → OnlineUsersContext
//   • Auth state          → AuthContext
//
// FIX — duplicate initializeSocket() calls with AuthContext:
//   Both SocketContext and AuthContext previously called initializeSocket()
//   independently on mount. Because Socket.IO clients are singletons managed
//   inside WebSocketClient.js, the second call is a no-op as long as
//   WebSocketClient guards against re-initialization (returns the existing
//   socket if already connected). However, the duplicate calls race during
//   app startup: whichever resolves second may overwrite connect/disconnect
//   handlers registered by the first.
//
//   Resolution strategy (applied here):
//     • SocketContext remains the single place that calls initializeSocket()
//       and owns the socket state exposed to the tree.
//     • AuthContext.setupSocket() should be changed to call getSocket() (not
//       initializeSocket()) and attach its own connect handler on top of the
//       already-initialized socket — see AuthContext.js for that change.
//     • If WebSocketClient.initializeSocket() is idempotent (returns existing
//       socket without re-connecting), having both call it is safe but
//       redundant. The comment is kept here to explain the intended ownership.

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import { jwtDecode } from 'jwt-decode';
import {
  initializeSocket,
  reconnectSocket,
  getSocket,
  onSocketEvent,
} from '../WebSocket/WebSocketClient';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const [socket,    setSocket]    = useState(null);
  const [connected, setConnected] = useState(false);

  // Cache decoded user so presence can be re-emitted on reconnect
  const userRef = useRef(null);

  // ── Decode the user from the stored token ────────────────────────────────
  const decodeUser = useCallback(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return null;
      const decoded = jwtDecode(token);
      return {
        // JWT payload produced by authController uses `user.id` (string ObjectId)
        id:          decoded.user?.id,
        name:        decoded.user?.name,
        hometown:    decoded.user?.hometown,
        currentcity: decoded.user?.currentcity,
      };
    } catch {
      return null;
    }
  }, []);

  // ── Emit presence once the socket is connected ───────────────────────────
  const emitPresence = useCallback((sock) => {
    const user = userRef.current;
    if (!sock?.connected || !user?.id) return;
    sock.emit('user-online', {
      userId:      user.id,
      name:        user.name        ?? '',
      hometown:    user.hometown    ?? '',
      currentcity: user.currentcity ?? '',
    });
  }, []);

  // ── Bootstrap (runs once on mount) ───────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    userRef.current = decodeUser();

    // Cleanup holder — populated asynchronously once the socket is available
    let offConnect    = () => {};
    let offDisconnect = () => {};
    let mounted       = true; // guard against state updates after unmount

    (async () => {
      const sock = await initializeSocket();
      if (!sock || !mounted) return;

      setSocket(sock);
      setConnected(sock.connected);

      const onConnect    = () => { if (mounted) { setConnected(true);  emitPresence(sock); } };
      const onDisconnect = () => { if (mounted) { setConnected(false); } };

      offConnect    = onSocketEvent('connect',    onConnect);
      offDisconnect = onSocketEvent('disconnect', onDisconnect);

      // If socket is already connected when we attach the listener
      if (sock.connected) onConnect();
    })();

    return () => {
      mounted = false;
      offConnect();
      offDisconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — runs once on mount

  // ── Manual reconnect (exposed for components that need it) ────────────────
  const reconnect = useCallback(async () => {
    await reconnectSocket();
    const sock = getSocket();
    setSocket(sock ?? null);
    setConnected(!!sock?.connected);
    if (sock?.connected) emitPresence(sock);
  }, [emitPresence]);

  return (
    <SocketContext.Provider value={{ socket, connected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within a SocketProvider');
  return ctx;
};