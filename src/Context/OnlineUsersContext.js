// src/Context/OnlineUsersContext.js
//
// Tracks which users are currently online.
//
// Event model (matches improved onConnection.js):
//   "online-users"        → full list on connect / reconnect  (string[])
//   "user-status-changed" → { userId, isOnline, lastActive }  (granular delta)
//
// Storing as a Set means O(1) lookup in OnlineDot / usePresence.

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import { onSocketEvent, getSocket } from '../WebSocket/WebSocketClient';

const OnlineUsersContext = createContext();

export const OnlineUsersProvider = ({ children }) => {
  // Store as an Array for React state compatibility; convert to Set at lookup
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  // ── Full list replacement (received on connect / reconnect) ───────────────
  const handleFullList = useCallback((userIds) => {
    if (!Array.isArray(userIds)) return;
    setOnlineUserIds(userIds.map(String));
  }, []);

  // ── Granular delta (one user went online or offline) ─────────────────────
  const handleStatusChange = useCallback(({ userId, isOnline }) => {
    if (!userId) return;
    const id = String(userId);
    setOnlineUserIds((prev) => {
      if (isOnline) {
        return prev.includes(id) ? prev : [...prev, id];
      } else {
        return prev.filter((uid) => uid !== id);
      }
    });
  }, []);

  useEffect(() => {
    let offFull   = () => {};
    let offDelta  = () => {};

    const attach = () => {
      const sock = getSocket();
      if (!sock) return false;

      offFull  = onSocketEvent('online-users',        handleFullList);
      offDelta = onSocketEvent('user-status-changed', handleStatusChange);
      return true;
    };

    if (!attach()) {
      // Socket not ready yet — retry once after a brief delay
      const t = setTimeout(attach, 1_500);
      return () => {
        clearTimeout(t);
        offFull();
        offDelta();
      };
    }

    return () => {
      offFull();
      offDelta();
    };
  }, [handleFullList, handleStatusChange]);

  // ── Helpers exposed to consumers ─────────────────────────────────────────
  const isOnline = useCallback(
    (userId) => onlineUserIds.includes(String(userId)),
    [onlineUserIds]
  );

  return (
    <OnlineUsersContext.Provider value={{ onlineUserIds, isOnline }}>
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsers = () => {
  const ctx = useContext(OnlineUsersContext);
  if (!ctx) throw new Error('useOnlineUsers must be used within an OnlineUsersProvider');
  return ctx;
};