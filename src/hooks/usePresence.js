// src/hooks/usePresence.js
//
// Combines online-users data (from OnlineUsersContext) with typing indicators
// (from local socket events) into a single convenient hook.
//
// Typing is kept local to this hook because it is ephemeral and chat-scoped —
// no need to hoist it to a global context.

import { useEffect, useState, useCallback } from 'react';
import { useSocket }       from '../Context/SocketContext';
import { useOnlineUsers }  from '../Context/OnlineUsersContext';
import { onSocketEvent }   from '../WebSocket/WebSocketClient';

/**
 * @param {string} [chatId]  Optional — if provided, typing state is scoped
 *                           to this specific chat room.
 */
export const usePresence = (chatId) => {
  const { connected }          = useSocket();
  const { isOnline, onlineUserIds } = useOnlineUsers();

  const [typingUsers, setTypingUsers] = useState(new Set());

  // ── Typing indicators ─────────────────────────────────────────────────────
  useEffect(() => {
    const onTyping = ({ fromUserId, chatId: tChatId }) => {
      if (chatId && tChatId && tChatId !== chatId) return; // scope to chat
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.add(fromUserId);
        return next;
      });
    };

    const onStopTyping = ({ fromUserId, chatId: tChatId }) => {
      if (chatId && tChatId && tChatId !== chatId) return;
      setTypingUsers((prev) => {
        const next = new Set(prev);
        next.delete(fromUserId);
        return next;
      });
    };

    const offTyping     = onSocketEvent('user-typing',      onTyping);
    const offStopTyping = onSocketEvent('user-stop-typing', onStopTyping);

    return () => {
      offTyping();
      offStopTyping();
    };
  }, [chatId]);

  // ── Clear typing state when socket disconnects ────────────────────────────
  useEffect(() => {
    if (!connected) setTypingUsers(new Set());
  }, [connected]);

  // ── Convenience helpers ───────────────────────────────────────────────────
  const isTyping = useCallback(
    (userId) => typingUsers.has(String(userId)),
    [typingUsers]
  );

  return {
    onlineUserIds,
    typingUsers,        // Set<userId>
    isOnline,           // (userId: string) => boolean
    isTyping,           // (userId: string) => boolean
    connected,
  };
};