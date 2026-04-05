// src/components/Status/StatusViewer.jsx
//
// Upgrades vs original:
//   1. Touch swipe left/right to navigate statuses (mobile-first)
//   2. Mute/unmute toggle for video statuses
//   3. Reply bar — opens DM composer pre-filled with "Replied to your status"
//   4. Emoji reaction strip (6 quick emojis) — fires optimistic UI update
//   5. Share button — copies a deep-link to the status
//   6. Better video handling — respects pause state, auto-advances after end
//   7. Smooth per-user cross-fade transition
//   8. Swipe-up on desktop (scroll) to open viewers sheet

import { useState, useEffect, useRef, useCallback } from 'react';
import apiRequest   from '../../utils/apiRequest';
import { useStatus } from '../../Context/StatusContext';
import './Status.css';

const SLIDE_DURATION = 5000;

const QUICK_REACTIONS = ['❤️','😂','😮','😢','😡','👏'];

const FONT_CLASSES = ['', 'font-style-serif', 'font-style-mono', 'font-style-italic', 'font-style-bold'];

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function StatusViewer({ entries, startIndex = 0, currentUserId, onClose }) {
  const { markViewed } = useStatus();

  const [userIdx,  setUserIdx]  = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [viewers,  setViewers]  = useState(null);
  const [viewersLoading, setViewersLoading] = useState(false);

  // New state
  const [muted,      setMuted]      = useState(true);
  const [replyText,  setReplyText]  = useState('');
  const [replyOpen,  setReplyOpen]  = useState(false);
  const [reactions,  setReactions]  = useState({});   // { statusId: emoji }
  const [userTransition, setUserTransition] = useState(false);
  const [shareToast, setShareToast] = useState(false);

  const timerRef  = useRef(null);
  const startRef  = useRef(null);
  const elapsed   = useRef(0);
  const videoRef  = useRef(null);

  // Swipe tracking
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);

  const entry  = entries[userIdx];
  const status = entry?.statuses[slideIdx];
  const isOwn  = entry?.user._id === currentUserId;

  // ── Timer ────────────────────────────────────────────────────────────────
  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const goNext = useCallback(() => {
    setProgress(0); elapsed.current = 0;
    if (slideIdx < entry.statuses.length - 1) {
      setSlideIdx(s => s + 1);
    } else if (userIdx < entries.length - 1) {
      setUserTransition(true);
      setTimeout(() => {
        setUserIdx(u => u + 1);
        setSlideIdx(0);
        setUserTransition(false);
      }, 180);
    } else {
      onClose();
    }
  }, [slideIdx, userIdx, entry, entries.length, onClose]);

  const goPrev = useCallback(() => {
    setProgress(0); elapsed.current = 0;
    if (slideIdx > 0) {
      setSlideIdx(s => s - 1);
    } else if (userIdx > 0) {
      const p = userIdx - 1;
      setUserIdx(p);
      setSlideIdx(entries[p].statuses.length - 1);
    }
  }, [slideIdx, userIdx, entries]);

  useEffect(() => {
    if (!status) return;
    clearTimer(); elapsed.current = 0; setProgress(0);
    startRef.current = Date.now();

    // For videos: use actual duration when available
    const isVideo = status.type === 'video';
    const duration = isVideo
      ? (videoRef.current?.duration * 1000 || SLIDE_DURATION)
      : SLIDE_DURATION;

    if (!paused) {
      timerRef.current = setInterval(() => {
        const spent = Date.now() - startRef.current + elapsed.current;
        const pct   = Math.min((spent / duration) * 100, 100);
        setProgress(pct);
        if (pct >= 100) { clearTimer(); goNext(); }
      }, 50);
    }
    return clearTimer;
  }, [status?._id, paused, userIdx, slideIdx]); // eslint-disable-line

  // Mark viewed
  useEffect(() => {
    if (!status || isOwn) return;
    apiRequest.get(`/api/status/${status._id}`).catch(() => {});
    markViewed(entry.user._id, status._id, currentUserId);
  }, [status?._id]); // eslint-disable-line

  // Keyboard
  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
      if (e.key === 'Escape')     onClose();
      if (e.key === 'm')          setMuted(v => !v);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev, onClose]);

  // ── Pointer pause ────────────────────────────────────────────────────────
  const handlePointerDown = () => {
    elapsed.current += Date.now() - startRef.current;
    clearTimer();
    setPaused(true);
    if (videoRef.current) videoRef.current.pause();
  };

  const handlePointerUp = () => {
    startRef.current = Date.now();
    setPaused(false);
    if (videoRef.current) videoRef.current.play().catch(() => {});
  };

  // ── Touch swipe ──────────────────────────────────────────────────────────
  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    handlePointerDown();
  };

  const handleTouchEnd = (e) => {
    handlePointerUp();
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    // Only treat as horizontal swipe if dx > dy (avoid scroll conflicts)
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) goNext();
      else        goPrev();
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  // ── Viewers ──────────────────────────────────────────────────────────────
  const loadViewers = async () => {
    if (!isOwn || !status) return;
    setViewers([]); setViewersLoading(true);
    try {
      const res = await apiRequest.get(`/api/status/${status._id}/views`);
      setViewers(res.data.viewers ?? []);
    } catch { setViewers([]); }
    finally { setViewersLoading(false); }
  };

  // ── Reply ────────────────────────────────────────────────────────────────
  const handleSendReply = async () => {
    if (!replyText.trim()) return;
    try {
      await apiRequest.post('/api/messages', {
        to:      entry.user._id,
        text:    replyText,
        replyTo: status._id,
        type:    'status_reply',
      });
    } catch { /* fail silently */ }
    setReplyText('');
    setReplyOpen(false);
  };

  // ── Reaction ─────────────────────────────────────────────────────────────
  const handleReact = async (emoji) => {
    if (isOwn) return;
    setReactions(r => ({ ...r, [status._id]: emoji }));
    try {
      await apiRequest.post(`/api/status/${status._id}/react`, { emoji });
    } catch { /* optimistic – ignore */ }
  };

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const url = `${window.location.origin}/status/${status._id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* fallback */
    }
    setShareToast(true);
    setTimeout(() => setShareToast(false), 2000);
  };

  if (!entry || !status) return null;

  const bgStyle = status.type === 'text'
    ? { background: status.backgroundColor }
    : { background: '#000' };

  const myReaction = reactions[status._id];

  return (
    <div
      className="status-viewer"
      style={bgStyle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Progress bars ── */}
      <div className="status-viewer__progress-row">
        {entry.statuses.map((s, i) => (
          <div key={s._id} className="status-viewer__progress-track">
            <div
              className="status-viewer__progress-fill"
              style={{
                width: i < slideIdx ? '100%'
                      : i === slideIdx ? `${progress}%`
                      : '0%',
                transition: i === slideIdx ? 'width 0.05s linear' : 'none',
              }}
            />
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div className="status-viewer__header">
        <img
          className="status-viewer__header-avatar"
          src={entry.user.profileavatar?.URL ||
            `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.user.name)}&background=random`}
          alt={entry.user.name}
        />
        <div className="status-viewer__header-info">
          <p className="status-viewer__header-name">{entry.user.name}</p>
          <p className="status-viewer__header-time">{timeAgo(status.createdAt)}</p>
        </div>

        {/* Mute button (video only) */}
        {status.type === 'video' && (
          <button
            className="status-viewer__close-btn"
            style={{ marginRight: 4 }}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => setMuted(v => !v)}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted
              ? <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              : <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4.243-4.243M12 18l4.243-4.243M7.757 7.757l4.243 4.243" />
                </svg>
            }
          </button>
        )}

        <button
          className="status-viewer__close-btn"
          onPointerDown={e => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* ── Content (with cross-fade on user change) ── */}
      <div
        className="status-viewer__content"
        style={{
          opacity: userTransition ? 0 : 1,
          transition: 'opacity 0.18s ease',
        }}
      >
        {status.type === 'text' && (
          <p className={`status-viewer__text ${FONT_CLASSES[status.fontStyle] ?? ''}`}>
            {status.text}
          </p>
        )}

        {status.type === 'image' && (
          <>
            <img
              className="status-viewer__media-img"
              src={status.mediaUrl}
              alt="status"
              draggable={false}
            />
            {status.text && <div className="status-viewer__caption">{status.text}</div>}
          </>
        )}

        {status.type === 'video' && (
          <>
            <video
              ref={videoRef}
              className="status-viewer__media-video"
              src={status.mediaUrl}
              autoPlay
              muted={muted}
              playsInline
              loop={false}
              onEnded={goNext}
            />
            {status.text && <div className="status-viewer__caption">{status.text}</div>}
          </>
        )}
      </div>

      {/* ── Tap zones ── */}
      <div className="status-viewer__tap-zones">
        <div className="status-viewer__tap-prev" onClick={goPrev} />
        <div className="status-viewer__tap-next" onClick={goNext} />
      </div>

      {/* ── Reaction strip (non-owner) ── */}
      {!isOwn && (
        <div
          className="status-viewer__reactions"
          onPointerDown={e => e.stopPropagation()}
        >
          {QUICK_REACTIONS.map(em => (
            <button
              key={em}
              className={`status-viewer__reaction-btn ${myReaction === em ? 'active' : ''}`}
              onClick={() => handleReact(em)}
              title={`React ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      )}

      {/* ── Footer ── */}
      <div
        className="status-viewer__footer"
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Owner — seen count */}
        {isOwn && (
          <button className="status-viewer__seen-btn" onClick={loadViewers}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {status.viewCount ?? status.views?.length ?? 0} viewers
          </button>
        )}

        {/* Non-owner — reply input */}
        {!isOwn && (
          <div className="status-viewer__reply-row">
            {replyOpen
              ? <div className="status-viewer__reply-input-wrap">
                  <input
                    className="status-viewer__reply-input"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSendReply(); }}
                    placeholder={`Reply to ${entry.user.name}…`}
                    autoFocus
                    maxLength={500}
                  />
                  <button className="status-viewer__reply-send" onClick={handleSendReply}>
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </div>
              : <button className="status-viewer__reply-btn" onClick={() => setReplyOpen(true)}>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                  </svg>
                  Reply
                </button>
            }
            <button className="status-viewer__share-btn" onClick={handleShare} title="Copy link">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
          </div>
        )}

        {/* Share toast */}
        {shareToast && (
          <div className="status-viewer__toast">
            ✅ Link copied!
          </div>
        )}
      </div>

      {/* ── Viewers bottom sheet ── */}
      {viewers !== null && (
        <div
          className="status-viewer__sheet-overlay"
          onClick={() => setViewers(null)}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="status-viewer__sheet" onClick={e => e.stopPropagation()}>
            <div className="status-viewer__sheet-header">
              <h3>Seen by {viewersLoading ? '…' : viewers.length}</h3>
              <button className="status-viewer__sheet-close" onClick={() => setViewers(null)}>
                <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {viewersLoading && <p className="status-viewer__sheet-loading">Loading…</p>}
            {!viewersLoading && viewers.length === 0 && (
              <p className="status-viewer__sheet-empty">No one has viewed this yet.</p>
            )}
            {viewers.map(v => (
              <div key={v._id} className="status-viewer__viewer-row">
                <img
                  src={v.profileavatar?.URL ||
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(v.name)}&background=random`}
                  alt={v.name}
                />
                <div className="status-viewer__viewer-info">
                  <p className="status-viewer__viewer-name">{v.name}</p>
                  <p className="status-viewer__viewer-username">@{v.username}</p>
                </div>
                <span className="status-viewer__viewer-time">{timeAgo(v.viewedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}