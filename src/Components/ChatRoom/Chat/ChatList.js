// src/Components/ChatRoom/Chat/ChatList.js
//
// Professional sidebar with:
//   • Sorted by latest message timestamp (most recent at top)
//   • Live online dot via OnlineUsersContext
//   • Unread badge + bold preview when unread
//   • Debounced search
//   • Smooth skeleton loading
//   • Keyboard accessible

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { Search }  from 'lucide-react';
import { useFriend }      from '../../../Context/Friend/FriendContext';
import { useChat }        from '../../../Context/ChatContext';
import { useAuth }        from '../../../Context/Authorisation/AuthContext';
import { useOnlineUsers } from '../../../Context/OnlineUsersContext';
import { onSocketEvent }  from '../../../WebSocket/WebSocketClient';
import apiRequest         from '../../../utils/apiRequest';
import { getInitials }    from '../../../utils/getInitials';

const COLORS = ['#0ea5e9','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
const getColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d    = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000)         return 'now';
  if (diff < 3_600_000)      return `${Math.floor(diff / 60_000)}m`;
  if (diff < 86_400_000)     return `${Math.floor(diff / 3_600_000)}h`;
  if (diff < 7 * 86_400_000) return d.toLocaleDateString(undefined, { weekday: 'short' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const ChatList = ({ onChatSelect }) => {
  const { friends, loading, fetchFriends } = useFriend();
  const { setSelectedChat, setMessages, selectedChat } = useChat();
  const { user }     = useAuth();
  const { isOnline } = useOnlineUsers();

  const [query,    setQuery]    = useState('');
  const [debQ,     setDebQ]     = useState('');
  // chatMeta: friendId → { lastMessage, lastMessageTime, unreadCount }
  const [chatMeta, setChatMeta] = useState({});

  const selectedRef = useRef(null);

  // ── Debounce ─────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => setDebQ(query), 150);
    return () => clearTimeout(t);
  }, [query]);

  // ── Bootstrap ─────────────────────────────────────────────────────
  useEffect(() => { if (!friends.length) fetchFriends(); }, [friends.length, fetchFriends]);

  // ── Fetch chat metadata ───────────────────────────────────────────
  const fetchMeta = useCallback(() => {
    if (!user?._id) return;
    apiRequest.get(`/api/chat/${user._id}`).then(({ data }) => {
      if (!Array.isArray(data)) return;
      const meta = {};
      data.forEach((chat) => {
        const other = chat.members?.find((m) => m._id !== user._id);
        if (other?._id) {
          meta[other._id] = {
            lastMessage:     chat.lastMessage     ?? '',
            lastMessageTime: chat.lastMessageTime ?? null,
            unreadCount:     chat.unreadCount     ?? 0,
          };
        }
      });
      setChatMeta(meta);
    }).catch(() => {});
  }, [user?._id]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);

  // ── Live update: when a new message arrives in any chat, refresh meta ──
  useEffect(() => {
    const off = onSocketEvent('receive_message', () => {
      // Slight delay so the server has saved the message
      setTimeout(fetchMeta, 500);
    });
    return off;
  }, [fetchMeta]);

  // ── Sort friends by most recent message ───────────────────────────
  const sortedFriends = useMemo(() => {
    const filtered = friends.filter((f) =>
      f.name.toLowerCase().includes(debQ.toLowerCase())
    );
    return [...filtered].sort((a, b) => {
      const tA = chatMeta[a._id]?.lastMessageTime
        ? new Date(chatMeta[a._id].lastMessageTime).getTime() : 0;
      const tB = chatMeta[b._id]?.lastMessageTime
        ? new Date(chatMeta[b._id].lastMessageTime).getTime() : 0;
      return tB - tA;
    });
  }, [friends, debQ, chatMeta]);

  // ── Selected friend ───────────────────────────────────────────────
  const selectedFriendId = useMemo(() => {
    if (!selectedChat?.members || !user?._id) return null;
    return selectedChat.members.find((m) => m._id !== user._id)?._id ?? null;
  }, [selectedChat, user?._id]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedChat]);

  // ── Open chat ─────────────────────────────────────────────────────
  const handleSelect = useCallback(async (friend) => {
    try {
      const { data: chat } = await apiRequest.post('/api/chat', { receiverId: friend._id });
      setSelectedChat(chat);
      const { data: msgs } = await apiRequest.get(`/api/message/${chat._id}`);
      setMessages(msgs);
      // Clear unread badge locally
      setChatMeta((prev) => ({
        ...prev,
        [friend._id]: { ...(prev[friend._id] ?? {}), unreadCount: 0 },
      }));
      onChatSelect?.();
    } catch (err) {
      console.error('Failed to open chat:', err.message);
    }
  }, [setSelectedChat, setMessages, onChatSelect]);

  return (
    <>
      {/* Header */}
      <div className="sidebar-header">
        <h6>Chats</h6>
        <div className="sidebar-search">
          <Search size={15} className="sidebar-search-icon" />
          <input
            type="text"
            placeholder="Search…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search conversations"
          />
        </div>
      </div>

      {/* List */}
      <div className="sidebar-content">
        {loading ? (
          /* Skeleton */
          Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="loading-placeholder">
              <div className="loading-avatar" />
              <div className="loading-lines">
                <div className="loading-line" style={{ width: `${55 + (i % 3) * 15}%` }} />
                <div className="loading-line" style={{ width: `${35 + (i % 4) * 10}%` }} />
              </div>
            </div>
          ))
        ) : sortedFriends.length === 0 ? (
          <div className="empty-chat-state" style={{ padding: '48px 24px' }}>
            <div className="empty-chat-icon">
              {debQ ? '🔍' : '💬'}
            </div>
            <h6>{debQ ? 'No results' : 'No conversations yet'}</h6>
            <p>{debQ ? 'Try a different name' : 'Add friends to start chatting'}</p>
          </div>
        ) : (
          <ul className="chat-list">
            {sortedFriends.map((friend) => {
              const isSelected = friend._id === selectedFriendId;
              const online     = isOnline(friend._id);
              const meta       = chatMeta[friend._id] ?? {};
              const unread     = meta.unreadCount ?? 0;
              const preview    = meta.lastMessage || friend.currentcity || '';

              return (
                <li
                  key={friend._id}
                  ref={isSelected ? selectedRef : null}
                  className={`chat-list-item ${isSelected ? 'active' : ''}`}
                  onClick={() => handleSelect(friend)}
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelect(friend); }}
                  aria-current={isSelected ? 'true' : undefined}
                  role="button"
                >
                  {/* Avatar */}
                  <div className="chat-avatar">
                    {friend.profileImage
                      ? <img src={friend.profileImage} alt={friend.name} />
                      : <div className="chat-avatar-placeholder"
                             style={{ background: getColor(friend.name) }}>
                          {getInitials(friend.name)}
                        </div>
                    }
                    {online && <div className="online-dot" aria-label="Online" />}
                  </div>

                  {/* Info */}
                  <div className="chat-info">
                    <div className="chat-info-top">
                      <span className="chat-name">{friend.name}</span>
                      {meta.lastMessageTime && (
                        <span className="chat-time">{formatTime(meta.lastMessageTime)}</span>
                      )}
                    </div>
                    <div className="chat-info-bottom">
                      <span className={`chat-preview ${unread > 0 ? 'unread-preview' : ''}`}>
                        {preview}
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
    </>
  );
};

export default ChatList;