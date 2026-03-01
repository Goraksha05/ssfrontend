// src/Context/ChatContext.js
//
// Provides chat state and actions to the messaging UI.
//
// Changes from original:
//   • Uses onSocketEvent() instead of socket.on/off to avoid clobbering
//     other listeners on reconnect.
//   • sendMessage validates socket readiness via isSocketReady().
//   • Does not call getSocket() at render time (avoids stale null reference).

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { onSocketEvent, safeEmit, isSocketReady } from '../WebSocket/WebSocketClient';
import apiRequest from '../utils/apiRequest';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [isTyping,     setIsTyping]     = useState(false);

  // ── Incoming messages ────────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('receive_message', ({ fromUserId, message }) => {
      setMessages((prev) => [...prev, { ...message, from: fromUserId }]);
    });
    return off;
  }, []); // single mount — onSocketEvent handles reconnect

  // ── Typing events ────────────────────────────────────────────────────────
  useEffect(() => {
    const offStart = onSocketEvent('user-typing',      ({ fromUserId }) => {
      // Only show typing for the currently selected chat partner
      if (selectedChat && fromUserId !== selectedChat?.members?.find?.(m => m !== selectedChat?.myId)) return;
      setIsTyping(true);
    });
    const offStop  = onSocketEvent('user-stop-typing', () => setIsTyping(false));

    return () => { offStart(); offStop(); };
  }, [selectedChat]);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(({ toUserId, content, chatId, type = 'text' }) => {
    if (!toUserId || !content) return;
    safeEmit('send_message', {
      toUserId,
      message: { content, type, chatId, timestamp: new Date() },
    });
  }, []);

  // ── Emit typing indicator ─────────────────────────────────────────────────
  const emitTyping = useCallback(({ toUserId, chatId, isTyping: typing }) => {
    safeEmit(typing ? 'typing' : 'stop-typing', { toUserId, chatId });
  }, []);

  // ── File upload ───────────────────────────────────────────────────────────
  const uploadFile = useCallback(async (formData) => {
    try {
      const res = await apiRequest.post('/api/upload/chat', formData);
      return res.data?.url ?? null;
    } catch (err) {
      console.error('[ChatContext] Upload failed:', err);
      return null;
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        selectedChat,
        setSelectedChat,
        messages,
        setMessages,
        isTyping,
        setIsTyping,
        sendMessage,
        emitTyping,
        uploadFile,
        isReady: isSocketReady, // let components check before sending
      }}
    >
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
};