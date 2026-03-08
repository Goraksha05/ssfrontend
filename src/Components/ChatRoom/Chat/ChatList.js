// src/Components/ChatRoom/Chat/ChatList.js
//
// ── Root cause analysis (March 2026) ─────────────────────────────────────────
//
// Three bugs were working together to make the sidebar blank after starting
// a new chat. They are fixed across three files. Here is the full picture:
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ BUG 1 — WebSocketClient.js (THE ROOT CAUSE)                            │
// │                                                                         │
// │ onSocketEvent() returned () => {} when socket was null at call time.   │
// │ React useEffect hooks in ChatContext and ChatList fire synchronously     │
// │ after mount. initializeSocket() is async — the socket module variable  │
// │ is still null when those effects run on first render.                  │
// │                                                                         │
// │ Result: ZERO receive_message listeners were ever registered.            │
// │   • ChatContext never appended incoming messages                        │
// │   • ChatList's fetchChats() was never triggered by socket events       │
// │   • After starting a new chat, the sidebar never updated               │
// │                                                                         │
// │ Fix: onSocketEvent() now queues subscriptions when socket is null.     │
// │ The queue is flushed inside attachCoreListeners() (called from the     │
// │ socket's own 'connect' event) the moment the socket connects.         │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ BUG 2 — ChatContext.js                                                  │
// │                                                                         │
// │ The receive_message listener had no chatId guard. It appended every    │
// │ incoming socket message to messages[] regardless of which chat was     │
// │ open. Messages from other chats polluted the active window.            │
// │                                                                         │
// │ Fix: the listener reads selectedChatIdRef.current (a ref, no dep-array │
// │ churn) and only appends when the message belongs to the open chat.     │
// └─────────────────────────────────────────────────────────────────────────┘
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │ BUG 3 — ChatList.js (this file)                                        │
// │                                                                         │
// │ `starting` (a useState variable) was listed in handleStartNewChat's    │
// │ useCallback dependency array. The moment setStarting(true) fired,      │
// │ React created a new closure for handleStartNewChat. The modal had an   │
// │ already-captured reference to the old closure, meaning the async flow  │
// │ could run in an unpredictable state. More importantly, this caused     │
// │ unnecessary re-renders during the critical insert window.              │
// │                                                                         │
// │ Fix: `startingRef` (useRef) replaces `starting` (useState). Refs are  │
// │ mutated synchronously, never cause re-renders, and are always current  │
// │ inside any closure — so the same function instance runs start-to-end.  │
// └─────────────────────────────────────────────────────────────────────────┘

import React, {
  useEffect, useRef, useCallback, useState, useMemo,
} from 'react';
import { Search, MessageSquarePlus } from 'lucide-react';
import { useFriend }      from '../../../Context/Friend/FriendContext';
import { useChat }        from '../../../Context/ChatContext';
import { useAuth }        from '../../../Context/Authorisation/AuthContext';
import { useOnlineUsers } from '../../../Context/OnlineUsersContext';
import { onSocketEvent }  from '../../../WebSocket/WebSocketClient';
import apiRequest         from '../../../utils/apiRequest';
import { getInitials }    from '../../../utils/getInitials';
import NewChatModal       from './NewChatModal';

// ─── Module-level pure helpers ────────────────────────────────────────────────
// These are plain functions, not hooks. They never change identity and never
// appear in any useCallback / useEffect dependency array.

const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];

function getColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

function formatTime(dateStr) {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)         return 'now';
  if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Handles every avatar shape the Chat.populate("members") API can return:
//   { profileavatar: "https://..." }          ← direct string URL
//   { profileavatar: { URL: "https://..." } } ← object with URL key
//   { profileImage: "https://..." }           ← legacy field name
//   { avatar: "https://..." }                 ← alternate legacy field
function resolveAvatar(obj) {
  if (!obj) return null;
  if (typeof obj.profileavatar === 'string' && obj.profileavatar) return obj.profileavatar;
  if (obj.profileavatar?.URL)  return obj.profileavatar.URL;
  if (obj.profileImage)        return obj.profileImage;
  if (obj.avatar)              return obj.avatar;
  return null;
}

