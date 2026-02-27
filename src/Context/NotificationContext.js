// src/Context/NotificationContext.js
import { createContext, useContext, useState, useCallback } from 'react';
import { subscribeForPush, unsubscribeFromPush } from '../utils/pushClient';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushError, setPushError]   = useState('');

  const enablePush = useCallback(async () => {
    // Read token fresh each time so we don't close over a stale value
    const token = localStorage.getItem('token');
    if (!token) {
      setPushError('Not authenticated');
      return;
    }
    try {
      await subscribeForPush(token);
      setPushEnabled(true);
      setPushError('');
    } catch (e) {
      setPushEnabled(false);
      const msg = e?.message || 'Failed to enable push notifications';
      setPushError(msg);
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
      value={{ unreadCount, setUnreadCount, pushEnabled, pushError, enablePush, disablePush }}
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