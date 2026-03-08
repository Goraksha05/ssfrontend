// src/components/Status/StatusTab.jsx

import { useState, useEffect } from 'react';
import { useStatus }  from '../../Context/StatusContext';
import StatusViewer   from './StatusViewer';
import StatusComposer from './StatusComposer';
import './Status.css';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Ring avatar purely via CSS classes
function RingAvatar({ src, name, hasUnread, size = 48 }) {
  const cls = ['status-ring-avatar', hasUnread ? 'unread' : 'seen'].join(' ');
  return (
    <div className={cls} style={{ width: size, height: size }}>
      <img
        src={src || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&size=${size}`}
        alt={name}
      />
    </div>
  );
}

export default function StatusTab({ currentUser }) {
  const { feed, myStatuses, feedLoading, fetchFeed, fetchMyStatuses, deleteStatus } = useStatus();

  const [viewerState,  setViewerState]  = useState(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [myMenuOpen,   setMyMenuOpen]   = useState(false);

  useEffect(() => {
    fetchFeed();
    fetchMyStatuses();
  }, []); // eslint-disable-line

  const openMyStatuses = () => {
    if (!myStatuses.length) { setComposerOpen(true); return; }
    setViewerState({
      entries: [{
        user: {
          _id:           currentUser._id,
          name:          currentUser.name,
          profileavatar: currentUser.profileavatar ?? { URL: '' }
        },
        statuses:  myStatuses,
        hasUnread: false
      }],
      startIndex: 0
    });
  };

  const openContactStatus = (idx) => setViewerState({ entries: feed, startIndex: idx });

  const handleDeleteLatest = async () => {
    if (!myStatuses.length) return;
    await deleteStatus(myStatuses[0]._id);
    setMyMenuOpen(false);
  };

  return (
    <div className="status-tab">

      {/* ── My status ────────────────────────────────────────────── */}
      <div style={{ padding: '4px 8px 0', flexShrink: 0 }}>
        <div
          className="status-tab__my-row"
          onClick={openMyStatuses}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') openMyStatuses(); }}
        >
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <RingAvatar
              src={currentUser.profileavatar?.URL}
              name={currentUser.name}
              hasUnread={myStatuses.length > 0}
              size={48}
            />
            <button
              className="status-tab__add-btn"
              onClick={e => { e.stopPropagation(); setComposerOpen(true); }}
              title="Add status"
              aria-label="Add status"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>

          {/* Text */}
          <div className="status-tab__my-info">
            <p className="status-tab__my-name">My status</p>
            <p className="status-tab__my-sub">
              {myStatuses.length === 0
                ? 'Tap to add status update'
                : `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} · ${timeAgo(myStatuses[0].createdAt)}`
              }
            </p>
          </div>

          {/* 3-dot menu */}
          {myStatuses.length > 0 && (
            <button
              className="status-tab__menu-btn"
              onClick={e => { e.stopPropagation(); setMyMenuOpen(v => !v); }}
              aria-label="Status options"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5"  r="1.5" />
                <circle cx="12" cy="12" r="1.5" />
                <circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          )}

          {/* Dropdown */}
          {myMenuOpen && (
            <div className="status-tab__dropdown">
              <button onClick={() => { setMyMenuOpen(false); setComposerOpen(true); }}>
                Add new status
              </button>
              <button className="danger" onClick={handleDeleteLatest}>
                Delete latest
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="status-tab__divider" />

      {/* ── Feed ────────────────────────────────────────────────── */}
      <div className="status-tab__feed">
        {feedLoading && <div className="status-tab__spinner" />}

        {!feedLoading && feed.length === 0 && (
          <div className="status-tab__empty">
            <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>No recent updates from contacts</p>
          </div>
        )}

        {!feedLoading && feed.length > 0 && (
          <>
            <p className="status-tab__section-label">Recent updates</p>
            {feed.map((entry, idx) => (
              <button
                key={entry.user._id}
                className="status-tab__contact-row"
                onClick={() => openContactStatus(idx)}
              >
                <RingAvatar
                  src={entry.user.profileavatar?.URL}
                  name={entry.user.name}
                  hasUnread={entry.hasUnread}
                  size={44}
                />
                <div className="status-tab__contact-info">
                  <p className="status-tab__contact-name">{entry.user.name}</p>
                  <p className={`status-tab__contact-time ${entry.hasUnread ? 'unread' : ''}`}>
                    {timeAgo(entry.latestAt ?? entry.statuses[0]?.createdAt)}
                  </p>
                </div>
                {entry.hasUnread && <span className="status-tab__unread-dot" />}
              </button>
            ))}
          </>
        )}
      </div>

      {/* ── Modals ──────────────────────────────────────────────── */}
      {composerOpen && (
        <StatusComposer onClose={() => { setComposerOpen(false); fetchMyStatuses(); }} />
      )}
      {viewerState && (
        <StatusViewer
          entries={viewerState.entries}
          startIndex={viewerState.startIndex}
          currentUserId={currentUser._id}
          onClose={() => { setViewerState(null); fetchFeed(); fetchMyStatuses(); }}
        />
      )}
    </div>
  );
}