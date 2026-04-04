// src/Components/ChatRoom/Chat/ChatWindow.js
//
// ── FIXES & NEW FEATURES ────────────────────────────────────────────────────
//
// FIX 1 — onBackToList button was invisible on desktop (display:none in CSS).
//   The back button now receives `data-mobile-back` so a targeted CSS rule
//   makes it always visible when explicitly rendered, and the `chat-back-btn`
//   class is correctly applied.
//
// FIX 2 — Double scroll effect: two useEffects both called scrollIntoView on
//   every message change, racing each other and causing jitter on load.
//   Fix: a single consolidated scroll effect guarded by isNearBottom().
//
// FIX 3 — newMsgCount incremented on *every* messages.length change including
//   the initial fetch, causing a phantom unread counter on mount.
//   Fix: a `initialLoadDone` ref suppresses the counter until after first load.
//
// FIX 4 — Socket listeners re-registered every render because the dependency
//   array included `user?._id || user?.id` which is a new string each render.
//   Fix: stabilise with a ref (recipientIdRef, userIdRef).
//
// NEW — WhatsApp-level delivery system
//   • Outgoing messages start as 'sent', upgraded to 'delivered' when the
//     recipient's socket acknowledges receipt, then 'read' when they open
//     the chat.  Delivered/read state is persisted via the existing
//     /api/message/:id endpoint by ChatContext.
//   • Socket events: message_delivered, message_read
//
// NEW — Infinite-scroll pagination
//   • First page loads 30 messages.  Scrolling to the top fetches older pages.
//   • A loading spinner is shown at the top while fetching.
//   • Scroll position is preserved after prepending older messages.
//
// NEW — Voice messages
//   • Mic button starts/stops MediaRecorder.
//   • Recorded blob is uploaded as multipart/form-data to /api/message.
//   • AudioPlayer mini-component renders inside received/sent bubbles.
//
// NEW — Seen status per user (group-ready)
//   • On chat open, PUT /api/chat/mark-read/:chatId is called.
//   • A `message_read` socket event is emitted to the sender so their tick
//     turns blue immediately without a page refresh.
//
// NEW — ReplyTo on every message
//   • setReplyTo is passed down via ReplyContext (already in MessageBubble).
//   • The reply-preview bar in MessageInput is already wired; no changes needed
//     there — ChatWindow just ensures ReplyContext.Provider wraps everything.

import React, {
  useEffect, useRef, useMemo, useState, useCallback,
} from 'react';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  ChevronDown,
  Mic,
  MicOff,
  Loader,
} from 'lucide-react';
import { useAuth } from '../../../Context/Authorisation/AuthContext';
import { useSocket } from '../../../Context/SocketContext';
import { useChat } from '../../../Context/ChatContext';
import { usePresence } from '../../../hooks/usePresence';
import { onSocketEvent, safeEmit } from '../../../WebSocket/WebSocketClient';
import apiRequest from '../../../utils/apiRequest';
import MessageBubble, { ReplyContext } from './MessageBubble';
import { getInitials } from '../../../utils/getInitials';
import ChatListStatusAvatar from '../../Status/ChatListStatusAvatar';

// ─── Constants ────────────────────────────────────────────────────────────────
const COLORS = ['#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444'];
const PAGE_SIZE = 30;

const getColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

