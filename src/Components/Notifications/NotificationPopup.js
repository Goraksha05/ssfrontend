// src/Components/NotificationPopup.js
//
// A compact inline notification list — used as a drop-in popup/widget
// wherever a full NotificationsPanel drawer is too heavy (e.g. an
// embedded iframe, a widget page, a mini notification tray).
//
// REFACTOR vs original:
//   • Was reading notifications / setNotifications / setNotificationCount
//     from AuthContext — those fields no longer live there (moved to
//     NotificationContext). This version uses useNotification() correctly.
//   • The old component fetched data itself AND read from context, causing
//     double state. Now: context owns live/real-time arrivals; this component
//     fetches the server-paginated list separately (same pattern as Panel).
//   • Removed all dead commented-out code and the isolated AuthProvider wrap
//     in notification.js that prevented shared context from reaching here.
//   • Mark-as-read on item click (optimistic).
//   • Sender avatar displayed.
//   • Relative timestamps.
//   • Accessible keyboard navigation.
//   • Fully self-contained styles (no Tailwind, no Bootstrap required).

import React, { useCallback, useState, useEffect, useRef } from 'react';
import { useNotification } from '../../Context/NotificationContext';
import { useAuth }         from '../../Context/Authorisation/AuthContext';
import apiRequest          from '../../utils/apiRequest';

// ── Constants ─────────────────────────────────────────────────────────────────
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';
const PAGE_LIMIT     = 10;

// ── Helpers ───────────────────────────────────────────────────────────────────
function resolveAvatar(sender) {
  if (!sender) return null;
  const candidates = [
    sender?.profileavatar?.URL,
    sender?.profileavatar?.url,
    sender?.profileavatar,
    sender?.avatar?.URL,
    sender?.avatar?.url,
    sender?.avatar,
    sender?.profileImage,
    sender?.image,
  ];
  for (const c of candidates) {
    if (!c || typeof c === 'object') continue;
    const s = String(c).trim();
    if (!s) continue;
    if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('//')) return `https:${s}`;
    const base =
      process.env.REACT_APP_MEDIA_BASE_URL ||
      process.env.REACT_APP_BACKEND_URL    ||
      process.env.REACT_APP_SERVER_URL     || '';
    return `${base}${s.startsWith('/') ? '' : '/'}${s}`;
  }
  return null;
}

function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1_000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const TYPE_ICON = {
  friend_request: '👤', friend_accept: '🤝', friend_decline: '❌',
  referral_signup: '📨', referral_reward: '🎁', referral_activation: '🚀',
  post_reward: '🏆', post_deleted: '🗑️', comment: '💬', like: '❤️',
  streak_reward: '🔥', daily_streak: '📅', streak_reminder: '⏰',
  payment_success: '💳', auto_renew: '🔄',
  expiry_reminder_7d: '⚠️', expiry_reminder_1d: '🚨',
  custom: 'ℹ️',
};

