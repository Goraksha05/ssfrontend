// src/Context/NotificationContext.js
//
// Owns all client-side notification state:
//   • unreadCount — kept in sync with the server on socket events
//   • Real-time socket listener for incoming notifications
//   • Push subscription helpers
//
// NotificationsPanel reads from this context instead of maintaining its own
// parallel state, so the badge and the panel are always consistent.

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { toast } from 'react-toastify';
import { subscribeForPush, unsubscribeFromPush } from '../utils/pushClient';
import { onSocketEvent, getSocket } from '../WebSocket/WebSocketClient';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount]       = useState(0);
  const [notifications, setNotifications]   = useState([]); // live incoming, pre-fetch
  const [pushEnabled, setPushEnabled]       = useState(false);
  const [pushError,   setPushError]         = useState('');

  // Track seen notification IDs to prevent duplicates across reconnects
  const seenIdsRef = useRef(new Set());

  // ── Real-time socket listener ─────────────────────────────────────────────
  useEffect(() => {
    // Attach as soon as there's a socket; re-attach after reconnect.
    // onSocketEvent returns a cleanup fn — if the socket doesn't exist yet,
    // we poll briefly. In practice the SocketProvider mounts first.
    let offFn = () => {};

    const attach = () => {
      const sock = getSocket();
      if (!sock) return false;

      offFn = onSocketEvent('notification', (payload) => {
        // Deduplicate by _id (handles re-emit on reconnect)
        if (payload._id && seenIdsRef.current.has(payload._id)) return;
        if (payload._id) seenIdsRef.current.add(payload._id);

        // Add to live list (newest first)
        setNotifications((prev) => [payload, ...prev].slice(0, 50)); // cap at 50

        // Increment badge
        setUnreadCount((c) => c + 1);

        // Toast — respect browser tab visibility
        if (document.visibilityState !== 'hidden') {
          toast.info(payload.message || 'New notification', {
            autoClose: 4_000,
            onClick: () => {
              if (payload.url) window.location.href = payload.url;
            },
          });
        }
      });

      return true;
    };

    // If socket exists synchronously, attach immediately
    if (!attach()) {
      // Retry once after a short delay (socket initialising)
      const t = setTimeout(attach, 1_500);
      return () => clearTimeout(t);
    }

    return () => offFn();
  }, []); // single mount — onSocketEvent handles listener swap on reconnect

  // ── Reset seen IDs when the user logs out (token disappears) ─────────────
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
        notifications,        // live real-time arrivals
        setNotifications,
        pushEnabled,
        pushError,
        enablePush,
        disablePush,
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