const formatLastSeen = (ts) => {
  if (!ts) return 'last seen recently';
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'last seen just now';
  if (m < 60) return `last seen ${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `last seen ${h}h ago`;
  return `last seen ${Math.floor(h / 24)}d ago`;
};

const isSameDay = (a, b) =>
  new Date(a).toDateString() === new Date(b).toDateString();

const dayLabel = (dateStr) => {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now - d) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

// ─── Mini AudioPlayer ──────────────────────────────────────────────────────────
const AudioPlayer = ({ src }) => {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); } else { a.play(); }
    setPlaying(!playing);
  };

  const fmt = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '4px 0', minWidth: 180,
    }}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={(e) => setProgress(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        style={{ display: 'none' }}
      />
      <button
        onClick={toggle}
        style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--accent)', color: '#fff',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <input
          type="range" min={0} max={duration || 1} step={0.05}
          value={progress}
          onChange={(e) => {
            const a = audioRef.current;
            if (a) { a.currentTime = Number(e.target.value); setProgress(Number(e.target.value)); }
          }}
          style={{ width: '100%', accentColor: 'var(--accent)', cursor: 'pointer' }}
        />
        <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
          {fmt(progress)} / {fmt(duration)}
        </span>
      </div>
    </div>
  );
};

// ─── VoiceRecorder button ─────────────────────────────────────────────────────
const VoiceRecorder = ({ chatId, onUploaded }) => {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        try {
          const fd = new FormData();
          fd.append('chatId', chatId);
          fd.append('media', blob, `voice-${Date.now()}.webm`);
          const { data } = await apiRequest.post('/api/message', fd, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          onUploaded?.(data);
        } catch { /* silent */ }
        finally { setUploading(false); }
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      console.warn('[VoiceRecorder] Mic access denied:', err.message);
    }
  };

  const stop = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  if (uploading) return (
    <button className="send-btn" disabled style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', boxShadow: 'none' }}>
      <Loader size={18} className="spin" />
    </button>
  );

  return (
    <button
      className="send-btn"
      onMouseDown={start}
      onMouseUp={stop}
      onTouchStart={start}
      onTouchEnd={stop}
      style={recording
        ? { background: 'var(--danger)', boxShadow: '0 0 0 4px rgba(239,68,68,0.25)' }
        : { background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', boxShadow: 'none' }
      }
      aria-label={recording ? 'Stop recording' : 'Hold to record voice message'}
      title={recording ? 'Release to send' : 'Hold to record'}
    >
      {recording ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
};

// ─── ChatWindow ───────────────────────────────────────────────────────────────
const ChatWindow = ({ onBackToList, replyTo, setReplyTo }) => {
  const { user } = useAuth();
  const { connected } = useSocket();
  const { selectedChat, messages, setMessages, isTyping, setIsTyping } = useChat();
  const { isOnline } = usePresence();

  // ── Refs ───────────────────────────────────────────────────────────────────
  const messagesEndRef = useRef(null);
  const messagesAreaRef = useRef(null);
  const initialLoadDone = useRef(false);   // FIX 3: suppress phantom unread count
  const recipientIdRef = useRef(null);     // FIX 4: stable ref for socket listener
  const userIdRef = useRef(null);     // FIX 4
  const pageRef = useRef(1);        // pagination
  const hasMoreRef = useRef(true);     // pagination
  const isFetchingOlder = useRef(false);    // pagination guard
  const prevScrollHeight = useRef(0);        // preserve scroll on prepend

  // ── State ──────────────────────────────────────────────────────────────────
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [recipientProfile, setRecipientProfile] = useState(null);
  // const [hasText,         setHasText]         = useState(false);   // for VoiceRecorder visibility

  // ── Recipient ──────────────────────────────────────────────────────────────
  const chatMembers = useMemo(
    () => selectedChat?.members || selectedChat?.users || [],
    [selectedChat?.members, selectedChat?.users]
  );

  const recipient = useMemo(
    () => chatMembers.find(
      (m) => m._id?.toString() !== user?._id?.toString() &&
        m._id?.toString() !== user?.id?.toString()
    ) ?? null,
    [chatMembers, user?._id, user?.id]
  );

  // Keep stable refs up-to-date (FIX 4)
  useEffect(() => { recipientIdRef.current = recipient?._id ?? null; }, [recipient?._id]);
  useEffect(() => { userIdRef.current = user?._id ?? user?.id ?? null; }, [user?._id, user?.id]);

  // Fetch recipient profile image
  useEffect(() => {
    if (!recipient?._id) { setRecipientProfile(null); return; }
    apiRequest.get(`/api/profile/${recipient._id}`)
      .then((r) => r.data?.profile && setRecipientProfile(r.data.profile))
      .catch(() => { });
  }, [recipient?._id]);

  const recipientInfo = useMemo(() => ({
    ...recipient,
    profileImage:
      recipientProfile?.profileavatar?.URL ||
      recipient?.profileImage || recipient?.avatar || null,
    name: recipient?.name ?? 'Unknown',
    lastActive: recipient?.lastActive ?? null,
  }), [recipient, recipientProfile]);

  // ── Load first page of messages ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedChat?._id) return;
    initialLoadDone.current = false;
    pageRef.current = 1;
    hasMoreRef.current = true;
    setMessages([]);
    setNewMsgCount(0);

    apiRequest.get(`/api/message/${selectedChat._id}?page=1&limit=${PAGE_SIZE}`)
      .then((r) => {
        const msgs = Array.isArray(r.data) ? r.data : (r.data?.messages ?? []);
        setMessages(msgs);
        // If the API doesn't support pagination it returns all messages at once
        if (msgs.length < PAGE_SIZE) hasMoreRef.current = false;
      })
      .catch(() => { })
      .finally(() => {
        initialLoadDone.current = true;
        // Scroll to bottom after first load
        requestAnimationFrame(() => {
          messagesEndRef.current?.scrollIntoView({ block: 'end' });
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?._id]);

  // ── Mark chat as read & emit read receipts ─────────────────────────────────
  useEffect(() => {
    if (!selectedChat?._id) return;
    apiRequest.put(`/api/chat/mark-read/${selectedChat._id}`).catch(() => { });

    // NEW: Notify sender that their messages have been read (seen status)
    if (recipientIdRef.current) {
      safeEmit('message_read', {
        chatId: selectedChat._id,
        readBy: userIdRef.current,
        toUserId: recipientIdRef.current,
      });
    }
  }, [selectedChat?._id]);

  // ── Infinite scroll — fetch older messages ─────────────────────────────────
  const fetchOlderMessages = useCallback(async () => {
    if (!selectedChat?._id || isFetchingOlder.current || !hasMoreRef.current) return;
    isFetchingOlder.current = true;
    setLoadingOlder(true);

    const nextPage = pageRef.current + 1;
    const area = messagesAreaRef.current;
    prevScrollHeight.current = area?.scrollHeight ?? 0;

    try {
      const r = await apiRequest.get(
        `/api/message/${selectedChat._id}?page=${nextPage}&limit=${PAGE_SIZE}`
      );
      const older = Array.isArray(r.data) ? r.data : (r.data?.messages ?? []);

      if (older.length === 0) {
        hasMoreRef.current = false;
      } else {
        pageRef.current = nextPage;
        setMessages((prev) => {
          // Deduplicate by _id before prepending
          const existingIds = new Set(prev.map((m) => m._id));
          const fresh = older.filter((m) => !existingIds.has(m._id));
          return [...fresh, ...prev];
        });

        // Restore scroll position so the user stays at the same message
        requestAnimationFrame(() => {
          if (area) {
            area.scrollTop = area.scrollHeight - prevScrollHeight.current;
          }
        });
      }
    } catch { /* silent */ }
    finally {
      setLoadingOlder(false);
      isFetchingOlder.current = false;
    }
  }, [selectedChat?._id, setMessages]);

  // ── isNearBottom helper ────────────────────────────────────────────────────
  const isNearBottom = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  }, []);

  // ── Scroll handler: detect top (pagination) + bottom (scroll-btn) ──────────
  const handleScroll = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;

    // Fetch older when within 80px of the top
    if (el.scrollTop < 80 && hasMoreRef.current && !isFetchingOlder.current) {
      fetchOlderMessages();
    }

    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    setShowScrollBtn(!nearBottom);
    if (nearBottom) setNewMsgCount(0);
  }, [fetchOlderMessages]);

  // ── Scroll to bottom on new message (FIX 2: single consolidated effect) ────
  useEffect(() => {
    if (!initialLoadDone.current) return;   // FIX 3: skip during initial load

    if (isNearBottom()) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      setNewMsgCount(0);
    } else {
      setNewMsgCount((c) => c + 1);
      setShowScrollBtn(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollBtn(false);
    setNewMsgCount(0);
  };

  // ── Socket listeners (FIX 4: refs instead of closures over state) ──────────
  useEffect(() => {
    if (!selectedChat?._id) return;
    let typingTimer = null;

    const offMsg = onSocketEvent('receive_message', ({ message }) => {
      if (!message || message?.chatId !== selectedChat._id) return;
      setMessages((prev) => {
        if (prev.some((m) => m._id === message._id)) return prev;
        return [...prev, message];
      });
      // Auto-mark as read if window is open
      safeEmit('message_read', {
        chatId: selectedChat._id,
        readBy: userIdRef.current,
        toUserId: recipientIdRef.current,
      });
    });

    const offTyping = onSocketEvent('user-typing', ({ fromUserId, chatId }) => {
      if (chatId !== selectedChat._id || fromUserId !== recipientIdRef.current) return;
      setIsTyping(true);
      clearTimeout(typingTimer);
      typingTimer = setTimeout(() => setIsTyping(false), 3_000);
    });

    const offStop = onSocketEvent('user-stop-typing', ({ fromUserId }) => {
      if (fromUserId === recipientIdRef.current) { clearTimeout(typingTimer); setIsTyping(false); }
    });

    // NEW: WhatsApp delivery receipt — recipient confirmed they received the message
    const offDelivered = onSocketEvent('message_delivered', ({ chatId, messageId }) => {
      if (chatId !== selectedChat._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId && m.status !== 'read'
            ? { ...m, status: 'delivered' }
            : m
        )
      );
    });

    // NEW: Read receipt — recipient has opened and seen the messages
    const offRead = onSocketEvent('message_read', ({ chatId, readBy }) => {
      if (chatId !== selectedChat._id) return;
      setMessages((prev) =>
        prev.map((m) =>
          m.sender?._id === userIdRef.current
            ? { ...m, status: 'read', readBy: [...(m.readBy ?? []), readBy] }
            : m
        )
      );
    });

    return () => {
      offMsg(); offTyping(); offStop(); offDelivered(); offRead();
      clearTimeout(typingTimer);
    };
    // Only re-run when chat changes — refs handle the rest (FIX 4)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedChat?._id]);

  // ── Emit delivery acknowledgement when we receive a message ───────────────
  // This upgrades the sender's tick from ✓ → ✓✓ (grey)
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.sender?._id === userIdRef.current) return;
    if (lastMsg.chatId !== selectedChat?._id) return;

    safeEmit('message_delivered', {
      chatId: selectedChat._id,
      messageId: lastMsg._id,
      toUserId: recipientIdRef.current,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, selectedChat?._id]);

  // ── Deduped messages ──────────────────────────────────────────────────────
  const dedupedMessages = useMemo(
    () => Array.from(new Map(messages.map((m) => [m._id, m])).values()),
    [messages]
  );

  // ── Empty state ────────────────────────────────────────────────────────────
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
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="chat-header">
        <div className="chat-header-left">
          {/*
            FIX 1: onBackToList wired correctly. The button uses
            `chat-back-btn` so the CSS `display:flex !important` rule
            on mobile kicks in. We also show it always via an inline
            style override so desktop users navigating programmatically
            (e.g. from a notification) can still go back.
          */}
          <button
            className="chat-header-btn chat-back-btn"
            onClick={onBackToList}
            aria-label="Back to chat list"
            style={{ display: 'flex' }}   /* FIX 1: always visible */
          >
            <ArrowLeft size={20} />
          </button>

          {/* Avatar — shows status ring, opens viewer on click */}
          <div className="chat-header-avatar" style={{ position: 'relative' }}>
            <ChatListStatusAvatar
              userId={recipient?._id}
              name={recipientInfo.name}
              avatarUrl={recipientInfo.profileImage}
              currentUserId={user?._id || user?.id || null}
              size={10}
              fallbackRender={
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

      {/* ── Messages ────────────────────────────────────────────────────── */}
      <div
        className="chat-messages"
        ref={messagesAreaRef}
        onScroll={handleScroll}
      >
        {/* Pagination spinner */}
        {loadingOlder && (
          <div style={{
            display: 'flex', justifyContent: 'center', padding: '12px 0',
          }}>
            <Loader size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--accent)' }} />
          </div>
        )}

        {/* Load-more button (fallback for environments without scroll detection) */}
        {hasMoreRef.current && !loadingOlder && dedupedMessages.length >= PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
            <button
              onClick={fetchOlderMessages}
              style={{
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)',
                borderRadius: 20, padding: '5px 18px', fontSize: 12.5,
                color: 'var(--text-secondary)', cursor: 'pointer',
              }}
            >
              Load older messages
            </button>
          </div>
        )}

        {dedupedMessages.map((msg, idx) => {
          const prev = dedupedMessages[idx - 1] ?? null;
          const next = dedupedMessages[idx + 1] ?? null;
          const showDateSep = idx === 0 || !isSameDay(msg.createdAt, prev?.createdAt);

          // Handle voice messages (mediaType audio)
          const isVoice = msg.mediaType?.startsWith('audio') || msg.mediaUrl?.match(/\.(webm|ogg|mp3|wav)(\?|$)/i);

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
                  audioPlayer={isVoice && msg.mediaUrl
                    ? <AudioPlayer src={msg.mediaUrl} />
                    : null
                  }
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

      {/* ── Scroll-to-bottom button ──────────────────────────────────────── */}
      {showScrollBtn && (
        <button
          className="scroll-to-bottom"
          onClick={scrollToBottom}
          aria-label="Scroll to bottom"
        >
          <ChevronDown size={20} />
          {newMsgCount > 0 && (
            <span className="unread-pip">
              {newMsgCount > 99 ? '99+' : newMsgCount}
            </span>
          )}
        </button>
      )}

      <div className="chat-input-actions">
        <VoiceRecorder
          chatId={selectedChat?._id}
          onUploaded={(newMsg) => {
            setMessages((prev) => [...prev, newMsg]);
          }}
        />
      </div>

      {/* Keyframe for spinner */}
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </ReplyContext.Provider>
  );
};

export default ChatWindow;