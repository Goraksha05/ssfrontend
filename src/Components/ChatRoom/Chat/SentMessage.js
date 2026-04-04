// src/Components/ChatRoom/Chat/SentMessage.js
//
// FIXED: All hooks (useState, useRef, useCallback) are now declared
// unconditionally BEFORE any early return — satisfies Rules of Hooks.

import React, {
  useEffect, useRef, useState, useCallback, useContext,
} from 'react';
import { Reply, Copy, Trash2, X } from 'lucide-react';
import moment from 'moment';
import { useChat }     from '../../../Context/ChatContext';
import apiRequest      from '../../../utils/apiRequest';
import { ReplyContext } from './MessageBubble';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const QUICK_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🙏'];
const safeReactions = (val) => (Array.isArray(val) ? val : []);

// ─── Tick ─────────────────────────────────────────────────────────────────────
const Tick = ({ status }) => {
  const base = { display: 'inline-flex', alignItems: 'center', marginLeft: 3 };
  if (status === 'sending' || status === 'sent') return (
    <span className={`tick ${status === 'sending' ? 'sent' : 'sent'}`}
      title={status === 'sending' ? 'Sending…' : 'Sent'} style={base}>
      <svg width="14" height="10" viewBox="0 0 16 10" fill="none">
        <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
  if (status === 'delivered') return (
    <span className="tick delivered" title="Delivered" style={base}>
      <svg width="20" height="10" viewBox="0 0 22 10" fill="none">
        <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 5l4 4L21 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
  if (status === 'read') return (
    <span className="tick read" title="Read" style={base}>
      <svg width="20" height="10" viewBox="0 0 22 10" fill="none">
        <path d="M1 5l4 4L15 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M7 5l4 4L21 1" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </span>
  );
  return null;
};

// ─── AudioPlayer ──────────────────────────────────────────────────────────────
const AudioPlayer = ({ src }) => {
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef(null);
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2,'0')}`;
  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    playing ? a.pause() : a.play();
    setPlaying((p) => !p);
  };
  return (
    <div className="sent-audio-player">
      <audio ref={audioRef} src={src}
        onTimeUpdate={(e) => setProgress(e.target.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.target.duration)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        style={{ display: 'none' }}
      />
      <button className="audio-play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '⏸' : '▶'}
      </button>
      <div className="audio-track">
        <input type="range" min={0} max={duration || 1} step={0.05} value={progress}
          onChange={(e) => {
            const a = audioRef.current;
            if (a) { a.currentTime = +e.target.value; setProgress(+e.target.value); }
          }}
        />
        <span className="audio-time">{fmt(progress)} / {fmt(duration)}</span>
      </div>
    </div>
  );
};

// ─── Lightbox ─────────────────────────────────────────────────────────────────
const Lightbox = ({ src, onClose }) => {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={src} alt="full size" onClick={(e) => e.stopPropagation()} />
      <button className="lightbox-close" onClick={onClose} aria-label="Close"><X size={20} /></button>
    </div>
  );
};

// ─── ContextMenu ──────────────────────────────────────────────────────────────
const ContextMenu = ({ x, y, onReply, onCopy, onDeleteForMe, onDeleteForAll, onClose }) => {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    setTimeout(() => document.addEventListener('mousedown', h), 0);
    return () => document.removeEventListener('mousedown', h);
  }, [onClose]);
  const style = { top: y, left: x };
  if (x + 200 > window.innerWidth)  style.left = window.innerWidth - 210;
  if (y + 200 > window.innerHeight) style.top  = y - 200;
  return (
    <div className="msg-context-menu" ref={ref} style={style}>
      <button className="context-menu-item" onClick={onReply}><Reply size={15}/> Reply</button>
      <button className="context-menu-item" onClick={onCopy}><Copy  size={15}/> Copy text</button>
      <div className="context-menu-divider"/>
      <button className="context-menu-item danger" onClick={onDeleteForMe}><Trash2 size={15}/> Delete for me</button>
      <button className="context-menu-item danger" onClick={onDeleteForAll}><Trash2 size={15}/> Delete for everyone</button>
    </div>
  );
};

// ─── SentMessage ──────────────────────────────────────────────────────────────
const SentMessage = ({ msg, isFirstInGroup, isLastInGroup }) => {
  const { setMessages } = useChat();
  const setReplyTo      = useContext(ReplyContext);

  // ── ALL hooks unconditionally first — no early returns before this block ──

  const [showReactions, setShowReactions] = useState(false);
  const [reactions,     setReactions]     = useState(() => safeReactions(msg?.reactions));
  const [lightbox,      setLightbox]      = useState(false);
  const [contextMenu,   setContextMenu]   = useState(null);
  const [deleting,      setDeleting]      = useState(false);

  const hoverTimer = useRef(null);
  const pressTimer = useRef(null);

  // All useCallbacks — unconditional, use msg?. safe access throughout
  const handleReact = useCallback(async (emoji) => {
    setShowReactions(false);
    const senderId = msg?.sender?._id;
    const prev     = reactions;
    const exists   = reactions.find((r) => r?.userId === senderId && r?.emoji === emoji);
    const next     = exists
      ? reactions.filter((r) => !(r?.userId === senderId && r?.emoji === emoji))
      : [...reactions, { userId: senderId, emoji }];
    setReactions(next);
    try   { await apiRequest.put(`/api/message/${msg?._id}/react`, { emoji }); }
    catch { setReactions(prev); }
  }, [reactions, msg?._id, msg?.sender?._id]);

  const handleDeleteForMe = useCallback(async () => {
    setDeleting(true);
    setContextMenu(null);
    try {
      await apiRequest.put(`/api/message/delete-for-me/${msg?._id}`);
      setMessages((prev) => prev.filter((m) => m._id !== msg?._id));
    } catch { setDeleting(false); }
  }, [msg?._id, setMessages]);

  const handleDeleteForAll = useCallback(async () => {
    setDeleting(true);
    setContextMenu(null);
    try {
      await apiRequest.put(`/api/message/delete-everyone/${msg?._id}`);
      setMessages((prev) =>
        prev.map((m) => m._id === msg?._id
          ? { ...m, text: null, mediaUrl: null, isDeleted: true }
          : m)
      );
    } catch { setDeleting(false); }
  }, [msg?._id, setMessages]);

  const handleReply = useCallback(() => {
    setContextMenu(null);
    setReplyTo?.({
      _id:        msg?._id,
      senderName: 'You',
      text:       msg?.text || (msg?.mediaUrl ? '📎 Media' : ''),
    });
  }, [msg, setReplyTo]);

  const handleCopy = useCallback(() => {
    setContextMenu(null);
    if (msg?.text) navigator.clipboard?.writeText(msg.text);
  }, [msg?.text]);

  // ── Early return AFTER all hooks ──────────────────────────────────
  if (!msg) return null;

  // ── Derived values (msg guaranteed non-null from here) ────────────
  const status = msg._sending
    ? 'sending'
    : msg.status === 'read'                   ? 'read'
    : msg.status === 'delivered'              ? 'delivered'
    : (msg.readBy?.length ?? 0) > 1          ? 'read'
    : (msg.deliveredTo?.length ?? 0) > 1     ? 'delivered'
    : 'sent';

  const isVoice = msg.mediaType?.startsWith('audio') ||
                  /\.(webm|ogg|mp3|wav)(\?|$)/i.test(msg.mediaUrl ?? '');

  const grouped = reactions.reduce((acc, r) => {
    if (r?.emoji) acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  // ── Non-hook handlers (plain functions, safe after null check) ────
  const openContextMenu  = (e) => { e.preventDefault(); setShowReactions(false); setContextMenu({ x: e.clientX, y: e.clientY }); };
  const handleTouchStart = (e) => { pressTimer.current = setTimeout(() => { const t = e.touches[0]; setContextMenu({ x: t.clientX, y: t.clientY }); }, 600); };
  const handleTouchEnd   = ()  => clearTimeout(pressTimer.current);
  const handleMouseEnter = ()  => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setShowReactions(true),  500); };
  const handleMouseLeave = ()  => { clearTimeout(hoverTimer.current); hoverTimer.current = setTimeout(() => setShowReactions(false), 300); };

  // ── Deleted tombstone ─────────────────────────────────────────────
  if (msg.isDeleted) {
    return (
      <div className="msg-group sent" style={{ marginTop: isFirstInGroup ? 10 : 2 }}>
        <div className="msg-row sent">
          <div className="bubble-wrap">
            <div className="bubble sent deleted">🚫 This message was deleted</div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <>
      <div
        className={`msg-group sent${isFirstInGroup ? ' new-sender' : ''}`}
        style={{ marginTop: isFirstInGroup ? 8 : 2, opacity: deleting ? 0.4 : 1 }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {showReactions && (
          <div className="reaction-picker" style={{ right: 0 }}>
            {QUICK_EMOJIS.map((emoji) => (
              <button key={emoji} className="react-btn"
                onClick={() => handleReact(emoji)} aria-label={`React ${emoji}`}>
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div className="msg-row sent">
          <div className="bubble-wrap" style={{ alignItems: 'flex-end' }}>

            {msg.replyTo && (
              <div className="reply-quote"
                onClick={() => document.getElementById(`msg-${msg.replyTo._id}`)
                  ?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
                <div className="reply-quote-name">{msg.replyTo.senderName ?? 'You'}</div>
                <div className="reply-quote-text">{msg.replyTo.text || '📎 Media'}</div>
              </div>
            )}

            <div
              className={`bubble sent${isLastInGroup ? ' tail' : ' follow'}`}
              onContextMenu={openContextMenu}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {msg.text && <div className="bubble-text">{msg.text}</div>}
              {isVoice && msg.mediaUrl && <AudioPlayer src={msg.mediaUrl} />}
              {!isVoice && msg.mediaUrl && (
                <div className="bubble-media">
                  {msg.mediaType?.startsWith('video')
                    ? <video src={msg.mediaUrl} controls />
                    : <img src={msg.mediaUrl} alt="media" loading="lazy"
                        onClick={() => setLightbox(true)} />
                  }
                </div>
              )}
              {msg._failed && (
                <div style={{ fontSize: 11, color: '#ef4444', marginTop: 3 }}>⚠ Failed to send</div>
              )}
              <div className="bubble-meta">
                <span className="bubble-time">{moment(msg.createdAt).format('h:mm A')}</span>
                <Tick status={status} />
              </div>
            </div>

            {Object.keys(grouped).length > 0 && (
              <div className="reactions" style={{ justifyContent: 'flex-end' }}>
                {Object.entries(grouped).map(([emoji, count]) => (
                  <button key={emoji} className="reaction-chip"
                    onClick={() => handleReact(emoji)}
                    title={`${count} reaction${count > 1 ? 's' : ''}`}>
                    {emoji}{count > 1 && <span className="react-count">{count}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          onReply={handleReply} onCopy={handleCopy}
          onDeleteForMe={handleDeleteForMe} onDeleteForAll={handleDeleteForAll}
          onClose={() => setContextMenu(null)}
        />
      )}
      {lightbox && <Lightbox src={msg.mediaUrl} onClose={() => setLightbox(false)} />}
    </>
  );
};

export default SentMessage;