// Convert a raw Chat API document → normalised sidebar entry.
// currentUserId is an argument, not a closure — no dep-array issues.
function normaliseChat(chat, currentUserId) {
  const other = chat.members?.find(
    (m) => m._id?.toString() !== currentUserId?.toString(),
  );
  return {
    chatId:          chat._id?.toString()    ?? '',
    friendId:        other?._id?.toString()  ?? null,
    name:            other?.name             ?? 'Unknown',
    profileImage:    resolveAvatar(other),
    lastMessage:     chat.lastMessage        ?? '',
    lastMessageTime: chat.lastMessageTime    ?? null,
    unreadCount:     chat.unreadCount        ?? 0,
  };
}

// Sort: chats with no timestamp (brand-new) float to the top;
// the rest sort newest-first.
function sortChats(list) {
  return [...list].sort((a, b) => {
    if (!a.lastMessageTime && !b.lastMessageTime) return 0;
    if (!a.lastMessageTime) return -1;
    if (!b.lastMessageTime) return  1;
    return new Date(b.lastMessageTime) - new Date(a.lastMessageTime);
  });
}

// ─── Avatar component ─────────────────────────────────────────────────────────

const Avatar = ({ name, imageUrl, size = 42, online = false }) => (
  <div style={{ position: 'relative', flexShrink: 0, width: size, height: size }}>
    {imageUrl ? (
      <img
        src={imageUrl}
        alt={name}
        style={{
          width: size, height: size,
          borderRadius: '50%', objectFit: 'cover', display: 'block',
        }}
      />
    ) : (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: getColor(name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: size * 0.36, color: '#fff', userSelect: 'none',
      }}>
        {getInitials(name)}
      </div>
    )}
    {online && (
      <span
        aria-label="Online"
        style={{
          position: 'absolute', bottom: 1, right: 1,
          width: size * 0.27, height: size * 0.27,
          borderRadius: '50%', background: '#22c55e',
          border: '2px solid var(--bg-secondary, #1e1e2e)',
          display: 'block',
        }}
      />
    )}
  </div>
);

// ─── ChatList ─────────────────────────────────────────────────────────────────

