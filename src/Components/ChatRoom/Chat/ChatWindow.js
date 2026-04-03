// src/Components/ChatRoom/Chat/ChatWindow.js
//
// Changes for status feature:
//   • The recipient avatar in the chat header is now wrapped in
//     <ChatListStatusAvatar> — clicking it opens the recipient's
//     status stories exactly like WhatsApp.
//   • All other logic is unchanged.

import React, {
  useEffect, useRef, useMemo, useState, useCallback,
} from 'react';
import { ArrowLeft, Phone, Video, MoreVertical, ChevronDown } from 'lucide-react';
import { useAuth }              from '../../../Context/Authorisation/AuthContext';
import { useSocket }            from '../../../Context/SocketContext';
import { useChat }              from '../../../Context/ChatContext';
import { usePresence }          from '../../../hooks/usePresence';
import { onSocketEvent }        from '../../../WebSocket/WebSocketClient';
import apiRequest               from '../../../utils/apiRequest';
import MessageBubble, { ReplyContext } from './MessageBubble';
import { getInitials }          from '../../../utils/getInitials';
import ChatListStatusAvatar     from '../../Status/ChatListStatusAvatar';

const COLORS = ['#0ea5e9','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
const getColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

const formatLastSeen = (ts) => {
  if (!ts) return 'last seen recently';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'last seen just now';
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  return `last seen ${Math.floor(h / 24)}d ago`;
};

const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const dayLabel = (dateStr) => {
  const d    = new Date(dateStr);
  const now  = new Date();
  const diff = Math.floor((now - d) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7)   return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

const ChatWindow = ({ onBackToList, replyTo, setReplyTo }) => {
  const { user }      = useAuth();
  const { connected } = useSocket();
  const { selectedChat, messages, setMessages, isTyping, setIsTyping } = useChat();
  const { isOnline }  = usePresence();

  const messagesEndRef   = useRef(null);
  const messagesAreaRef  = useRef(null);
  const [showScrollBtn,  setShowScrollBtn]  = useState(false);
  const [newMsgCount,    setNewMsgCount]    = useState(0);
  const firstUnreadRef   = useRef(null);

  // ── Recipient ─────────────────────────────────────────────────────
  const chatMembers = useMemo(
    () => selectedChat?.members || selectedChat?.users || [],
    [selectedChat?.members, selectedChat?.users]
  );
  const recipient = useMemo(
    () => chatMembers.find((m) => m._id?.toString() !== user?._id?.toString() && m._id?.toString() !== user?.id?.toString()) ?? null,
    [chatMembers, user?._id, user?.id]
  );

  const [recipientProfile, setRecipientProfile] = useState(null);
  useEffect(() => {
    if (!recipient?._id) { setRecipientProfile(null); return; }
    apiRequest.get(`/api/profile/${recipient._id}`)
      .then((r) => r.data?.profile && setRecipientProfile(r.data.profile))
      .catch(() => {});
  }, [recipient?._id]);

  const recipientInfo = useMemo(() => ({
    ...recipient,
    profileImage:
      recipientProfile?.profileavatar?.URL ||
      recipient?.profileImage || recipient?.avatar || null,
    name:       recipient?.name       ?? 'Unknown',
    lastActive: recipient?.lastActive ?? null,
  }), [recipient, recipientProfile]);

  // ── Load messages ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedChat?._id) return;
    apiRequest.get(`/api/message/${selectedChat._id}`)
      .then((r) => { setMessages(r.data); firstUnreadRef.current = null; })
      .catch(() => {});
  }, [selectedChat?._id, setMessages]);

  // Mark read
  useEffect(() => {
    if (!selectedChat?._id) return;
    apiRequest.put(`/api/chat/mark-read/${selectedChat._id}`).catch(() => {});
  }, [selectedChat?._id]);

  // ── Smart scroll ──────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  useEffect(() => {
  const el = messagesAreaRef.current;
  if (!el) return;

  const handleScroll = () => {
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < 100;

    setShowScrollBtn(!nearBottom);

    if (nearBottom) {
      setNewMsgCount(0);
    }
  };

    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
  if (!messagesEndRef.current) return;

  messagesEndRef.current.scrollIntoView({
    behavior: 'smooth',
    block: 'end',
  });
  }, [messages]);

  useEffect(() => {
    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setNewMsgCount(0);
    } else {
      setNewMsgCount((c) => c + 1);
      setShowScrollBtn(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    setShowScrollBtn(!isNearBottom());
    if (isNearBottom()) setNewMsgCount(0);
  }, [isNearBottom]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
    setNewMsgCount(0);
  };

  // ── Socket listeners ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedChat?._id || !user?._id || !user?.id) return;
    let typingTimer = null;

    const offMsg = onSocketEvent('receive_message', ({ message }) => {
      if (message?.chatId !== selectedChat._id) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
    });

    const offTyping = onSocketEvent('user-typing', ({ fromUserId, chatId }) => {
      if (chatId !== selectedChat._id || fromUserId !== recipient?._id) return;
      setIsTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setIsTyping(false), 3_000);
    });

    const offStop = onSocketEvent('user-stop-typing', ({ fromUserId }) => {
      if (fromUserId === recipient?._id) { clearTimeout(typingTimer); setIsTyping(false); }
    });

    return () => { offMsg(); offTyping(); offStop(); clearTimeout(typingTimer); };
  }, [selectedChat?._id, recipient?._id, user?._id, user?.id, setMessages, setIsTyping]);

  // ── Deduped messages ──────────────────────────────────────────────
  const dedupedMessages = useMemo(
    () => Array.from(new Map(messages.map((m) => [m._id, m])).values()),
    [messages]
  );

  // ── Empty state ───────────────────────────────────────────────────
  if (!selectedChat || !user || chatMembers.length === 0) {
    return (
      <div className="empty-chat-state">
        <div className="empty-chat-icon">💬</div>
        <h6>Select a conversation</h6>
        <p>Choose a friend from the list to start chatting</p>
      </div>
    );
  }

  const recipientOnline = recipient?._id ? isOnline(recipient._id) : false;

  // ── Header status text ─────────────────────────────────────────────
  const statusText = !connected
    ? 'connecting…'
    : isTyping
      ? 'typing…'
      : recipientOnline
        ? 'online'
        : formatLastSeen(recipientInfo.lastActive);

  const statusClass = isTyping ? 'typing' : recipientOnline ? 'online' : '';

  return (
    <ReplyContext.Provider value={setReplyTo}>
      {/* Header */}
      <div className="flex items-center justify-between mt-5 px-4 h-[60px] bg-[var(--header-bg)] border-b border-[var(--border-color)] shadow-msg-xs flex-shrink-0 z-10">
        <div className="chat-header-left">
          <button className="chat-header-btn chat-back-btn" onClick={onBackToList} aria-label="Back">
            <ArrowLeft size={20} />
          </button>

          {/* ── Recipient avatar — shows status ring, opens viewer on click ── */}
          <div className="chat-header-avatar" style={{ position: 'relative' }}>
            <ChatListStatusAvatar
              userId={recipient?._id}
              name={recipientInfo.name}
              avatarUrl={recipientInfo.profileImage}
              currentUserId={user?._id || user?.id || null}
              size={10}
              fallbackRender={
                // Shown when no avatar URL — matches original placeholder style
                <div
                  className="chat-header-avatar-placeholder"
                  style={{ background: getColor(recipientInfo.name) }}
                >
                  {getInitials(recipientInfo.name)}
                </div>
              }
            />
            {recipientOnline && (
              <span
                className="header-online-dot"
                aria-label="Online"
                style={{ position: 'absolute', bottom: 1, right: 1, zIndex: 10 }}
              />
            )}
          </div>

          <div className="chat-header-info">
            <h6 className="chat-header-name">{recipientInfo.name}</h6>
            <p className={`chat-header-status ${statusClass}`}>{statusText}</p>
          </div>
        </div>

        <div className="chat-header-actions">
          <button className="chat-header-btn" title="Voice call" aria-label="Voice call">
            <Phone size={19} />
          </button>
          <button className="chat-header-btn" title="Video call" aria-label="Video call">
            <Video size={19} />
          </button>
          <button className="chat-header-btn" title="More options" aria-label="More options">
            <MoreVertical size={19} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div
        className="chat-messages"
        ref={messagesAreaRef}
        onScroll={handleScroll}
      >
        {dedupedMessages.map((msg, idx) => {
          const prev = dedupedMessages[idx - 1] ?? null;
          const next = dedupedMessages[idx + 1] ?? null;

          const showDateSep = idx === 0 || !isSameDay(msg.createdAt, prev?.createdAt);

          return (
            <React.Fragment key={msg._id}>
              {showDateSep && (
                <div className="date-separator">
                  <span className="date-separator-label">{dayLabel(msg.createdAt)}</span>
                </div>
              )}
              <div id={`msg-${msg._id}`}>
                <MessageBubble
                  msg={msg}
                  prevMsg={prev}
                  nextMsg={next}
                  recipientInfo={recipientInfo}
                />
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="typing-bubble">
            <div className="typing-dot" />
            <div className="typing-dot" />
            <div className="typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollBtn && (
        <button className="scroll-to-bottom" onClick={scrollToBottom} aria-label="Scroll to bottom">
          <ChevronDown size={20} />
          {newMsgCount > 0 && (
            <span className="unread-pip">{newMsgCount > 99 ? '99+' : newMsgCount}</span>
          )}
        </button>
      )}
    </ReplyContext.Provider>
  );
};

export default ChatWindow;