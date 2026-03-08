// src/components/Status/StatusViewer.jsx

import { useState, useEffect, useRef, useCallback } from 'react';
import apiRequest   from '../../utils/apiRequest';
import { useStatus } from '../../Context/StatusContext';
import './Status.css';

const SLIDE_DURATION = 5000;

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const FONT_CLASSES = [
  '',                                  // 0 sans (default)
  'font-style-serif',                  // 1
  'font-style-mono',                   // 2
  'font-style-italic',                 // 3
  'font-style-bold',                   // 4
];

export default function StatusViewer({ entries, startIndex = 0, currentUserId, onClose }) {
  const { markViewed } = useStatus();

  const [userIdx,  setUserIdx]  = useState(startIndex);
  const [slideIdx, setSlideIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused,   setPaused]   = useState(false);
  const [viewers,  setViewers]  = useState(null);
  const [viewersLoading, setViewersLoading] = useState(false);

  const timerRef = useRef(null);
  const startRef = useRef(null);
  const elapsed  = useRef(0);

  const entry  = entries[userIdx];
  const status = entry?.statuses[slideIdx];
  const isOwn  = entry?.user._id === currentUserId;

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const goNext = useCallback(() => {
    setProgress(0); elapsed.current = 0;
    if (slideIdx < entry.statuses.length - 1) {
      setSlideIdx(s => s + 1);
    } else if (userIdx < entries.length - 1) {
      setUserIdx(u => u + 1); setSlideIdx(0);
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
      setUserIdx(p); setSlideIdx(entries[p].statuses.length - 1);
    }
  }, [slideIdx, userIdx, entries]);

  // Progress timer
  useEffect(() => {
    if (!status) return;
    clearTimer(); elapsed.current = 0; setProgress(0);
    startRef.current = Date.now();
    if (!paused) {
      timerRef.current = setInterval(() => {
        const spent = Date.now() - startRef.current + elapsed.current;
        const pct   = Math.min((spent / SLIDE_DURATION) * 100, 100);
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
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [goNext, goPrev, onClose]);

  const handlePointerDown = () => {
    elapsed.current += Date.now() - startRef.current;
    clearTimer(); setPaused(true);
  };
  const handlePointerUp = () => { startRef.current = Date.now(); setPaused(false); };

  const loadViewers = async () => {
    if (!isOwn || !status) return;
    setViewers([]); setViewersLoading(true);
    try {
      const res = await apiRequest.get(`/api/status/${status._id}/views`);
      setViewers(res.data.viewers ?? []);
    } catch { setViewers([]); }
    finally   { setViewersLoading(false); }
  };

  if (!entry || !status) return null;

  const bgStyle = status.type === 'text'
    ? { background: status.backgroundColor }
    : { background: '#000' };

  return (
    <div
      className="status-viewer"
      style={bgStyle}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Progress bars */}
      <div className="status-viewer__progress-row">
        {entry.statuses.map((s, i) => (
          <div key={s._id} className="status-viewer__progress-track">
            <div
              className="status-viewer__progress-fill"
              style={{
                width: i < slideIdx ? '100%'
                      : i === slideIdx ? `${progress}%`
                      : '0%'
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
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
        <button
          className="status-viewer__close-btn"
          onPointerDown={e => e.stopPropagation()}
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="status-viewer__content">
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
            {status.text && (
              <div className="status-viewer__caption">{status.text}</div>
            )}
          </>
        )}

        {status.type === 'video' && (
          <video
            className="status-viewer__media-video"
            src={status.mediaUrl}
            autoPlay muted playsInline loop
          />
        )}
      </div>

      {/* Tap zones */}
      <div className="status-viewer__tap-zones">
        <div className="status-viewer__tap-prev" onClick={goPrev} />
        <div className="status-viewer__tap-next" onClick={goNext} />
      </div>

      {/* Footer — owner seen count */}
      {isOwn && (
        <div
          className="status-viewer__footer"
          onPointerDown={e => e.stopPropagation()}
        >
          <button className="status-viewer__seen-btn" onClick={loadViewers}>
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            {status.viewCount ?? status.views?.length ?? 0} viewers
          </button>
        </div>
      )}

      {/* Viewers sheet */}
      {viewers !== null && (
        <div
          className="status-viewer__sheet-overlay"
          onClick={() => setViewers(null)}
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="status-viewer__sheet" onClick={e => e.stopPropagation()}>
            <div className="status-viewer__sheet-header">
              <h3>Seen by {viewersLoading ? '…' : viewers.length}</h3>
              <button className="status-viewer__sheet-close" onClick={() => setViewers(null)} aria-label="Close">
                <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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