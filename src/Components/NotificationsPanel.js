// src/Components/NotificationsPanel.js
//
// PERF FIXES:
//   1. Timestamp tick: `setTick` was calling setState on the panel every 60 s,
//      causing the entire list (potentially 50+ items) to re-render just to
//      update relative timestamps.  Fix: move tick to a context/ref approach —
//      each NotifItem computes its own relative time with a local 60 s interval
//      so only items that actually change re-render (and only themselves).
//   2. NotifItem is wrapped in React.memo so list items skip re-renders when
//      unrelated state (filter tab, unreadCount badge) changes in the parent.
//   3. Removed the top-level `const [, setTick]` state that forced a full
//      panel re-render every minute.
//   4. SkeletonItem extracted as a stable component (was inline).

import React, {
  useEffect, useState, useCallback, useRef, useMemo,
} from 'react';
import { useNotification } from '../Context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProfileModal from '../Components/Profile/ProfileModal';
import apiRequest from '../utils/apiRequest';
import { useScrollLock } from '../hooks/useScrollLock';

// ─── Constants ─────────────────────────────────────────────────────────────
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

function resolveAvatar(sender) {
  if (!sender) return null;
  const candidates = [
    sender?.profileavatar?.URL, sender?.profileavatar?.url, sender?.profileavatar,
    sender?.avatar?.URL, sender?.avatar?.url, sender?.avatar,
    sender?.profileImage, sender?.image, sender?.photo,
  ];
  for (const c of candidates) {
    if (!c || typeof c === 'object') continue;
    const s = String(c).trim();
    if (!s) continue;
    if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return s;
    if (s.startsWith('//')) return `https:${s}`;
    const base = process.env.REACT_APP_MEDIA_BASE_URL || process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';
    return `${base}${s.startsWith('/') ? '' : '/'}${s}`;
  }
  return null;
}

const TYPE_MAP = {
  friend_request:      { label: 'Friend Request',     icon: '👤', color: '#6366f1' },
  friend_accept:       { label: 'Friend Accepted',    icon: '🤝', color: '#10b981' },
  friend_decline:      { label: 'Friend Declined',    icon: '❌', color: '#ef4444' },
  referral_signup:     { label: 'Referral Signup',    icon: '📨', color: '#f59e0b' },
  referral_reward:     { label: 'Referral Reward',    icon: '🎁', color: '#ec4899' },
  referral_activation: { label: 'Referral Activated', icon: '🚀', color: '#8b5cf6' },
  post_reward:         { label: 'Post Reward',        icon: '🏆', color: '#f59e0b' },
  post_deleted:        { label: 'Post Removed',       icon: '🗑️', color: '#6b7280' },
  comment:             { label: 'New Comment',        icon: '💬', color: '#3b82f6' },
  like:                { label: 'New Like',           icon: '❤️', color: '#ef4444' },
  streak_reward:       { label: 'Streak Reward',      icon: '🔥', color: '#f97316' },
  daily_streak:        { label: 'Daily Streak',       icon: '📅', color: '#f97316' },
  streak_reminder:     { label: 'Streak Reminder',    icon: '⏰', color: '#eab308' },
  payment_success:     { label: 'Payment Success',    icon: '💳', color: '#10b981' },
  auto_renew:          { label: 'Auto Renew',         icon: '🔄', color: '#6366f1' },
  expiry_reminder_7d:  { label: 'Expiry in 7 Days',  icon: '⚠️', color: '#f59e0b' },
  expiry_reminder_1d:  { label: 'Expiry Tomorrow',   icon: '🚨', color: '#ef4444' },
  custom:              { label: 'Notification',       icon: 'ℹ️', color: '#6b7280' },
};

function getTypeMeta(type) {
  return (
    TYPE_MAP[type] || {
      label: (type || 'Update').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: 'ℹ️',
      color: '#6b7280',
    }
  );
}

// ─── relativeTime: computed locally per item so global tick isn't needed ────
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1_000);
  if (diff < 60)    return 'Just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── SkeletonItem ──────────────────────────────────────────────────────────
const shimmer = {
  background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s infinite',
};

