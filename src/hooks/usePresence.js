import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useSocket } from "../Context/SocketContext";
import { useOnlineUsers } from "../Context/OnlineUsersContext";
import { onSocketEvent } from "../WebSocket/WebSocketClient";

// ─────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────
const TYPING_AUTO_EXPIRE_MS = 5000;
const TYPING_DEBOUNCE_MS = 150;

// ─────────────────────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────────────────────
export const usePresence = (chatId) => {
  const { connected } = useSocket();
  const { isOnline, onlineUserIds } = useOnlineUsers();

  // Map<userId, timeoutId>
  const typingTimers = useRef(new Map());

  // Map<userId, lastTypingTimestamp>
  const lastTypingEvent = useRef(new Map());

  const [typingUsers, setTypingUsers] = useState(new Set());

  // ───────────────────────────────────────────────────────────
  // INTERNAL HELPERS
  // ───────────────────────────────────────────────────────────

  const safeSetTyping = useCallback((updater) => {
    setTypingUsers((prev) => {
      const next = updater(prev);
      return next === prev ? prev : new Set(next);
    });
  }, []);

  const clearUserTimer = useCallback((userId) => {
    const timers = typingTimers.current;
    if (timers.has(userId)) {
      clearTimeout(timers.get(userId));
      timers.delete(userId);
    }
  }, []);

  // ───────────────────────────────────────────────────────────
  // REMOVE TYPING (debounced)
  // ───────────────────────────────────────────────────────────
  const removeTyping = useCallback((userId) => {
    const lastTime = lastTypingEvent.current.get(userId);
    if (!lastTime) return;

    const now = Date.now();

    // 🔥 Debounce protection (prevents flicker)
    if (now - lastTime < TYPING_DEBOUNCE_MS) return;

    safeSetTyping((prev) => {
      if (!prev.has(userId)) return prev;
      const next = new Set(prev);
      next.delete(userId);
      return next;
    });

    clearUserTimer(userId);
    lastTypingEvent.current.delete(userId);
  }, [clearUserTimer, safeSetTyping]);

  // ───────────────────────────────────────────────────────────
  // ADD TYPING
  // ───────────────────────────────────────────────────────────
  const addTyping = useCallback((userId) => {
    const now = Date.now();
    lastTypingEvent.current.set(userId, now);

    safeSetTyping((prev) => {
      if (prev.has(userId)) return prev;
      const next = new Set(prev);
      next.add(userId);
      return next;
    });

    clearUserTimer(userId);

    const timeoutId = setTimeout(() => {
      const lastTime = lastTypingEvent.current.get(userId);

      // Prevent stale timer removal
      if (!lastTime || Date.now() - lastTime < TYPING_AUTO_EXPIRE_MS) return;

      removeTyping(userId);
    }, TYPING_AUTO_EXPIRE_MS);

    typingTimers.current.set(userId, timeoutId);
  }, [clearUserTimer, safeSetTyping, removeTyping]);


  // ───────────────────────────────────────────────────────────
  // SOCKET EVENTS
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const handleTyping = ({ fromUserId, chatId: incomingChatId }) => {
      if (chatId && incomingChatId && incomingChatId !== chatId) return;
      addTyping(String(fromUserId));
    };

    const handleStopTyping = ({ fromUserId, chatId: incomingChatId }) => {
      if (chatId && incomingChatId && incomingChatId !== chatId) return;
      removeTyping(String(fromUserId));
    };

    const offTyping = onSocketEvent("user-typing", handleTyping);
    const offStopTyping = onSocketEvent("user-stop-typing", handleStopTyping);

    return () => {
      offTyping();
      offStopTyping();
    };
  }, [chatId, addTyping, removeTyping]);

  // ───────────────────────────────────────────────────────────
  // HANDLE DISCONNECT
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!connected) {
      const timers = typingTimers.current;

      timers.forEach(clearTimeout);
      timers.clear();
      lastTypingEvent.current.clear();
      setTypingUsers(new Set());
    }
  }, [connected]);

  // ───────────────────────────────────────────────────────────
  // CLEANUP (FIXED WARNING)
  // ───────────────────────────────────────────────────────────
  useEffect(() => {
    const timers = typingTimers.current;

    return () => {
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  // ───────────────────────────────────────────────────────────
  // STABLE HELPERS
  // ───────────────────────────────────────────────────────────
  const isTyping = useCallback(
    (userId) => typingUsers.has(String(userId)),
    [typingUsers]
  );

  const typingUserIds = useMemo(() => [...typingUsers], [typingUsers]);

  // ───────────────────────────────────────────────────────────
  // RETURN
  // ───────────────────────────────────────────────────────────
  return {
    connected,
    onlineUserIds,
    typingUsers,
    typingUserIds,
    isOnline,
    isTyping,
  };
};