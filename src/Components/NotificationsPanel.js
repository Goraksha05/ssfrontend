// src/Components/NotificationsPanel.js
//
// Changes from original:
//   • Reads unreadCount from NotificationContext (single source of truth —
//     no duplicate badge state between Navbar and Panel).
//   • Merges real-time socket arrivals (from context) with server-fetched
//     list so newly arrived notifications appear immediately without a refetch.
//   • Adds per-notification delete button.
//   • Uses relative timestamps ("2 min ago") with absolute on hover.
//   • Keyboard accessible (Enter/Space on list items).
//   • Pulls page size from prop (default 10 to match server cap).

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Modal, Button, Spinner } from 'react-bootstrap';
import { useNotification } from '../Context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ProfileModal from '../Components/Profile/ProfileModal';
import apiRequest from '../utils/apiRequest';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_AVATAR = 'https://cdn-icons-png.flaticon.com/512/149/149071.png';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function resolveAvatar(candidate) {
  if (!candidate) return null;
  if (typeof candidate === 'object') {
    return candidate.URL || candidate.url || candidate.path || candidate.src || null;
  }
  const s = String(candidate).trim();
  if (!s) return null;
  if (s.startsWith('http') || s.startsWith('data:') || s.startsWith('blob:')) return s;
  if (s.startsWith('//')) return `https:${s}`;
  const base =
    process.env.REACT_APP_MEDIA_BASE_URL ||
    process.env.REACT_APP_BACKEND_URL    ||
    process.env.REACT_APP_SERVER_URL     || '';
  return `${base}${s.startsWith('/') ? '' : '/'}${s}`;
}

function getTypeMeta(type) {
  const MAP = {
    friend_request:      { label: 'Friend Request',     icon: '👤' },
    friend_accept:       { label: 'Friend Accepted',    icon: '🤝' },
    friend_decline:      { label: 'Friend Declined',    icon: '❌' },
    referral_signup:     { label: 'Referral Signup',    icon: '📨' },
    referral_reward:     { label: 'Referral Reward',    icon: '🎁' },
    referral_activation: { label: 'Referral Activated', icon: '🚀' },
    post_reward:         { label: 'Post Reward',        icon: '🏆' },
    post_deleted:        { label: 'Post Removed',       icon: '🗑️' },
    comment:             { label: 'New Comment',        icon: '💬' },
    like:                { label: 'New Like',           icon: '❤️' },
    streak_reward:       { label: 'Streak Reward',      icon: '🔥' },
    daily_streak:        { label: 'Daily Streak',       icon: '📅' },
    streak_reminder:     { label: 'Streak Reminder',    icon: '⏰' },
    payment_success:     { label: 'Payment Success',    icon: '💳' },
    auto_renew:          { label: 'Auto Renew',         icon: '🔄' },
    expiry_reminder_7d:  { label: 'Expiry in 7 Days',  icon: '⚠️' },
    expiry_reminder_1d:  { label: 'Expiry Tomorrow',   icon: '🚨' },
    custom:              { label: 'Notification',       icon: 'ℹ️' },
  };
  return (
    MAP[type] || {
      label: (type || 'Update').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      icon: 'ℹ️',
    }
  );
}

/** Relative time ("2 min ago") — refreshes on each render via the panel's 60s ticker */
function relativeTime(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1_000); // seconds
  if (diff < 60)   return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ─── Component ────────────────────────────────────────────────────────────────
