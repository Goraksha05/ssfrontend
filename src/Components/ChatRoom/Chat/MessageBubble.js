// src/Components/ChatRoom/Chat/MessageBubble.js
//
// Professional messenger bubble with:
//   • Bubble "tail" on first message of each group (WhatsApp-style)
//   • Avatar grouping — avatar only shown on last bubble of a group
//   • Read receipts — ✓ sending, ✓ sent, ✓✓ delivered, ✓✓ read (blue)
//   • Emoji reactions — hover reaction picker + rendered chips
//   • Right-click / long-press context menu (Reply, Copy, Delete for me, Delete for all)
//   • Working reply-to quoted preview with scroll-to-quoted-message
//   • Inline image lightbox (no Modal library dependency)
//   • Deleted message styled separately

import React, {
  useEffect, useRef, useState, useCallback, useContext, createContext,
} from 'react';
import { useAuth } from '../../../Context/Authorisation/AuthContext';
import { useChat } from '../../../Context/ChatContext';
import { getInitials } from '../../../utils/getInitials';
import moment from 'moment';
import apiRequest from '../../../utils/apiRequest';
import {
  Reply, 
  Copy, 
  Trash2, 
  X, 
  // ChevronDown,
  // Check, 
  // CheckCheck,
} from 'lucide-react';

// ── Context so MessageBubble can call parent's setReplyTo ────────
export const ReplyContext = createContext(null);

// ── Colour helpers ────────────────────────────────────────────────
const COLORS = ['#0ea5e9','#8b5cf6','#ec4899','#f59e0b','#10b981','#ef4444'];
const getColor = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
};

// ── Status tick component ─────────────────────────────────────────
const Tick = ({ status }) => {
  if (status === 'sending') {
    return (
      <span className="tick sent" title="Sending…">
        <svg viewBox="0 0 16 10" fill="currentColor">
          <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="tick sent" title="Sent">
        <svg viewBox="0 0 16 10" fill="currentColor">
          <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/>
        </svg>
      </span>
    );
  }
  if (status === 'delivered') {
    return (
      <span className="tick delivered" title="Delivered">
        <svg viewBox="0 0 22 10" fill="none">
          <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M7 5l4 4L21 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
    );
  }
  if (status === 'read') {
    return (
      <span className="tick read" title="Read">
        <svg viewBox="0 0 22 10" fill="none">
          <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          <path d="M7 5l4 4L21 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </span>
    );
  }
  return null;
};

// ── Quick emojis ─────────────────────────────────────────────────
const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];

// ── Context menu ──────────────────────────────────────────────────
const ContextMenu = ({ x, y, isMine, onReply, onCopy, onDeleteForMe, onDeleteForAll, onClose }) => {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Clamp to viewport
  const style = { top: y, left: x };
  if (x + 200 > window.innerWidth) style.left = window.innerWidth - 210;
  if (y + 200 > window.innerHeight) style.top = y - 200;

  return (
    <div className="msg-context-menu" ref={ref} style={style}>
      <button className="context-menu-item" onClick={onReply}>
        <Reply size={15} /> Reply
      </button>
      <button className="context-menu-item" onClick={onCopy}>
        <Copy size={15} /> Copy text
      </button>
      <div className="context-menu-divider" />
      <button className="context-menu-item danger" onClick={onDeleteForMe}>
        <Trash2 size={15} /> Delete for me
      </button>
      {isMine && (
        <button className="context-menu-item danger" onClick={onDeleteForAll}>
          <Trash2 size={15} /> Delete for everyone
        </button>
      )}
    </div>
  );
};

// ── Lightbox ──────────────────────────────────────────────────────
const Lightbox = ({ src, onClose }) => {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt="full size" onClick={(e) => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose} aria-label="Close">
        <X size={20} />
      </button>
    </div>
  );
};

