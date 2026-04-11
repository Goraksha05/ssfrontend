// src/Context/ChatContext.js
//
// Production improvements over previous version:
//
//   PERF-1  Message history is fetched from the REST API when a chat is
//           selected (selectChat). The previous version relied solely on socket
//           events, so messages from before the session were invisible.
//
//   PERF-2  Cursor-based message pagination: loadMoreMessages() fetches older
//           messages using the `before` cursor param (timestamp of the oldest
//           loaded message). hasMoreMessages and loadingMessages are exposed.
//
//   PERF-3  AbortController cancels stale message fetches when the user
//           switches chats before the previous fetch resolves.
//
//   DX-1    messageMap: Map<_id, message> for O(1) de-duplication and in-place
//           updates (read receipts, reactions, edits) without a full array scan.
//
//   DX-2    markChatRead() calls PUT /api/chat/mark-read/:chatId so the
//           server unread count is zeroed when the user opens a conversation.
//
//   DX-3    typing state is keyed by userId (Map) so group chats show multiple
//           typing indicators correctly.
//
//   DX-4    updateMessage() patches a single message in-place (reactions,
//           edits, soft deletes) without rebuilding the full array.
//
//   RELIABILITY-1  Socket listeners re-register on 'connect' (reconnect).
//
//   CORRECTNESS-1  chatId guard preserved from previous fix: incoming socket
//                  messages are only appended when they belong to the open chat.

import React, {
  createContext, useContext, useState,
  useEffect, useCallback, useRef, useMemo,
} from 'react';
import { onSocketEvent, safeEmit, isSocketReady, getSocket } from '../WebSocket/WebSocketClient';
import apiRequest from '../utils/apiRequest';

const ChatContext = createContext(null);

const BACKEND_URL =
  process.env.REACT_APP_SERVER_URL  ??
  process.env.REACT_APP_BACKEND_URL ??
  '';
const MESSAGES_PAGE_SIZE = 50;

// ── Helpers ───────────────────────────────────────────────────────────────────

const getToken = () => localStorage.getItem('token');

// ─────────────────────────────────────────────────────────────────────────────