// ── Inject styles once ────────────────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('np-popup-styles')) {
  const s = document.createElement('style');
  s.id = 'np-popup-styles';
  s.textContent = `
    .npp-root { font-family: 'Segoe UI', system-ui, sans-serif; background: #fff; border-radius: 14px; box-shadow: 0 4px 24px rgba(0,0,0,0.13); overflow: hidden; width: 100%; max-width: 420px; display: flex; flex-direction: column; }
    .npp-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px 12px; background: linear-gradient(135deg,#1e293b,#0f172a); }
    .npp-header-title { font-size: 15px; font-weight: 700; color: #f8fafc; margin: 0; display: flex; align-items: center; gap: 8px; }
    .npp-badge { background: linear-gradient(135deg,#ef4444,#dc2626); color:#fff; font-size:10px; font-weight:800; padding:2px 7px; border-radius:20px; }
    .npp-mark-btn { background: rgba(255,255,255,0.12); border: none; color: #94a3b8; font-size: 11px; font-weight: 600; padding: 5px 11px; border-radius: 7px; cursor: pointer; transition: background 0.15s; }
    .npp-mark-btn:hover { background: rgba(255,255,255,0.2); color: #fff; }
    .npp-mark-btn:disabled { opacity: 0.4; cursor: not-allowed; }
    .npp-list { list-style: none; margin: 0; padding: 0; flex: 1; overflow-y: auto; max-height: 400px; }
    .npp-item { display: flex; align-items: flex-start; gap: 11px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; cursor: pointer; transition: background 0.13s; }
    .npp-item:hover { background: #f8fafc; }
    .npp-item.unread { background: linear-gradient(90deg,#eff6ff 0%,#fff 55%); }
    .npp-item.unread:hover { background: #e0f2fe; }
    .npp-avatar-wrap { position: relative; flex-shrink: 0; }
    .npp-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 2px solid #e2e8f0; display: block; }
    .npp-type-chip { position: absolute; bottom: -2px; right: -2px; width: 16px; height: 16px; background: #6366f1; border-radius: 50%; border: 2px solid #fff; display: flex; align-items: center; justify-content: center; font-size: 8px; line-height: 1; }
    .npp-body { flex: 1; min-width: 0; }
    .npp-sender { font-size: 12px; font-weight: 700; color: #374151; margin: 0 0 2px; }
    .npp-message { font-size: 13px; color: #1e293b; font-weight: 500; margin: 0; word-break: break-word; line-height: 1.4; }
    .npp-meta { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
    .npp-time { font-size: 11px; color: #94a3b8; }
    .npp-dot { width: 7px; height: 7px; border-radius: 50%; background: linear-gradient(135deg,#6366f1,#8b5cf6); flex-shrink: 0; margin-top: 4px; }
    .npp-empty { display: flex; flex-direction: column; align-items: center; padding: 40px 20px; color: #94a3b8; text-align: center; }
    .npp-empty-icon { font-size: 36px; margin-bottom: 10px; }
    .npp-empty-text { font-size: 13px; font-weight: 600; color: #475569; }
    .npp-footer { display: flex; align-items: center; justify-content: space-between; padding: 10px 16px; border-top: 1px solid #f1f5f9; background: #f8fafc; }
    .npp-page-btn { background: none; border: 1px solid #e2e8f0; border-radius: 7px; padding: 5px 12px; font-size: 12px; font-weight: 600; color: #6366f1; cursor: pointer; transition: all 0.13s; }
    .npp-page-btn:hover:not(:disabled) { background: #6366f1; color: #fff; border-color: #6366f1; }
    .npp-page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .npp-page-info { font-size: 12px; color: #94a3b8; font-weight: 600; }
    .npp-loading { display: flex; align-items: center; justify-content: center; padding: 32px; }
    .npp-spinner { width: 24px; height: 24px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: npp-spin 0.7s linear infinite; }
    @keyframes npp-spin { to { transform: rotate(360deg); } }
  `;
  document.head.appendChild(s);
}

