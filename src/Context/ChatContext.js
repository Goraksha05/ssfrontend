// src/Context/ChatContext.js
//
// ── Fixes in this version ────────────────────────────────────────────────────
//
// FIX 1 — receive_message listener had no chatId guard
//   The original listener blindly called:
//     setMessages((prev) => [...prev, { ...message, from: fromUserId }])
//   for EVERY socket message, regardless of which chat was open.
//   This caused messages from other chats to pollute the active chat's
//   message list, producing wrong content and ghost re-renders that could
//   fight with ChatList's own socket listener.
//
//   Fix: the listener reads `selectedChatIdRef.current` (a ref so no
//   dep-array churn) and only appends when the message belongs to the
//   currently open chat.  Messages for other chats are intentionally
//   ignored here — ChatList's receive_message listener handles the
//   sidebar unread-count refresh independently.
//
// FIX 2 — messages not cleared when switching chats
//   Previously switching chats left stale messages visible for a flash
//   before the new fetch resolved.
//   Fix: setSelectedChat is wrapped in a selectChat helper that clears
//   messages synchronously before setting the new chat.
//
// NOTE: The root cause of listeners never being registered (socket null at
//       mount time) is fixed in WebSocketClient.js — the pending-subscription
//       queue ensures onSocketEvent() works even before initializeSocket()
//       completes.

import {
  createContext, useContext, useState,
  useEffect, useCallback, useRef,
} from 'react';
import { onSocketEvent, safeEmit, isSocketReady } from '../WebSocket/WebSocketClient';
import apiRequest from '../utils/apiRequest';

const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages,     setMessages]     = useState([]);
  const [isTyping,     setIsTyping]     = useState(false);

  // Ref that always holds the currently-open chat's _id as a string.
  // Using a ref (not state) means the socket listener registered below
  // never needs to be recreated — it reads the ref at event time.
  const selectedChatIdRef = useRef(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id?.toString() ?? null;
  }, [selectedChat?._id]);

  // ── Incoming messages ────────────────────────────────────────────────────
  //
  // Registered once on mount. WebSocketClient queues this subscription if the
  // socket isn't ready yet and flushes it once the connection is established.
  useEffect(() => {
    const off = onSocketEvent('receive_message', ({ fromUserId, message }) => {
      if (!message) return;

      // Only append if this message belongs to the currently open chat.
      // ChatList handles sidebar updates for messages in other chats.
      const msgChatId = message.chatId?.toString();
      if (msgChatId && selectedChatIdRef.current && msgChatId !== selectedChatIdRef.current) {
        return;
      }

      setMessages((prev) => {
        // Deduplicate — handles the case where ChatWindow also receives the
        // same message via its own listener.
        if (message._id && prev.some((m) => m._id?.toString() === message._id.toString())) {
          return prev;
        }
        return [...prev, { ...message, from: fromUserId }];
      });
    });
    return off;
  }, []); // single mount — socket subscription is stable via the queue fix

  // ── Typing events ────────────────────────────────────────────────────────
  useEffect(() => {
    const offStart = onSocketEvent('user-typing', ({ fromUserId, chatId }) => {
      // Scope to the currently open chat only
      if (chatId && selectedChatIdRef.current && chatId !== selectedChatIdRef.current) return;
      setIsTyping(true);
    });
    const offStop = onSocketEvent('user-stop-typing', ({ fromUserId, chatId }) => {
      if (chatId && selectedChatIdRef.current && chatId !== selectedChatIdRef.current) return;
      setIsTyping(false);
    });
    return () => { offStart(); offStop(); };
  }, []); // single mount — reads ref inside handlers

  // ── selectChat: clear stale messages before switching ─────────────────────
  //
  // Wraps the raw setSelectedChat so callers get clean state on every switch.
  // ChatList calls this instead of setSelectedChat directly.
  const selectChat = useCallback((chat) => {
    setMessages([]);      // clear immediately — no flash of old messages
    setIsTyping(false);   // reset typing indicator for new chat
    setSelectedChat(chat);
  }, []);

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
        // Expose both the raw setter (for ChatWindow's internal use) and the
        // safe wrapper. ChatList should use setSelectedChat which now points
        // to selectChat.
        setSelectedChat: selectChat,
        messages,
        setMessages,
        isTyping,
        setIsTyping,
        sendMessage,
        emitTyping,
        uploadFile,
        isReady: isSocketReady,
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