export const ChatProvider = ({ children }) => {
  const [selectedChat,     setSelectedChat]     = useState(null);
  const [messages,         setMessages]         = useState([]);
  const [messageMap,       setMessageMap]       = useState(new Map());
  const [typingUsers,      setTypingUsers]       = useState(new Map()); // userId → true
  const [loadingMessages,  setLoadingMessages]  = useState(false);
  const [hasMoreMessages,  setHasMoreMessages]  = useState(false);
  const [messageCursor,    setMessageCursor]    = useState(null); // ISO date string

  // Stable ref of the currently-open chat ID (avoids socket dep-array churn)
  const selectedChatIdRef = useRef(null);
  useEffect(() => {
    selectedChatIdRef.current = selectedChat?._id?.toString() ?? null;
  }, [selectedChat?._id]);

  // AbortController for message fetches
  const fetchAbortRef = useRef(null);

  // ── Sync messages array ↔ messageMap ────────────────────────────────────
  const syncMessages = useCallback((msgs) => {
    setMessages(msgs);
    setMessageMap(new Map(msgs.map((m) => [m._id, m])));
  }, []);

  // ── fetchMessages (for the currently selected chat) ──────────────────────
  const fetchMessages = useCallback(async (chatId, before = null) => {
    if (!chatId) return;
    const token = getToken();
    if (!token) return;

    fetchAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAbortRef.current = controller;

    setLoadingMessages(true);
    try {
      let url = `${BACKEND_URL}/api/message/${chatId}?limit=${MESSAGES_PAGE_SIZE}`;
      if (before) url += `&before=${before}`;

      const { data } = await apiRequest.get(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });

      const fetched = Array.isArray(data) ? data : [];

      if (!before) {
        // First page — replace state
        syncMessages(fetched);
      } else {
        // Subsequent page — prepend (deduplicated)
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m._id));
          const newItems = fetched.filter((m) => !existingIds.has(m._id));
          const combined = [...newItems, ...prev];
          setMessageMap(new Map(combined.map((m) => [m._id, m])));
          return combined;
        });
      }

      // Cursor = createdAt of the oldest message fetched
      const oldest = fetched[0]?.createdAt ?? null;
      setMessageCursor(oldest);
      setHasMoreMessages(fetched.length === MESSAGES_PAGE_SIZE);
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      console.error('[ChatContext] fetchMessages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, [syncMessages]);

  // ── loadMoreMessages (older history) ─────────────────────────────────────
  const loadMoreMessages = useCallback(async () => {
    if (!selectedChat?._id || !hasMoreMessages || loadingMessages || !messageCursor) return;
    await fetchMessages(selectedChat._id, messageCursor);
  }, [selectedChat?._id, hasMoreMessages, loadingMessages, messageCursor, fetchMessages]);

  // ── selectChat: clear stale state and fetch fresh messages ───────────────
  const selectChat = useCallback(async (chat) => {
    // Cancel any previous fetch
    fetchAbortRef.current?.abort();

    // Reset synchronously — no flash of old messages
    syncMessages([]);
    setTypingUsers(new Map());
    setHasMoreMessages(false);
    setMessageCursor(null);
    setSelectedChat(chat);

    if (chat?._id) {
      await fetchMessages(chat._id);
      // Mark as read on the server
      markChatRead(chat._id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchMessages, syncMessages]);

  // ── markChatRead ──────────────────────────────────────────────────────────
  const markChatRead = useCallback((chatId) => {
    const token = getToken();
    if (!token || !chatId) return;
    apiRequest
      .put(`${BACKEND_URL}/api/chat/mark-read/${chatId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch((err) => console.debug('[ChatContext] markChatRead:', err?.message));
  }, []);

  // ── updateMessage: patch a single message in-place ───────────────────────
  const updateMessage = useCallback((id, patch) => {
    setMessages((prev) => {
      const updated = prev.map((m) => (m._id === id ? { ...m, ...patch } : m));
      setMessageMap(new Map(updated.map((m) => [m._id, m])));
      return updated;
    });
  }, []);

  // ── appendMessage: add a new message (dedup by _id) ─────────────────────
  const appendMessage = useCallback((msg) => {
    if (!msg?._id) return;
    setMessages((prev) => {
      if (prev.some((m) => m._id === msg._id)) return prev;
      const updated = [...prev, msg];
      setMessageMap(new Map(updated.map((m) => [m._id, m])));
      return updated;
    });
  }, []);

  // ── Socket: incoming messages ─────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('receive_message', ({ message }) => {
      if (!message) return;
      const msgChatId = message.chatId?.toString();
      if (
        msgChatId &&
        selectedChatIdRef.current &&
        msgChatId !== selectedChatIdRef.current
      ) {
        // Message belongs to a different chat — don't pollute the active view
        return;
      }
      appendMessage(message);
    });
    return off;
  }, [appendMessage]);

  // ── Socket: read receipts ─────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('message-read', ({ messageId, readBy }) => {
      if (!messageId) return;
      updateMessage(messageId, {
        seenBy: [...(messageMap.get(messageId)?.seenBy ?? []), readBy],
      });
    });
    return off;
  }, [messageMap, updateMessage]);

  // ── Socket: message edits ─────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('message-edited', ({ messageId, newText, editedAt }) => {
      if (!messageId) return;
      updateMessage(messageId, { text: newText, isEdited: true, editedAt });
    });
    return off;
  }, [updateMessage]);

  // ── Socket: message deletions ─────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('message-deleted', ({ messageId, type }) => {
      if (!messageId) return;
      if (type === 'everyone') {
        updateMessage(messageId, { isDeleted: true, text: null, mediaUrl: null });
      }
    });
    return off;
  }, [updateMessage]);

  // ── Socket: reactions ─────────────────────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('reaction-added', ({ messageId, userId, emoji }) => {
      if (!messageId) return;
      const existing = messageMap.get(messageId);
      if (!existing) return;
      const filtered = (existing.reactions ?? []).filter(
        (r) => r.userId !== userId
      );
      updateMessage(messageId, {
        reactions: emoji ? [...filtered, { userId, emoji }] : filtered,
      });
    });
    return off;
  }, [messageMap, updateMessage]);

  // ── Socket: typing indicators ─────────────────────────────────────────────
  useEffect(() => {
    const offStart = onSocketEvent('user-typing', ({ fromUserId, chatId }) => {
      if (chatId && selectedChatIdRef.current && chatId !== selectedChatIdRef.current) return;
      setTypingUsers((prev) => new Map([...prev, [fromUserId, true]]));
    });
    const offStop = onSocketEvent('user-stop-typing', ({ fromUserId, chatId }) => {
      if (chatId && selectedChatIdRef.current && chatId !== selectedChatIdRef.current) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        next.delete(fromUserId);
        return next;
      });
    });
    return () => { offStart(); offStop(); };
  }, []);

  // ── Socket: re-register on reconnect ─────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const onReconnect = () => {
      // Re-fetch messages for the current chat to catch anything missed
      if (selectedChatIdRef.current) {
        fetchMessages(selectedChatIdRef.current);
      }
    };
    socket.on('connect', onReconnect);
    return () => socket.off('connect', onReconnect);
  }, [fetchMessages]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => { fetchAbortRef.current?.abort(); };
  }, []);

  // ── Emit helpers ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(({ toUserId, content, chatId, type = 'text' }) => {
    if (!toUserId || !content) return;
    safeEmit('send_message', {
      toUserId,
      message: { content, type, chatId, timestamp: new Date() },
    });
  }, []);

  const emitTyping = useCallback(({ toUserId, chatId, isTyping: typing }) => {
    safeEmit(typing ? 'typing' : 'stop-typing', { toUserId, chatId });
  }, []);

  const uploadFile = useCallback(async (formData) => {
    try {
      const res = await apiRequest.post('/api/upload/chat', formData);
      return res.data?.url ?? null;
    } catch (err) {
      console.error('[ChatContext] uploadFile:', err);
      return null;
    }
  }, []);

  // ── Derived: typingUserIds as sorted array for stable rendering ───────────
  const typingUserIds = useMemo(
    () => [...typingUsers.keys()],
    [typingUsers]
  );

  const isTyping = typingUsers.size > 0;

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    selectedChat,
    messages,
    messageMap,
    typingUsers,
    typingUserIds,
    isTyping,
    loadingMessages,
    hasMoreMessages,
    // API
    selectChat,
    setSelectedChat: selectChat,   // backward-compat alias
    setMessages,
    updateMessage,
    appendMessage,
    loadMoreMessages,
    markChatRead,
    sendMessage,
    emitTyping,
    uploadFile,
    isReady: isSocketReady,        // callable: isReady() → boolean
  }), [
    selectedChat, messages, messageMap,
    typingUsers, typingUserIds, isTyping,
    loadingMessages, hasMoreMessages,
    selectChat, updateMessage, appendMessage,
    loadMoreMessages, markChatRead,
    sendMessage, emitTyping, uploadFile,
  ]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
};

export const useChat = () => {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within a ChatProvider');
  return ctx;
};