const ChatList = ({ onChatSelect }) => {
  const { friends, loading: loadingFriends, fetchFriends } = useFriend();
  const { setSelectedChat, setMessages, selectedChat }     = useChat();
  const { user }     = useAuth();
  const { isOnline } = useOnlineUsers();

  const [chats,        setChats]        = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [query,        setQuery]        = useState('');
  const [debQ,         setDebQ]         = useState('');
  const [modalOpen,    setModalOpen]    = useState(false);

  const selectedRef = useRef(null);

  // ── Refs ──────────────────────────────────────────────────────────────────
  //
  // userIdRef    — always holds user._id; lets fetchChats read it without
  //               being listed as a dependency (empty dep array stays stable)
  //
  // startingRef  — BUG 3 FIX: replaces `const [starting, setStarting]`.
  //               Using state here caused handleStartNewChat's useCallback to
  //               recreate on every setStarting(true) call, potentially giving
  //               the modal a stale onSelect prop and causing re-renders during
  //               the critical optimistic-insert window.
  //               A ref mutation is synchronous, never triggers a re-render,
  //               and is always current inside any closure.
  const userIdRef   = useRef(user?._id);
  const startingRef = useRef(false);

  useEffect(() => { userIdRef.current = user?._id; }, [user?._id]);

  // ── Debounce search ────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebQ(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  // ── fetchChats ─────────────────────────────────────────────────────
  //
  // Dep array is intentionally EMPTY. The function reads userId through
  // a ref so it never needs to be recreated. This also means the socket
  // listener registered below is only registered once.
  const fetchChats = useCallback(() => {
    const uid = userIdRef.current;
    if (!uid) return;

    apiRequest.get(`/api/chat/${uid}`)
      .then(({ data }) => {
        if (!Array.isArray(data)) return;

        const freshEntries = data.map((c) => normaliseChat(c, uid));

        setChats((prev) => {
          // Server is authoritative for every chat it returns.
          // Preserve locally-inserted optimistic entries that the server
          // hasn't persisted yet (identified by chatId absence in response).
          const serverIds = new Set(freshEntries.map((e) => e.chatId));
          const localOnly = prev.filter((p) => p.chatId && !serverIds.has(p.chatId));
          return sortChats([...freshEntries, ...localOnly]);
        });
      })
      .catch(() => {})
      .finally(() => setLoadingChats(false));
  }, []); // ← EMPTY: all dynamic values read via refs

  // Initial load on mount
  useEffect(() => {
    setLoadingChats(true);
    fetchChats();
  }, [fetchChats]);

  // Refresh sidebar when any message arrives.
  // Thanks to the WebSocketClient queue fix, this subscription is guaranteed
  // to be registered even if the socket wasn't ready at mount time.
  useEffect(() => {
    const off = onSocketEvent('receive_message', () => {
      // Small delay to let the server finish writing before we read
      setTimeout(fetchChats, 600);
    });
    return off;
  }, [fetchChats]);

  // Lazy-load friends only when modal first opens
  useEffect(() => {
    if (modalOpen && !friends.length) fetchFriends();
  }, [modalOpen, friends.length, fetchFriends]);

  // ── Derived values ─────────────────────────────────────────────────

  const filteredChats = useMemo(
    () => chats.filter((c) => c.name.toLowerCase().includes(debQ.toLowerCase())),
    [chats, debQ],
  );

  const selectedFriendId = useMemo(() => {
    if (!selectedChat?.members || !user?._id) return null;
    return (
      selectedChat.members
        .find((m) => m._id?.toString() !== user._id?.toString())
        ?._id?.toString() ?? null
    );
  }, [selectedChat, user?._id]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedChat]);

  // ── Click an existing chat row ─────────────────────────────────────

  const handleSelectChat = useCallback(async (entry) => {
    try {
      const { data: chat } = await apiRequest.post('/api/chat', { receiverId: entry.friendId });
      setSelectedChat(chat); // ChatContext.selectChat clears messages first
      const { data: msgs } = await apiRequest.get(`/api/message/${chat._id}`);
      setMessages(msgs);
      setChats((prev) =>
        prev.map((c) => c.chatId === entry.chatId ? { ...c, unreadCount: 0 } : c),
      );
      onChatSelect?.();
    } catch (err) {
      console.error('[ChatList] Failed to open chat:', err.message);
    }
  }, [setSelectedChat, setMessages, onChatSelect]);

  // ── Start a new chat from the friend-picker modal ──────────────────
  //
  // BUG 3 FIX: startingRef replaces starting state in dep array.
  //
  // Execution order (critical — do not reorder):
  //   1. Guard: bail if already in-flight
  //   2. Close the modal immediately
  //   3. POST /api/chat → get confirmed chatId from server
  //   4. setChats() with the new entry — runs synchronously in React batch,
  //      sidebar updates on the very next paint
  //   5. setSelectedChat() — opens the chat window
  //   6. GET /api/message/:id — loads messages async (sidebar already shown)
  const handleStartNewChat = useCallback(async (friend) => {
    if (startingRef.current) return;
    startingRef.current = true;

    setModalOpen(false); // close modal immediately, don't wait

    try {
      // Step 3: confirm/create the chat document
      const { data: chat } = await apiRequest.post('/api/chat', { receiverId: friend._id });

      if (!chat?._id) throw new Error('Server returned no chat document');

      // Prefer friend object data for name/avatar (already in memory).
      // Fall back to the populated member from the chat response.
      const memberFromChat = chat.members?.find(
        (m) => m._id?.toString() === friend._id?.toString(),
      );

      const newEntry = {
        chatId:          chat._id.toString(),
        friendId:        friend._id?.toString(),
        name:            friend.name             || memberFromChat?.name || 'Unknown',
        profileImage:    resolveAvatar(friend)   || resolveAvatar(memberFromChat),
        lastMessage:     chat.lastMessage        ?? '',
        lastMessageTime: chat.lastMessageTime    ?? null,
        unreadCount:     0,
      };

      // Step 4: update sidebar list synchronously — this is the critical step.
      // Existing entry for this chat is moved to the top; new chats are prepended.
      setChats((prev) => {
        const without = prev.filter((c) => c.chatId !== newEntry.chatId);
        return [newEntry, ...without];
      });

      // Step 5: open the chat window
      setSelectedChat(chat); // ChatContext.selectChat clears stale messages

      // Step 6: load messages (async — sidebar is already showing the entry)
      const { data: msgs } = await apiRequest.get(`/api/message/${chat._id}`);
      setMessages(Array.isArray(msgs) ? msgs : []);

      onChatSelect?.();
    } catch (err) {
      console.error('[ChatList] Failed to start new chat:', err.message);
      // On failure, re-fetch from server to keep list consistent
      fetchChats();
    } finally {
      startingRef.current = false;
    }
  }, [setSelectedChat, setMessages, onChatSelect, fetchChats]);
  // ↑ No `starting` in deps — startingRef mutations never recreate this callback

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Header */}
      <div className="sidebar-header">
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 10,
        }}>
          <h6 style={{ margin: 0 }}>Chats</h6>

          {/* ⊕ New Chat FAB */}
          <button
            onClick={() => setModalOpen(true)}
            aria-label="New conversation"
            title="Start a new conversation"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: '50%',
              border: 'none',
              background: 'var(--accent, #0ea5e9)',
              color: '#fff', cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 2px 10px rgba(14,165,233,0.4)',
              transition: 'transform 160ms cubic-bezier(0.34,1.56,0.64,1), box-shadow 160ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'scale(1.12) rotate(8deg)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(14,165,233,0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
              e.currentTarget.style.boxShadow = '0 2px 10px rgba(14,165,233,0.4)';
            }}
          >
            <MessageSquarePlus size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <Search size={15} className="sidebar-search-icon" />
          <input
            type="text"
            placeholder="Search conversations…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="sidebar-content">
        {loadingChats ? (
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="loading-placeholder">
              <div className="loading-avatar" />
              <div className="loading-lines">
                <div className="loading-line" style={{ width: `${55 + (i % 3) * 15}%` }} />
                <div className="loading-line" style={{ width: `${35 + (i % 4) * 10}%` }} />
              </div>
            </div>
          ))
        ) : filteredChats.length === 0 ? (
          <div className="empty-chat-state" style={{ padding: '48px 24px' }}>
            <div className="empty-chat-icon">{debQ ? '🔍' : '💬'}</div>
            <h6>{debQ ? 'No results' : 'No conversations yet'}</h6>
            <p style={{ marginBottom: debQ ? 0 : 20 }}>
              {debQ ? 'Try a different name.' : 'Tap ⊕ above to start a new chat.'}
            </p>
            {!debQ && (
              <button
                onClick={() => setModalOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7,
                  padding: '9px 20px',
                  background: 'var(--accent, #0ea5e9)', color: '#fff',
                  border: 'none', borderRadius: 20, cursor: 'pointer',
                  fontWeight: 600, fontSize: 13.5,
                  boxShadow: '0 2px 8px rgba(14,165,233,0.35)',
                  transition: 'opacity 150ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
              >
                <MessageSquarePlus size={15} />
                New Conversation
              </button>
            )}
          </div>
        ) : (
          <ul className="chat-list">
            {filteredChats.map((entry) => {
              const isSelected = entry.friendId === selectedFriendId;
              const online     = isOnline(entry.friendId);
              const unread     = entry.unreadCount ?? 0;

              return (
                <li
                  key={entry.chatId}
                  ref={isSelected ? selectedRef : null}
                  className={`chat-list-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelectChat(entry)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleSelectChat(entry);
                  }}
                  aria-current={isSelected ? 'true' : undefined}
                  role="button"
                >
                  <div className="chat-avatar">
                    <Avatar
                      name={entry.name}
                      imageUrl={entry.profileImage}
                      size={42}
                      online={online}
                    />
                  </div>

                  <div className="chat-info">
                    <div className="chat-info-top">
                      <span className="chat-name">{entry.name}</span>
                      {entry.lastMessageTime && (
                        <span className="chat-time">{formatTime(entry.lastMessageTime)}</span>
                      )}
                    </div>
                    <div className="chat-info-bottom">
                      <span className={`chat-preview ${unread > 0 ? 'unread-preview' : ''}`}>
                        {entry.lastMessage || (
                          <em style={{ opacity: 0.4, fontStyle: 'normal' }}>Say hello 👋</em>
                        )}
                      </span>
                      {unread > 0 && (
                        <span className="unread-badge">{unread > 99 ? '99+' : unread}</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Friend-Picker Modal */}
      {modalOpen && (
        <NewChatModal
          friends={friends}
          loadingFriends={loadingFriends}
          isOnline={isOnline}
          onSelect={handleStartNewChat}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
};

export default ChatList;