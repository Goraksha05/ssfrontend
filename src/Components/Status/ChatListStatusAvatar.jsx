// src/components/Status/ChatListStatusAvatar.jsx

import { useState, useEffect, useCallback } from 'react';
import apiRequest   from '../../utils/apiRequest';
import StatusViewer from './StatusViewer';
import './Status.css';

export default function ChatListStatusAvatar({
  userId,
  name,
  avatarUrl,
  size          = 48,   // px directly (no Tailwind multiplier)
  className     = '',
  currentUserId,
  fallbackRender = null,
}) {
  const [statuses,  setStatuses]  = useState([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [open,      setOpen]      = useState(false);
  const [fetched,   setFetched]   = useState(false);

  const loadStatuses = useCallback(async () => {
    if (!userId || fetched) return;
    try {
      const res  = await apiRequest.get('/api/status/feed', { _silenceToast: true });
      const feed = res.data?.feed ?? [];
      const entry = feed.find(e => e.user._id === userId);
      setStatuses(entry?.statuses ?? []);
      setHasUnread(entry?.hasUnread ?? false);
    } catch {
      /* fail silently — plain avatar shown */
    } finally {
      setFetched(true);
    }
  }, [userId, fetched]);

  useEffect(() => { loadStatuses(); }, [loadStatuses]);

  const handleClick = (e) => {
    if (!statuses.length) return;
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  };

  const hasSt = statuses.length > 0;
  const px    = typeof size === 'number' ? size : 48;

  const wrapClass = [
    'status-avatar-wrap',
    hasSt ? 'has-status' : '',
    hasSt && hasUnread ? 'unread' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <>
      <div
        className={wrapClass}
        style={{ width: px, height: px, fontSize: px * 0.37 }}
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
          <img
            src={`https://ui-avatars.com/api/?name=${encodeURIComponent(name ?? 'U')}&background=random&size=${px}`}
            alt={name}
          />
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