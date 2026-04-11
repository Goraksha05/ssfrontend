// src/Context/OnlineUsersContext.js

import React, {
  createContext, useContext, useEffect,
  useCallback, useRef, useState, useMemo,
} from 'react';
import { onSocketEvent, getSocket } from '../WebSocket/WebSocketClient';

const OnlineUsersContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────

export const OnlineUsersProvider = ({ children }) => {

  const onlineSet   = useRef(new Set());
  const [rev, setRev] = useState(0);    // incremented to force re-render

  // Pending delta queue for RAF batching
  const pendingRef  = useRef([]);       // [{ userId, isOnline }]
  const rafRef      = useRef(null);

  // ── Apply a batch of deltas and flush ─────────────────────────────────────
  const flushDeltas = useCallback(() => {
    const deltas = pendingRef.current.splice(0);
    if (deltas.length === 0) return;

    let changed = false;
    deltas.forEach(({ userId, isOnline }) => {
      const id = String(userId);
      if (isOnline && !onlineSet.current.has(id)) {
        onlineSet.current.add(id);
        changed = true;
      } else if (!isOnline && onlineSet.current.has(id)) {
        onlineSet.current.delete(id);
        changed = true;
      }
    });

    if (changed) setRev((r) => r + 1);
  }, []);

  const scheduleFlush = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      flushDeltas();
    });
  }, [flushDeltas]);

  // ── Handle full replacement list (on connect / reconnect) ─────────────────
  const handleFullList = useCallback((userIds) => {
    if (!Array.isArray(userIds)) return;
    onlineSet.current = new Set(userIds.map(String));
    setRev((r) => r + 1);
  }, []);

  // ── Handle granular delta (one user changed status) ───────────────────────
  const handleStatusChange = useCallback(({ userId, isOnline }) => {
    if (!userId) return;
    pendingRef.current.push({ userId, isOnline });
    scheduleFlush();
  }, [scheduleFlush]);

  // ── Register socket listeners + reconnect handler ─────────────────────────
  useEffect(() => {
    const offRefs = { full: null, delta: null, connect: null };

    const attach = () => {
      const sock = getSocket();
      if (!sock) return false;

      // Clean up any previous registrations
      offRefs.full?.();
      offRefs.delta?.();
      offRefs.connect?.();

      offRefs.full  = onSocketEvent('online-users',        handleFullList);
      offRefs.delta = onSocketEvent('user-status-changed', handleStatusChange);

      // On reconnect, request a fresh full list.
      // The server emits 'online-users' automatically on each connection,
      // so we just need listeners to be registered.
      const onConnect = () => {
        // Server will re-emit 'online-users' — handleFullList will reconcile.
        // Nothing extra needed.
      };
      sock.on('connect', onConnect);
      offRefs.connect = () => sock.off('connect', onConnect);

      return true;
    };

    let timerId = null;
    if (!attach()) {
      timerId = setTimeout(attach, 1_500);
    }

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      offRefs.full?.();
      offRefs.delta?.();
      offRefs.connect?.();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [handleFullList, handleStatusChange]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  // O(1) presence check — stable reference because it closes over the ref
  const isOnline = useCallback(
    (userId) => userId ? onlineSet.current.has(String(userId)) : false,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev]  // re-create when the Set changes (rev bumped)
  );

  // Zero-copy snapshot of the current online IDs
  const getOnlineIds = useCallback(
    () => [...onlineSet.current],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev]
  );

  const onlineCount = useMemo(
    () => onlineSet.current.size,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev]
  );

  // Expose onlineUserIds as an array for backward compatibility with any
  // consumer that iterates it (e.g. ChatList online badges).
  const onlineUserIds = useMemo(
    () => [...onlineSet.current],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rev]
  );

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    onlineUserIds,
    onlineCount,
    isOnline,
    getOnlineIds,
  }), [onlineUserIds, onlineCount, isOnline, getOnlineIds]);

  return (
    <OnlineUsersContext.Provider value={value}>
      {children}
    </OnlineUsersContext.Provider>
  );
};

export const useOnlineUsers = () => {
  const ctx = useContext(OnlineUsersContext);
  if (!ctx) throw new Error('useOnlineUsers must be used within an OnlineUsersProvider');
  return ctx;
};