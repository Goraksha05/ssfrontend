// src/Context/NotificationContext.js

import React, {
  createContext, useContext, useState, useEffect,
  useCallback, useRef, useMemo,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import { subscribeForPush, unsubscribeFromPush } from '../utils/pushClient';
import { onSocketEvent, getSocket } from '../WebSocket/WebSocketClient';

const NotificationContext = createContext(null);

const BACKEND_URL =
  process.env.REACT_APP_SERVER_URL  ??
  process.env.REACT_APP_BACKEND_URL ??
  '';
const HISTORY_PAGE_SIZE = 10;
const LIVE_CACHE_MAX    = 50;   // cap on real-time arrivals held in memory

// ── Helpers ───────────────────────────────────────────────────────────────────

const getToken = () => localStorage.getItem('token');

/** Convert a notifications array to Map<_id, notification> */
const toMap = (arr) => new Map(arr.map((n) => [n._id, n]));

// ─────────────────────────────────────────────────────────────────────────────

export const NotificationProvider = ({ children }) => {
  // notifMap: Map<_id, notification> — single source of truth
  const [notifMap,        setNotifMap]        = useState(new Map());
  const [unreadCount,     setUnreadCount]     = useState(0);
  const [loadingHistory,  setLoadingHistory]  = useState(false);
  const [historyPage,     setHistoryPage]     = useState(1);
  const [hasMore,         setHasMore]         = useState(true);
  const [pushEnabled,     setPushEnabled]     = useState(false);
  const [pushError,       setPushError]       = useState('');

  // Expose sorted array for consumers (newest-first, memoised)
  const notifications = useMemo(
    () => [...notifMap.values()].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    ),
    [notifMap]
  );

  // ── Socket listener cleanup reference ────────────────────────────────────
  const offRef = useRef(null);

  // ── Fetch unread count ────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      if (!getToken()) return;
      const res = await apiRequest.get(
        `${BACKEND_URL}/api/notifications/unread-count`,
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      setUnreadCount(res?.data?.unreadCount ?? 0);
    } catch (err) {
      console.debug('[NotificationContext] refresh unread-count:', err?.message);
    }
  }, []);

  // ── Fetch paginated notification history ──────────────────────────────────
  /**
   * @param {boolean} [reset=false]  Start from page 1 (e.g. after markAllRead)
   */
  const fetchHistory = useCallback(async (reset = false) => {
    const token = getToken();
    if (!token || loadingHistory) return;

    const page = reset ? 1 : historyPage;
    setLoadingHistory(true);
    try {
      const res = await apiRequest.get(
        `${BACKEND_URL}/api/notifications?page=${page}&limit=${HISTORY_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const fetched  = Array.isArray(res.data?.data) ? res.data.data : [];
      const total    = res.data?.totalPages ?? 1;
      const hasNext  = page < total;

      setHasMore(hasNext);
      setHistoryPage(hasNext ? page + 1 : page);
      setUnreadCount(res.data?.unreadCount ?? 0);

      setNotifMap((prev) => {
        const base = reset ? new Map() : new Map(prev);
        toMap(fetched).forEach((n, id) => base.set(id, n));
        return base;
      });
    } catch (err) {
      console.error('[NotificationContext] fetchHistory:', err?.message);
    } finally {
      setLoadingHistory(false);
    }
  }, [historyPage, loadingHistory]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (getToken()) {
      refresh();
      fetchHistory(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // once on mount

  // ── Check browser push permission on mount ────────────────────────────────
  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(window.Notification.permission === 'granted');
    }
  }, []);

  // ── Real-time socket listener ─────────────────────────────────────────────
  // Uses an offRef so both the immediate and delayed attach paths share one
  // cleanup slot — preventing listener leaks on unmount during the retry window.
  useEffect(() => {
    let timerId = null;

    const handleNotification = (payload) => {
      if (!payload?._id) return;

      setNotifMap((prev) => {
        if (prev.has(payload._id)) return prev; // already seen
        const next = new Map(prev);
        next.set(payload._id, { ...payload, isRead: false });
        // Evict oldest entries if we exceed the live cache cap
        if (next.size > LIVE_CACHE_MAX) {
          const oldest = [...next.entries()].sort(
            ([, a], [, b]) => new Date(a.createdAt) - new Date(b.createdAt)
          )[0]?.[0];
          if (oldest) next.delete(oldest);
        }
        return next;
      });

      setUnreadCount((c) => c + 1);

      if (document.visibilityState !== 'hidden') {
        toast.info(payload.message || 'New notification', {
          autoClose: 4_000,
          onClick: () => { if (payload.url) window.location.href = payload.url; },
        });
      }
    };

    const attach = () => {
      const sock = getSocket();
      if (!sock) return false;
      offRef.current?.();
      offRef.current = onSocketEvent('notification', handleNotification);

      // Re-sync unread count on reconnect (may have missed deliveries offline)
      const onReconnect = () => refresh();
      sock.on('connect', onReconnect);
      const prevOff = offRef.current;
      offRef.current = () => {
        prevOff?.();
        sock.off('connect', onReconnect);
      };
      return true;
    };

    if (!attach()) {
      timerId = setTimeout(attach, 1_500);
    }

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      offRef.current?.();
      offRef.current = null;
    };
  }, [refresh]);

  // ── Reset state on logout (cross-tab storage event) ───────────────────────
  useEffect(() => {
    const handler = () => {
      if (!localStorage.getItem('token')) {
        setNotifMap(new Map());
        setUnreadCount(0);
        setHistoryPage(1);
        setHasMore(true);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── Mark all read ─────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    const prevCount = unreadCount;
    // Optimistic
    setUnreadCount(0);
    setNotifMap((prev) => {
      const next = new Map(prev);
      next.forEach((n, k) => next.set(k, { ...n, isRead: true }));
      return next;
    });
    try {
      await apiRequest.put(
        `${BACKEND_URL}/api/notifications/mark-all-read`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
    } catch (err) {
      console.error('[NotificationContext] markAllRead:', err?.message);
      setUnreadCount(prevCount);
      refresh();
    }
  }, [unreadCount, refresh]);

  // ── Mark one read ─────────────────────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    const n = notifMap.get(id);
    if (!n || n.isRead) return;

    // Optimistic
    setNotifMap((prev) => {
      const next = new Map(prev);
      next.set(id, { ...n, isRead: true });
      return next;
    });
    setUnreadCount((c) => Math.max(0, c - 1));

    try {
      await apiRequest.put(
        `${BACKEND_URL}/api/notifications/${id}/read`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
    } catch (err) {
      console.error('[NotificationContext] markOneRead:', err?.message);
      // Rollback
      setNotifMap((prev) => {
        const next = new Map(prev);
        next.set(id, n);
        return next;
      });
      setUnreadCount((c) => c + 1);
    }
  }, [notifMap]);

  // ── Remove one notification from local state ──────────────────────────────
  const removeNotification = useCallback((id) => {
    setNotifMap((prev) => {
      const next = new Map(prev);
      const n = next.get(id);
      next.delete(id);
      if (n && !n.isRead) setUnreadCount((c) => Math.max(0, c - 1));
      return next;
    });
  }, []);

  // ── Clear all (delete via API + reset local state) ────────────────────────
  const clearAll = useCallback(async () => {
    setNotifMap(new Map());
    setUnreadCount(0);
    try {
      await apiRequest.post(
        `${BACKEND_URL}/api/notifications/cleanup`,
        {},
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
    } catch (err) {
      console.error('[NotificationContext] clearAll:', err?.message);
      refresh();
    }
  }, [refresh]);

  // ── Push helpers ──────────────────────────────────────────────────────────
  const enablePush = useCallback(async () => {
    const token = getToken();
    if (!token) { setPushError('Not authenticated'); return; }
    try {
      await subscribeForPush(token);
      setPushEnabled(true);
      setPushError('');
    } catch (e) {
      setPushEnabled(false);
      setPushError(e?.message || 'Failed to enable push notifications');
      console.error('[NotificationContext] enablePush:', e);
    }
  }, []);

  const disablePush = useCallback(async () => {
    const token = getToken();
    try {
      if (token) await unsubscribeFromPush(token);
      setPushEnabled(false);
      setPushError('');
    } catch (e) {
      console.error('[NotificationContext] disablePush:', e);
    }
  }, []);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    notifications,
    notifMap,
    unreadCount,
    setUnreadCount,
    loadingHistory,
    hasMore,
    pushEnabled,
    pushError,
    refresh,
    fetchHistory,
    markAllRead,
    markOneRead,
    removeNotification,
    clearAll,
    enablePush,
    disablePush,
  }), [
    notifications, notifMap, unreadCount, loadingHistory, hasMore,
    pushEnabled, pushError,
    refresh, fetchHistory, markAllRead, markOneRead,
    removeNotification, clearAll, enablePush, disablePush,
  ]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};