// ── Main MessageBubble ────────────────────────────────────────────
const MessageBubble = ({ msg, prevMsg, nextMsg, recipientInfo }) => {
  const { user }        = useAuth();
  const { setMessages } = useChat();
  const setReplyTo      = useContext(ReplyContext);

  const isMine = user && msg?.sender?._id === user._id;

  // Grouping logic
  const sameAsPrev = prevMsg?.sender?._id === msg?.sender?._id
    && Math.abs(new Date(msg.createdAt) - new Date(prevMsg?.createdAt)) < 5 * 60_000;
  const sameAsNext = nextMsg?.sender?._id === msg?.sender?._id
    && Math.abs(new Date(nextMsg?.createdAt) - new Date(msg.createdAt)) < 5 * 60_000;

  const isFirstInGroup = !sameAsPrev; // show tail + avatar slot label
  const isLastInGroup  = !sameAsNext; // show avatar image

  const [showReactions, setShowReactions] = useState(false);
  const [reactions,     setReactions]     = useState(msg.reactions || []);
  const [lightbox,      setLightbox]      = useState(false);
  const [contextMenu,   setContextMenu]   = useState(null); // { x, y }
  const [deleting,      setDeleting]      = useState(false);

  const bubbleRef   = useRef(null);
  const pressTimer  = useRef(null);
  const hoverTimer  = useRef(null);

  // ── Reactions ───────────────────────────────────────────────────
  const handleReact = useCallback(async (emoji) => {
    setShowReactions(false);
    const existing = reactions.find((r) => r.userId === user._id && r.emoji === emoji);
    const next = existing
      ? reactions.filter((r) => !(r.userId === user._id && r.emoji === emoji))
      : [...reactions, { userId: user._id, emoji }];
    setReactions(next);
    try {
      await apiRequest.put(`/api/message/${msg._id}/react`, { emoji });
    } catch {
      setReactions(reactions); // revert
    }
  }, [reactions, msg._id, user._id]);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  // ── Delete ───────────────────────────────────────────────────────
  const handleDeleteForMe = useCallback(async () => {
    setDeleting(true);
    setContextMenu(null);
    try {
      await apiRequest.put(`/api/message/delete-for-me/${msg._id}`);
      setMessages((prev) => prev.filter((m) => m._id !== msg._id));
    } catch { setDeleting(false); }
  }, [msg._id, setMessages]);

  const handleDeleteForAll = useCallback(async () => {
    setDeleting(true);
    setContextMenu(null);
    try {
      await apiRequest.put(`/api/message/delete-everyone/${msg._id}`);
      setMessages((prev) =>
        prev.map((m) => m._id === msg._id
          ? { ...m, text: null, mediaUrl: null, isDeleted: true }
          : m)
      );
    } catch { setDeleting(false); }
  }, [msg._id, setMessages]);

  // ── Reply ────────────────────────────────────────────────────────
  const handleReply = useCallback(() => {
    setContextMenu(null);
    setReplyTo?.({
      _id:        msg._id,
      senderName: isMine ? 'You' : (msg.sender?.name ?? 'Unknown'),
      text:       msg.text || (msg.mediaUrl ? '📎 Media' : ''),
    });
  }, [msg, isMine, setReplyTo]);

  // ── Copy ─────────────────────────────────────────────────────────
  const handleCopy = useCallback(() => {
    setContextMenu(null);
    if (msg.text) navigator.clipboard?.writeText(msg.text);
  }, [msg.text]);

  // ── Context menu trigger ─────────────────────────────────────────
  const openContextMenu = useCallback((e) => {
    e.preventDefault();
    setShowReactions(false);
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Long press (mobile) ──────────────────────────────────────────
  const handleTouchStart = (e) => {
    pressTimer.current = setTimeout(() => {
      const t = e.touches[0];
      setContextMenu({ x: t.clientX, y: t.clientY });
    }, 600);
  };
  const handleTouchEnd = () => clearTimeout(pressTimer.current);

  // ── Hover → show reaction picker (desktop) ───────────────────────
  const handleMouseEnter = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setShowReactions(true), 500);
  };
  const handleMouseLeave = () => {
    clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setShowReactions(false), 300);
  };

  // ── Determine message status ─────────────────────────────────────
  const status = msg._sending
    ? 'sending'
    : msg.readBy?.length > 1
      ? 'read'
      : msg.deliveredTo?.length > 1
        ? 'delivered'
        : 'sent';

  // ── Avatar for received messages ─────────────────────────────────
  const avatarSrc = recipientInfo?.profileImage ?? null;
  const avatarName = recipientInfo?.name ?? msg.sender?.name ?? '?';

  // ── Deleted ──────────────────────────────────────────────────────
  if (msg.isDeleted) {
    return (
      <div className={`msg-group ${isMine ? 'sent' : 'received'}`}
           style={{ marginTop: isFirstInGroup ? 10 : 2 }}>
        <div className="msg-row" style={{ flexDirection: isMine ? 'row-reverse' : 'row' }}>
          {!isMine && <div style={{ width: 28, flexShrink: 0 }} />}
          <div className="bubble-wrap">
            <div className={`bubble deleted ${isMine ? 'sent' : 'received'}`}>
              🚫 This message was deleted
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className={`msg-group ${isMine ? 'sent' : 'received'} ${isFirstInGroup ? 'new-sender' : ''}`}
        style={{ marginTop: isFirstInGroup ? 8 : 2, opacity: deleting ? 0.4 : 1 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Reaction picker */}
        {showReactions && (
          <div className="reaction-picker">
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} className="react-btn" onClick={() => handleReact(emoji)}
                      title={`React with ${emoji}`} aria-label={`React with ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className={`msg-row ${isMine ? 'sent' : 'received'}`}>
          {/* Avatar col (received only) */}
          {!isMine && (
            <div className="msg-avatar-col">
              {isLastInGroup ? (
                avatarSrc
                  ? <img src={avatarSrc} alt={avatarName} />
                  : <div className="msg-avatar-mini" style={{ background: getColor(avatarName) }}>
                      {getInitials(avatarName)}
                    </div>
              ) : (
                <div style={{ width: 28 }} />
              )}
            </div>
          )}

          {/* Bubble */}
          <div className="bubble-wrap">
            {/* Sender name (first in group, received) */}
            {!isMine && isFirstInGroup && msg.sender?.name && (
              <div className="bubble-sender-name">{msg.sender.name}</div>
            )}

            <div
              ref={bubbleRef}
              className={[
                'bubble',
                isMine ? 'sent' : 'received',
                isLastInGroup ? 'tail' : 'follow',
              ].join(' ')}
              onContextMenu={openContextMenu}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {/* Reply quote */}
              {msg.replyTo && (
                <div className="reply-quote"
                     onClick={() => {
                       document.getElementById(`msg-${msg.replyTo._id}`)
                         ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                     }}>
                  <div className="reply-quote-name">{msg.replyTo.senderName}</div>
                  <div className="reply-quote-text">{msg.replyTo.text || '📎 Media'}</div>
                </div>
              )}

              {/* Text */}
              {msg.text && <div className="bubble-text">{msg.text}</div>}

              {/* Media */}
              {msg.mediaUrl && (
                <div className="bubble-media">
                  {msg.mediaType?.startsWith('video') ? (
                    <video src={msg.mediaUrl} controls />
                  ) : (
                    <img
                      src={msg.mediaUrl}
                      alt="media"
                      loading="lazy"
                      onClick={() => setLightbox(true)}
                    />
                  )}
                </div>
              )}

              {/* Meta: time + tick */}
              <div className="bubble-meta">
                <span className="bubble-time">{moment(msg.createdAt).format('h:mm A')}</span>
                {isMine && <Tick status={status} />}
              </div>
            </div>

            {/* Reactions */}
            {Object.keys(groupedReactions).length > 0 && (
              <div className="reactions">
                {Object.entries(groupedReactions).map(([emoji, count]) => (
                  <button
                    key={emoji}
                    className="reaction-chip"
                    onClick={() => handleReact(emoji)}
                    title={`${count} reaction${count > 1 ? 's' : ''}`}
                  >
                    {emoji}
                    {count > 1 && <span className="react-count">{count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Context menu (portal-like via fixed positioning) */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          isMine={isMine}
          onReply={handleReply}
          onCopy={handleCopy}
          onDeleteForMe={handleDeleteForMe}
          onDeleteForAll={handleDeleteForAll}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Lightbox */}
      {lightbox && <Lightbox src={msg.mediaUrl} onClose={() => setLightbox(false)} />}
    </>
  );
};

export default MessageBubble;