const SkeletonItem = React.memo(() => (
  <div style={{ display: 'flex', gap: 12, padding: '14px 16px', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, ...shimmer }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
      <div style={{ height: 13, borderRadius: 6, width: '70%', ...shimmer }} />
      <div style={{ height: 10, borderRadius: 6, width: '40%', ...shimmer }} />
    </div>
  </div>
));

// ─── NotifItem — memoised so list skips re-render on tab/count changes ──────
const NotifItem = React.memo(function NotifItem({ note, idx, onItemClick, onDelete, onAvatarEnter, onAvatarLeave, onAvatarClick }) {
  const { icon, color } = getTypeMeta(note.type);
  const { label } = getTypeMeta(note.type);
  const sender = note.sender || {};
  const avatarSrc = resolveAvatar(sender);

  // Each item tracks its own relative time, updating every 60 s independently
  const [relTime, setRelTime] = useState(() => relativeTime(note.createdAt));
  useEffect(() => {
    const id = setInterval(() => setRelTime(relativeTime(note.createdAt)), 60_000);
    return () => clearInterval(id);
  }, [note.createdAt]);

  const absTime = note.createdAt ? new Date(note.createdAt).toLocaleString() : '';

  return (
    <div
      className="np-notif-item np-item-enter"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        padding: '14px 16px',
        borderBottom: '1px solid #f1f5f9',
        background: note.isRead ? '#fff' : 'linear-gradient(90deg, #f0f4ff 0%, #fff 60%)',
        cursor: 'pointer',
        transition: 'background 0.15s',
        position: 'relative',
        animationDelay: `${Math.min(idx, 8) * 30}ms`,
      }}
      tabIndex={0}
      role="button"
      aria-label={note.message}
      onClick={() => onItemClick(note)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onItemClick(note); } }}
    >
      {/* Avatar */}
      <div
        style={{ position: 'relative', flexShrink: 0 }}
        onMouseEnter={() => sender._id && onAvatarEnter(sender._id)}
        onMouseLeave={onAvatarLeave}
        onClick={(e) => { if (!sender._id) return; e.stopPropagation(); onAvatarClick(sender._id); }}
      >
        <img
          src={avatarSrc || DEFAULT_AVATAR}
          alt={sender?.name || 'User'}
          style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #e2e8f0', display: 'block' }}
          onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR; }}
          loading="lazy"
        />
        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%', background: color, border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, lineHeight: 1 }}>
          {icon}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {sender?.name && (
          <span style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 2 }}>
            {sender.name}
          </span>
        )}
        <p style={{ fontSize: 13, color: '#1e293b', fontWeight: 500, lineHeight: 1.45, wordBreak: 'break-word', margin: 0 }}>
          {note.message}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}18`, padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }} title={label}>
            {label}
          </span>
          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }} title={absTime}>
            {relTime || absTime}
          </span>
        </div>
      </div>

      {/* Right col */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        {!note.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', flexShrink: 0 }} />}
        <button
          className="np-delete-btn"
          style={{ background: 'none', border: 'none', width: 24, height: 24, borderRadius: 6, cursor: 'pointer', color: '#cbd5e1', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', padding: 0 }}
          title="Delete"
          onClick={(e) => { e.stopPropagation(); onDelete(note._id, !note.isRead); }}
          aria-label="Delete notification"
        >
          ✕
        </button>
      </div>
    </div>
  );
});

// ─── Keyframes injected once ───────────────────────────────────────────────
if (typeof document !== 'undefined' && !document.getElementById('np-keyframes')) {
  const style = document.createElement('style');
  style.id = 'np-keyframes';
  style.textContent = `
    @keyframes fadeIn   { from { opacity: 0 } to { opacity: 1 } }
    @keyframes slideIn  { from { transform: translateX(100%) } to { transform: translateX(0) } }
    @keyframes shimmer  { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
    @keyframes popIn    { from { opacity: 0; transform: scale(0.96) translateY(6px) } to { opacity: 1; transform: scale(1) translateY(0) } }
    .np-item-enter { animation: popIn 0.2s ease both; }
    .np-action-btn:hover { opacity: 0.75 !important; }
    .np-delete-btn:hover { color: #ef4444 !important; background: #fef2f2 !important; }
    .np-notif-item:hover { background: #f8fafc !important; }
  `;
  document.head.appendChild(style);
}

// ─── Main Component ────────────────────────────────────────────────────────
const NotificationsPanel = ({ show, onClose, pageSize = 10 }) => {
  const {
    unreadCount, setUnreadCount,
    notifications: liveNotifications,
    pushEnabled, pushError, enablePush,
  } = useNotification();

  const [fetched,     setFetched]     = useState([]);
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter,      setFilter]      = useState('all');

  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId,   setSelectedUserId]   = useState(null);
  const hoverTimer = useRef(null);
  const navigate   = useRef(useNavigate()).current;
  const scrollRef  = useRef(null);

  useScrollLock(show);

  // Close on Escape
  useEffect(() => {
    if (!show) return;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [show, onClose]);

  useEffect(() => {
    document.body.style.overflow = show ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  // Profile hover
  const openProfileModal = useCallback((senderId) => {
    clearTimeout(hoverTimer.current);
    setSelectedUserId(senderId);
    setShowProfileModal(true);
  }, []);
  const scheduleCloseModal = useCallback(() => {
    hoverTimer.current = setTimeout(() => { setShowProfileModal(false); setSelectedUserId(null); }, 300);
  }, []);
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // Fetch
  const fetchNotifications = useCallback(async (pageNumber = 1, append = false) => {
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const { data } = await apiRequest.get(`/api/notifications?page=${pageNumber}&limit=${pageSize}`);
      if (data?.status === 'success') {
        const incoming = Array.isArray(data.data) ? data.data : [];
        setFetched((prev) => append ? [...prev, ...incoming] : incoming);
        setUnreadCount(Number(data.unreadCount ?? 0));
        setTotalPages(Number(data.totalPages ?? 1));
        setPage(Number(data.page ?? pageNumber));
      } else if (!append) setFetched([]);
    } catch {
      if (!append) setFetched([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [pageSize, setUnreadCount]);

  useEffect(() => {
    if (show) {
      fetchNotifications(1);
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    } else {
      setFetched([]);
      setPage(1);
      setFilter('all');
    }
  }, [show, fetchNotifications]);

  // Merge live + fetched
  const fetchedIds = useMemo(() => new Set(fetched.map((n) => n._id)), [fetched]);
  const mergedList = useMemo(() => [
    ...liveNotifications.filter((n) => !fetchedIds.has(n._id)),
    ...fetched,
  ], [liveNotifications, fetched, fetchedIds]);

  const displayList = useMemo(
    () => filter === 'unread' ? mergedList.filter((n) => !n.isRead) : mergedList,
    [mergedList, filter],
  );

  // Actions
  const markAllRead = useCallback(async () => {
    try {
      await apiRequest.put('/api/notifications/mark-all-read');
      setFetched((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch { toast.error('Could not mark all as read.'); }
  }, [setUnreadCount]);

  const markOneRead = useCallback(async (id) => {
    setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    try { await apiRequest.put(`/api/notifications/${id}/read`); }
    catch {
      setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((prev) => prev + 1);
    }
  }, [setUnreadCount]);

  const deleteOne = useCallback(async (id, wasUnread) => {
    setFetched((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(prev - 1, 0));
    try { await apiRequest.delete(`/api/notifications/${id}`); }
    catch {
      toast.error('Could not delete notification.');
      fetchNotifications(page);
    }
  }, [fetchNotifications, page, setUnreadCount]);

  const cleanupOld = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      try       { res = await apiRequest.delete('/api/notifications/cleanup'); }
      catch (_) { res = await apiRequest.post('/api/notifications/cleanup'); }
      const deleted = res.data?.deletedCount ?? 0;
      toast.success(`Cleared ${deleted} old notification${deleted !== 1 ? 's' : ''}.`);
      await fetchNotifications(1);
    } catch { toast.error('Cleanup failed.'); }
    finally { setLoading(false); }
  }, [fetchNotifications]);

  const handleItemClick = useCallback((note) => {
    if (note._id && !note.isRead) markOneRead(note._id);
    if (note.url) { onClose?.(); navigate(note.url); }
  }, [markOneRead, navigate, onClose]);

  const loadMore = useCallback(() => {
    if (page < totalPages && !loadingMore) fetchNotifications(page + 1, true);
  }, [page, totalPages, loadingMore, fetchNotifications]);

  if (!show) return null;

  const styles = {
    overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', zIndex: 1200, animation: 'fadeIn 0.2s ease' },
    drawer: { position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: 420, height: '100%', background: '#ffffff', boxShadow: '-8px 0 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', zIndex: 1201, animation: 'slideIn 0.28s cubic-bezier(0.32, 0.72, 0, 1)', overflow: 'hidden' },
  };

  return (
    <>
      <div style={styles.overlay} onClick={onClose} aria-hidden />
      <div role="dialog" aria-label="Notifications" aria-modal="true" style={styles.drawer} onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', padding: '18px 20px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🔔</div>
            <div>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#f8fafc', letterSpacing: '-0.3px' }}>
                Notifications
                {unreadCount > 0 && (
                  <span style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 20, marginLeft: 6, lineHeight: 1.6 }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </p>
              <p style={{ margin: 0, fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
              </p>
            </div>
          </div>
          <button
            style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
            onClick={onClose}
            aria-label="Close notifications"
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          >✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e2e8f0', padding: '0 16px', background: '#f8fafc', flexShrink: 0 }}>
          {['all', 'unread'].map((f) => (
            <button key={f} style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', background: 'none', color: filter === f ? '#6366f1' : '#64748b', borderBottom: filter === f ? '2px solid #6366f1' : '2px solid transparent', transition: 'all 0.15s', marginBottom: -1 }} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : `Unread${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
            </button>
          ))}
        </div>

        {/* Action bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px', borderBottom: '1px solid #f1f5f9', background: '#fff', flexShrink: 0, gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="np-action-btn" style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#ede9fe', color: '#6366f1', transition: 'opacity 0.15s' }} onClick={markAllRead} disabled={loading || unreadCount === 0}>✓ Mark all read</button>
            <button className="np-action-btn" style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#fef2f2', color: '#ef4444', transition: 'opacity 0.15s' }} onClick={cleanupOld} disabled={loading}>🗑 Clear old</button>
          </div>
          {!pushEnabled && (
            <button className="np-action-btn" style={{ padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: '#f0fdf4', color: '#10b981' }} onClick={enablePush}>🔔 Enable push</button>
          )}
          {pushError && <span style={{ fontSize: 11, color: '#ef4444' }}>⚠ {pushError}</span>}
        </div>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }} ref={scrollRef}>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => <SkeletonItem key={i} />)
          ) : displayList.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#94a3b8', textAlign: 'center' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>{filter === 'unread' ? '✅' : '🔕'}</div>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#475569', margin: '0 0 4px' }}>{filter === 'unread' ? 'All caught up!' : 'No notifications yet'}</p>
              <p style={{ fontSize: 13, margin: 0 }}>{filter === 'unread' ? "You've read everything." : "When you get notifications, they'll show up here."}</p>
            </div>
          ) : (
            <>
              {displayList.map((note, idx) => (
                <NotifItem
                  key={note._id || idx}
                  note={note}
                  idx={idx}
                  onItemClick={handleItemClick}
                  onDelete={deleteOne}
                  onAvatarEnter={openProfileModal}
                  onAvatarLeave={scheduleCloseModal}
                  onAvatarClick={openProfileModal}
                />
              ))}
              {page < totalPages && (
                <button style={{ display: 'block', width: '100%', padding: '12px', textAlign: 'center', background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: '#6366f1', cursor: 'pointer', borderTop: '1px solid #f1f5f9' }} onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more notifications ↓'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <ProfileModal
        userId={selectedUserId}
        show={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onMouseEnter={() => clearTimeout(hoverTimer.current)}
        onMouseLeave={scheduleCloseModal}
      />
    </>
  );
};

export default NotificationsPanel;