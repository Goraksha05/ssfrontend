// src/Context/NotificationContext.js
//
// Single source of truth for ALL client-side notification state.
//
// Exposes:
//   unreadCount    — server-fetched on mount, incremented by socket events
//   notifications  — live real-time arrivals (newest-first, capped at 50)
//   markAllRead()  — optimistic update + PUT /api/notifications/mark-all-read
//   markOneRead()  — optimistic update + PUT /api/notifications/:id/read
//   refresh()      — re-fetches unread count from server (call after panel load)
//   pushEnabled    — web-push subscription status
//   enablePush()   — subscribe to web push
//   disablePush()  — unsubscribe from web push
//   pushError      — last push error message
//
// ── Consumer map ──────────────────────────────────────────────────────────────
//   NotificationsPanel   → unreadCount, notifications, markAllRead, markOneRead, refresh
//   NotificationPopup    → unreadCount, notifications, markAllRead, markOneRead
//   NotificationSettings → pushEnabled, pushError, enablePush, disablePush
//   Navbartemp / Header  → unreadCount  (bell badge ONLY — do not put other state here)
//
// FIXES:
//   1. Listener leak: when the socket was not ready at mount time, the delayed
//      attach() stored `offFn` in its closure but the cleanup returned to React
//      was `() => clearTimeout(t)` — which never called offFn after the timer
//      fired. On unmount between the mount and the 1.5 s retry the listener
//      would be registered but never removed.
//      Fix: use a shared mutable ref (`offRef`) so whichever path registers the
//      listener — immediate or delayed — the single cleanup function returned to
//      React always calls the correct teardown.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../utils/apiRequest';
import { subscribeForPush, unsubscribeFromPush } from '../utils/pushClient';
import { onSocketEvent, getSocket } from '../WebSocket/WebSocketClient';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [unreadCount,   setUnreadCount]   = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [pushEnabled,   setPushEnabled]   = useState(false);
  const [pushError,     setPushError]     = useState('');

  // Track seen IDs to deduplicate across reconnects
  const seenIdsRef = useRef(new Set());

  // ── Fetch initial unread count from server ────────────────────────────────
  const refresh = useCallback(async () => {
    try {
      if (!localStorage.getItem('token')) return;
      const res = await apiRequest.get('/api/notifications/unread-count');
      setUnreadCount(res?.data?.unreadCount ?? 0);
    } catch (err) {
      // Non-fatal — badge stays at 0 on failure
      console.debug('[NotificationContext] refresh unread-count failed:', err?.message);
    }
  }, []);

  // Fetch on mount when a token is present
  useEffect(() => {
    if (localStorage.getItem('token')) refresh();
  }, [refresh]);

  // ── Real-time socket listener ─────────────────────────────────────────────
  //
  // FIX: use a ref to hold the teardown function so both the immediate-attach
  // path and the delayed-retry path point to the same cleanup slot.
  // Previously the cleanup closure captured `offFn` at declaration time
  // (always `() => {}`), so the listener registered by the delayed setTimeout
  // was never cleaned up when the component unmounted during the 1.5 s window.
  useEffect(() => {
    // Holds the unsubscribe function once a listener is successfully registered.
    const offRef = { current: null };
    let timerId  = null;

    const handleNotification = (payload) => {
      // Deduplicate by _id (handles re-emit on reconnect)
      if (payload._id && seenIdsRef.current.has(payload._id)) return;
      if (payload._id) seenIdsRef.current.add(payload._id);

      // Prepend to live list, cap at 50
      setNotifications((prev) => [payload, ...prev].slice(0, 50));

      // Increment badge
      setUnreadCount((c) => c + 1);

      // Toast — only if the tab is visible
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

      // Store teardown in the ref so the cleanup below always reaches it
      offRef.current = onSocketEvent('notification', handleNotification);
      return true;
    };

    if (!attach()) {
      // Socket not ready yet — retry once after a brief delay.
      // The cleanup function returned to React will cancel the timer AND
      // remove the listener regardless of which path registered it.
      timerId = setTimeout(attach, 1_500);
    }

    return () => {
      if (timerId !== null) clearTimeout(timerId);
      // Call teardown if the listener was registered (immediately or delayed)
      offRef.current?.();
    };
  }, []); // single mount — listener swap on reconnect handled by onSocketEvent

  // ── Reset state on logout (storage event cross-tab + same-tab) ───────────
  useEffect(() => {
    const handler = () => {
      if (!localStorage.getItem('token')) {
        seenIdsRef.current = new Set();
        setNotifications([]);
        setUnreadCount(0);
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ── Mark all notifications as read ───────────────────────────────────────
  const markAllRead = useCallback(async () => {
    // Optimistic
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiRequest.put('/api/notifications/mark-all-read');
    } catch (err) {
      console.error('[NotificationContext] markAllRead failed:', err?.message);
      refresh(); // re-sync from server on failure
    }
  }, [refresh]);

  // ── Mark one notification as read ─────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    // Optimistic
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await apiRequest.put(`/api/notifications/${id}/read`);
    } catch (err) {
      console.error('[NotificationContext] markOneRead failed:', err?.message);
      refresh();
    }
  }, [refresh]);

  // ── Push helpers ──────────────────────────────────────────────────────────
  const enablePush = useCallback(async () => {
    const token = localStorage.getItem('token');
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
    const token = localStorage.getItem('token');
    try {
      if (token) await unsubscribeFromPush(token);
      setPushEnabled(false);
      setPushError('');
    } catch (e) {
      console.error('[NotificationContext] disablePush:', e);
    }
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        unreadCount,
        setUnreadCount,
        notifications,
        setNotifications,
        pushEnabled,
        pushError,
        enablePush,
        disablePush,
        markAllRead,
        markOneRead,
        refresh,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within a NotificationProvider');
  return ctx;
};