// ── Component ─────────────────────────────────────────────────────────────────
const NotificationPopup = () => {
  // ── Auth — only to gate fetching until user is loaded ──────────────────────
  const { user } = useAuth();

  // ── Notification context — source of truth for live arrivals + badge ───────
  const {
    notifications: liveNotifications,
    unreadCount,
    setUnreadCount,
  } = useNotification();

  // ── Local paginated state ──────────────────────────────────────────────────
  const [fetched,    setFetched]    = useState([]);
  const [page,       setPage]       = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [tick,       setTick]       = useState(0); // triggers relative-time re-renders

  const tickRef = useRef(null);

  // Refresh timestamps every 60 s
  useEffect(() => {
    tickRef.current = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(tickRef.current);
  }, []);

  // ── Fetch server-paginated notifications ───────────────────────────────────
  const fetchNotifications = useCallback(async (p = 1) => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await apiRequest.get(`/api/notifications?page=${p}&limit=${PAGE_LIMIT}`);
      if (res?.data?.status === 'success') {
        setFetched(Array.isArray(res.data.data) ? res.data.data : []);
        setTotalPages(Number(res.data.totalPages) || 1);
        setPage(Number(res.data.page) || p);
        setUnreadCount(Number(res.data.unreadCount ?? 0));
      }
    } catch (err) {
      console.error('[NotificationPopup] fetch failed:', err?.response?.status, err?.message);
    } finally {
      setLoading(false);
    }
  }, [user, setUnreadCount]);

  useEffect(() => {
    if (user) fetchNotifications(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, page]);

  // ── Merge live socket arrivals with fetched list ───────────────────────────
  const fetchedIds = new Set(fetched.map((n) => n._id));
  const merged = [
    ...liveNotifications.filter((n) => !fetchedIds.has(n._id)),
    ...fetched,
  ];

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await apiRequest.put('/api/notifications/mark-all-read');
      setFetched((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('[NotificationPopup] markAllRead failed:', err?.message);
    }
  };

  // ── Mark single read (optimistic) ─────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    try {
      await apiRequest.put(`/api/notifications/${id}/read`);
    } catch {
      // Revert on failure
      setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((prev) => prev + 1);
    }
  }, [setUnreadCount]);

  // ── Handle item click ──────────────────────────────────────────────────────
  const handleClick = (note) => {
    if (note._id && !note.isRead) markOneRead(note._id);
    if (note.url) window.location.href = note.url;
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="npp-root" role="region" aria-label="Notifications">

      {/* Header */}
      <div className="npp-header">
        <h2 className="npp-header-title">
          🔔 Notifications
          {unreadCount > 0 && (
            <span className="npp-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </h2>
        <button
          className="npp-mark-btn"
          onClick={markAllRead}
          disabled={loading || unreadCount === 0}
          aria-label="Mark all notifications as read"
        >
          ✓ Mark all read
        </button>
      </div>

      {/* Body */}
      {loading ? (
        <div className="npp-loading">
          <div className="npp-spinner" aria-label="Loading notifications" />
        </div>
      ) : merged.length === 0 ? (
        <div className="npp-empty">
          <div className="npp-empty-icon">🔕</div>
          <p className="npp-empty-text">No notifications yet</p>
        </div>
      ) : (
        <ul className="npp-list" aria-live="polite">
          {merged.map((note, idx) => {
            const sender    = note.sender || {};
            const avatarSrc = resolveAvatar(sender);
            const icon      = TYPE_ICON[note.type] || 'ℹ️';
            const relTime   = relativeTime(note.createdAt);
            const absTime   = note.createdAt
              ? new Date(note.createdAt).toLocaleString()
              : '';

            return (
              <li
                key={note._id || idx}
                className={`npp-item${note.isRead ? '' : ' unread'}`}
                tabIndex={0}
                role="button"
                aria-label={note.message}
                onClick={() => handleClick(note)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClick(note);
                  }
                }}
              >
                {/* Avatar */}
                <div className="npp-avatar-wrap">
                  <img
                    className="npp-avatar"
                    src={avatarSrc || DEFAULT_AVATAR}
                    alt={sender?.name || 'User'}
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
                    loading="lazy"
                  />
                  <div className="npp-type-chip" aria-hidden>{icon}</div>
                </div>

                {/* Content */}
                <div className="npp-body">
                  {sender?.name && (
                    <p className="npp-sender">{sender.name}</p>
                  )}
                  <p className="npp-message">{note.message}</p>
                  <div className="npp-meta">
                    <span className="npp-time" title={absTime}>
                      {relTime || absTime}
                    </span>
                  </div>
                </div>

                {/* Unread dot */}
                {!note.isRead && (
                  <div className="npp-dot" aria-label="Unread" />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Footer pagination */}
      <div className="npp-footer">
        <button
          className="npp-page-btn"
          onClick={() => setPage((p) => Math.max(p - 1, 1))}
          disabled={page <= 1 || loading}
          aria-label="Previous page"
        >
          ← Prev
        </button>
        <span className="npp-page-info">
          {page} / {totalPages}
        </span>
        <button
          className="npp-page-btn"
          onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
          disabled={page >= totalPages || loading}
          aria-label="Next page"
        >
          Next →
        </button>
      </div>
    </div>
  );
};

export default NotificationPopup;