const NotificationsPanel = ({ show, onClose, pageSize = 10 }) => {
  const {
    unreadCount,
    setUnreadCount,
    notifications: liveNotifications, // real-time arrivals from socket
  } = useNotification();

  const [fetched,     setFetched]     = useState([]);  // server-paginated list
  const [page,        setPage]        = useState(1);
  const [totalPages,  setTotalPages]  = useState(1);
  const [loading,     setLoading]     = useState(false);
  const [, setTick] = useState(0); // write-only: incrementing triggers re-render for relative timestamps

  const { pushEnabled, pushError, enablePush } = useNotification();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedUserId,   setSelectedUserId]   = useState(null);

  const hoverTimer = useRef(null);
  const navigate   = useNavigate();

  // Refresh relative timestamps every 60 s
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // ── Profile hover ──────────────────────────────────────────────────────────
  const openProfileModal = (senderId) => {
    clearTimeout(hoverTimer.current);
    setSelectedUserId(senderId);
    setShowProfileModal(true);
  };
  const scheduleCloseModal = () => {
    hoverTimer.current = setTimeout(() => {
      setShowProfileModal(false);
      setSelectedUserId(null);
    }, 300);
  };
  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  // ── Server fetch ───────────────────────────────────────────────────────────
  const fetchNotifications = useCallback(async (pageNumber = 1) => {
    setLoading(true);
    try {
      const { data } = await apiRequest.get(
        `/api/notifications?page=${pageNumber}&limit=${pageSize}`
      );
      if (data?.status === 'success') {
        setFetched(Array.isArray(data.data) ? data.data : []);
        setUnreadCount(Number(data.unreadCount ?? 0));
        setTotalPages(Number(data.totalPages ?? 1));
        setPage(Number(data.page ?? pageNumber));
      } else {
        setFetched([]);
      }
    } catch (err) {
      console.error('[NotificationsPanel] fetch error:', err);
      setFetched([]);
    } finally {
      setLoading(false);
    }
  }, [pageSize, setUnreadCount]);

  useEffect(() => {
    if (show) {
      fetchNotifications(1);
    } else {
      // Reset on close so next open starts fresh
      setFetched([]);
      setPage(1);
    }
  }, [show, fetchNotifications]);

  // ── Merge real-time arrivals with server list ──────────────────────────────
  // Live notifications that haven't been fetched from server yet bubble to top
  const fetchedIds = new Set(fetched.map((n) => n._id));
  const mergedList = [
    ...liveNotifications.filter((n) => !fetchedIds.has(n._id)),
    ...fetched,
  ];

  // ── Mark all read ──────────────────────────────────────────────────────────
  const markAllRead = async () => {
    try {
      await apiRequest.put('/api/notifications/mark-all-read');
      setFetched((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Could not mark all as read.');
    }
  };

  // ── Mark one read (optimistic) ─────────────────────────────────────────────
  const markOneRead = useCallback(async (id) => {
    setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    setUnreadCount((prev) => Math.max(prev - 1, 0));
    try {
      await apiRequest.put(`/api/notifications/${id}/read`);
    } catch {
      setFetched((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: false } : n)));
      setUnreadCount((prev) => prev + 1);
      toast.error('Could not mark as read.');
    }
  }, [setUnreadCount]);

  // ── Delete one notification ────────────────────────────────────────────────
  const deleteOne = useCallback(async (id, wasUnread) => {
    setFetched((prev) => prev.filter((n) => n._id !== id));
    if (wasUnread) setUnreadCount((prev) => Math.max(prev - 1, 0));
    try {
      await apiRequest.delete(`/api/notifications/${id}`);
    } catch {
      toast.error('Could not delete notification.');
      fetchNotifications(page); // restore on failure
    }
  }, [fetchNotifications, page, setUnreadCount]);

  // ── Cleanup old ────────────────────────────────────────────────────────────
  const cleanupOld = async () => {
    setLoading(true);
    try {
      let res;
      try       { res = await apiRequest.delete('/api/notifications/cleanup'); }
      catch (_) { res = await apiRequest.post('/api/notifications/cleanup'); }
      const deleted = res.data?.deletedCount ?? 0;
      toast.success(`Deleted ${deleted} old notification${deleted !== 1 ? 's' : ''}.`);
      await fetchNotifications(1);
    } catch {
      toast.error('Cleanup failed.');
    } finally {
      setLoading(false);
    }
  };

  // ── Keyboard handler for list items ───────────────────────────────────────
  const handleItemKeyDown = (e, note) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleItemClick(note);
    }
  };

  const handleItemClick = (note) => {
    if (note._id && !note.isRead) markOneRead(note._id);
    if (note.url) navigate(note.url);
    onClose?.();
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      show={show}
      onHide={onClose}
      centered
      scrollable
      fullscreen="sm-down"
      animation
    >
      {/* Header */}
      <Modal.Header closeButton className="bg-primary text-white py-2">
        <Modal.Title className="d-flex align-items-center gap-2 fs-6">
          <span role="img" aria-label="bell">🔔</span>
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="badge bg-danger rounded-pill ms-1">{unreadCount}</span>
          )}
        </Modal.Title>
      </Modal.Header>

      {/* Action bar */}
      <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom bg-light flex-wrap gap-2">
        <div className="d-flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline-primary"
            onClick={markAllRead}
            disabled={loading || unreadCount === 0}
          >
            Mark All Read
          </Button>
          <Button
            size="sm"
            variant="outline-danger"
            onClick={cleanupOld}
            disabled={loading}
          >
            Clear Old
          </Button>
          {!pushEnabled && (
            <Button size="sm" variant="outline-success" onClick={enablePush}>
              Enable Push
            </Button>
          )}
        </div>
        {pushError && <span className="small text-danger">{pushError}</span>}
      </div>

      {/* Body */}
      <Modal.Body className="p-0" style={{ minHeight: 200 }}>
        {loading ? (
          <div className="d-flex justify-content-center align-items-center py-5">
            <Spinner animation="border" variant="primary" />
          </div>
        ) : mergedList.length === 0 ? (
          <p className="text-muted text-center py-5 mb-0">🔕 No notifications yet.</p>
        ) : (
          <ul className="list-group list-group-flush mb-0">
            {mergedList.map((note, idx) => {
              const { icon }  = getTypeMeta(note.type);
              const sender    = note.sender || {};
              const avatarSrc = resolveAvatar(
                sender?.profileavatar?.URL || sender?.profileavatar || sender?.avatar
              );
              const absTime = note.createdAt
                ? new Date(note.createdAt).toLocaleString()
                : '';
              /* tick is in deps via closure so relative time refreshes */
              const relTime = relativeTime(note.createdAt);

              return (
                <li
                  key={note._id || idx}
                  tabIndex={0}
                  className={`list-group-item list-group-item-action px-3 py-2 ${
                    note.isRead ? '' : 'bg-primary bg-opacity-10'
                  }`}
                  style={{ cursor: note.url ? 'pointer' : 'default' }}
                  onClick={() => handleItemClick(note)}
                  onKeyDown={(e) => handleItemKeyDown(e, note)}
                >
                  <div className="d-flex align-items-start gap-2">
                    {/* Avatar */}
                    <div
                      className="flex-shrink-0"
                      style={{ cursor: sender._id ? 'pointer' : 'default' }}
                      onMouseEnter={() => sender._id && openProfileModal(sender._id)}
                      onMouseLeave={scheduleCloseModal}
                      onClick={(e) => {
                        if (!sender._id) return;
                        e.stopPropagation();
                        openProfileModal(sender._id);
                      }}
                    >
                      <img
                        src={avatarSrc || DEFAULT_AVATAR}
                        alt="sender"
                        className="rounded-circle"
                        width={40}
                        height={40}
                        style={{
                          objectFit: 'cover',
                          border:    '2px solid rgba(255,38,0,1)',
                          boxShadow: '2px 2px 6px rgba(255,196,0,1)',
                        }}
                        onError={(e) => { e.target.src = DEFAULT_AVATAR; }}
                      />
                    </div>

                    {/* Content */}
                    <div className="flex-grow-1 overflow-hidden">
                      <div className="d-flex align-items-baseline gap-1 flex-wrap">
                        <span className="me-1" aria-hidden>{icon}</span>
                        <span
                          className="text-dark"
                          style={{ fontSize: '0.875rem', wordBreak: 'break-word' }}
                        >
                          {note.message}
                        </span>
                      </div>
                      <small
                        className="text-muted"
                        title={absTime}
                        style={{ cursor: 'help' }}
                      >
                        {relTime || absTime}
                      </small>
                    </div>

                    {/* Right side: unread dot + delete */}
                    <div className="d-flex flex-column align-items-end gap-1 flex-shrink-0">
                      {!note.isRead && (
                        <span
                          className="bg-primary rounded-circle"
                          style={{ width: 8, height: 8 }}
                          aria-label="unread"
                        />
                      )}
                      <button
                        className="btn btn-link p-0 text-muted"
                        style={{ fontSize: '0.7rem', lineHeight: 1 }}
                        title="Delete notification"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteOne(note._id, !note.isRead);
                        }}
                        aria-label="Delete notification"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Modal.Body>

      {/* Profile hover modal */}
      <ProfileModal
        userId={selectedUserId}
        show={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        onMouseEnter={() => clearTimeout(hoverTimer.current)}
        onMouseLeave={scheduleCloseModal}
      />

      {/* Footer pagination */}
      <Modal.Footer className="d-flex justify-content-between py-2">
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => fetchNotifications(Math.max(1, page - 1))}
          disabled={page <= 1 || loading}
        >
          ← Prev
        </Button>
        <span className="small fw-semibold text-muted">
          {page} / {totalPages}
        </span>
        <Button
          size="sm"
          variant="outline-secondary"
          onClick={() => fetchNotifications(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages || loading}
        >
          Next →
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default NotificationsPanel;