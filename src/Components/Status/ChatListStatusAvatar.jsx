// src/components/Status/ChatListStatusAvatar.jsx
//
// Upgrades vs original:
//   1. Intersection Observer — only fetches status data when the avatar
//      scrolls into view (perf win in long chat lists).
//   2. Skeleton shimmer while loading (instead of plain avatar that jumps).
//   3. Fallback initials from name when neither avatarUrl nor fallbackRender.
//   4. Accessible focus ring matches the status ring colour.
//   5. counts prop — shows a small badge with unread count (opt-in).

import { useState, useEffect, useCallback, useRef } from 'react';
import apiRequest   from '../../utils/apiRequest';
import StatusViewer from './StatusViewer';
import './Status.css';

export default function ChatListStatusAvatar({
  userId,
  name,
  avatarUrl,
  size          = 48,
  className     = '',
  currentUserId,
  fallbackRender = null,
  showCount      = false,   // show unread-count badge
}) {
  const [statuses,  setStatuses]  = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [open,      setOpen]      = useState(false);
  const [fetched,   setFetched]   = useState(false);
  const [shimmer,   setShimmer]   = useState(false);

  const wrapRef = useRef(null);

  // Intersection Observer — fetch only when visible
  const loadStatuses = useCallback(async () => {
    if (!userId || fetched) return;
    setShimmer(true);
    try {
      const res  = await apiRequest.get('/api/status/feed', { _silenceToast: true });
      const feed = res.data?.feed ?? [];
      const entry = feed.find(e => e.user._id === userId);
      setStatuses(entry?.statuses ?? []);
      setHasUnread(entry?.hasUnread ?? false);
    } catch {
      /* fail silently — plain avatar */
    } finally {
      setFetched(true);
      setShimmer(false);
    }
  }, [userId, fetched]);

  useEffect(() => {
    if (!wrapRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadStatuses(); },
      { threshold: 0.1 }
    );
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, [loadStatuses]);

  const handleClick = (e) => {
    if (!statuses.length) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const hasSt = statuses.length > 0;
  const px    = typeof size === 'number' ? size : 48;
  const unreadCount = statuses.filter(s => !s.views?.some(
    v => (v.viewer?._id ?? v.viewer) === currentUserId
  )).length;

  const wrapClass = [
    'status-avatar-wrap',
    hasSt ? 'has-status' : '',
    hasSt && hasUnread ? 'unread' : '',
    shimmer ? 'shimmer' : '',
    className,
  ].filter(Boolean).join(' ');

  // Generate initials fallback
  const initials = (name ?? 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div
        ref={wrapRef}
        className={wrapClass}
        style={{ width: px, height: px, fontSize: px * 0.37, position: 'relative' }}
        onClick={handleClick}
        title={hasSt ? `${name}'s status` : undefined}
        role={hasSt ? 'button' : undefined}
        tabIndex={hasSt ? 0 : undefined}
        onKeyDown={hasSt ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e); } : undefined}
        aria-label={hasSt ? `View ${name}'s status` : undefined}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} />
        ) : fallbackRender ? (
          <div className="status-avatar-fallback">{fallbackRender}</div>
        ) : (
          <div className="status-avatar-fallback">{initials}</div>
        )}

        {/* Unread count badge */}
        {showCount && hasUnread && unreadCount > 0 && (
          <span
            style={{
              position:   'absolute',
              top:         -2,
              right:       -2,
              width:        18,
              height:       18,
              borderRadius: '50%',
              background:  'var(--s-teal)',
              color:        '#000',
              fontSize:     10,
              fontWeight:   700,
              display:     'flex',
              alignItems:  'center',
              justifyContent: 'center',
              border:      '2px solid var(--s-bg)',
              zIndex:       3,
              fontFamily:  'var(--s-font)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </div>

      {open && statuses.length > 0 && (
        <StatusViewer
          entries={[{
            user: {
              _id:           userId,
              name:          name ?? 'User',
              profileavatar: { URL: avatarUrl ?? '' }
            },
            statuses,
            hasUnread
          }]}
          startIndex={0}
          currentUserId={currentUserId}
          onClose={() => { setOpen(false); setFetched(false); }}
        />
      )}
    </>
  );
}