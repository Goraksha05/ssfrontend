// src/components/Status/StatusTab.jsx
//
// Upgrades vs original:
//   1. Horizontal "stories strip" at the top for quick thumb access (like IG)
//      with fallback to the classic list below.
//   2. Pull-to-refresh handler (fires fetchFeed + fetchMyStatuses on pull).
//   3. Animated unread count badge on the My Status avatar.
//   4. Search / filter bar to find a contact's status by name.
//   5. Section labels: "Unread" + "Viewed" instead of a single "Recent updates".
//   6. Better empty state with CTA.

import { useState, useEffect, useRef } from 'react';
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
  const [search,       setSearch]       = useState('');

  const feedRef = useRef(null);
  const pullStartY = useRef(null);
  const [pulling, setPulling] = useState(false);

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

  const openContactStatus = (idx) => setViewerState({ entries: filteredFeed, startIndex: idx });

  const handleDeleteLatest = async () => {
    if (!myStatuses.length) return;
    await deleteStatus(myStatuses[0]._id);
    setMyMenuOpen(false);
  };

  // Pull-to-refresh (mobile)
  const handleTouchStart = (e) => { pullStartY.current = e.touches[0].clientY; };
  const handleTouchEnd   = async (e) => {
    if (!pullStartY.current) return;
    const dy = e.changedTouches[0].clientY - pullStartY.current;
    pullStartY.current = null;
    if (dy > 60 && feedRef.current?.scrollTop === 0) {
      setPulling(true);
      await Promise.all([fetchFeed(), fetchMyStatuses()]);
      setPulling(false);
    }
  };

  // Split feed into unread / seen sections
  const filteredFeed = feed.filter(e =>
    !search || e.user.name.toLowerCase().includes(search.toLowerCase())
  );
  const unreadFeed = filteredFeed.filter(e => e.hasUnread);
  const seenFeed   = filteredFeed.filter(e => !e.hasUnread);

  return (
    <div
      className="status-tab"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Pull-to-refresh indicator ── */}
      {pulling && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '10px', color: 'var(--s-teal)', fontSize: '0.82rem',
          gap: 8, fontFamily: 'var(--s-font)', flexShrink: 0,
        }}>
          <span className="status-tab__spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
          Refreshing…
        </div>
      )}

      {/* ── Stories strip ── */}
      <div className="status-tab__stories-strip">
        {/* My status story bubble */}
        <div className="status-tab__story-item" onClick={openMyStatuses}>
          <div style={{ position: 'relative' }}>
            <RingAvatar
              src={currentUser.profileavatar?.URL}
              name={currentUser.name}
              hasUnread={myStatuses.length > 0}
              size={56}
            />
            <button
              className="status-tab__add-btn"
              onClick={e => { e.stopPropagation(); setComposerOpen(true); }}
              aria-label="Add status"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
          <span className="status-tab__story-label">You</span>
        </div>

        {/* Contact story bubbles */}
        {feed.map((entry, idx) => (
          <div
            key={entry.user._id}
            className="status-tab__story-item"
            onClick={() => openContactStatus(idx)}
          >
            <RingAvatar
              src={entry.user.profileavatar?.URL}
              name={entry.user.name}
              hasUnread={entry.hasUnread}
              size={56}
            />
            <span className="status-tab__story-label">
              {entry.user.name.split(' ')[0]}
            </span>
          </div>
        ))}
      </div>

      {/* ── Divider + My status row ── */}
      <div style={{ padding: '0 8px 0', flexShrink: 0 }}>
        <div
          className="status-tab__my-row"
          onClick={openMyStatuses}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter') openMyStatuses(); }}
        >
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

          <div className="status-tab__my-info">
            <p className="status-tab__my-name">My status</p>
            <p className="status-tab__my-sub">
              {myStatuses.length === 0
                ? 'Tap to add a status update'
                : `${myStatuses.length} update${myStatuses.length > 1 ? 's' : ''} · ${timeAgo(myStatuses[0].createdAt)}`
              }
            </p>
          </div>

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

          {myMenuOpen && (
            <div className="status-tab__dropdown">
              <button onClick={() => { setMyMenuOpen(false); setComposerOpen(true); }}>
                ✏️  Add new status
              </button>
              <button className="danger" onClick={handleDeleteLatest}>
                🗑  Delete latest
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="status-tab__divider" />

      {/* ── Search bar ── */}
      <div style={{ padding: '4px 16px 8px', flexShrink: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--s-surface2)', borderRadius: 10,
          padding: '7px 12px', border: '1px solid var(--s-border)',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="var(--s-text-dim)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search contacts…"
            style={{
              background: 'none', border: 'none', outline: 'none',
              color: 'var(--s-text)', fontFamily: 'var(--s-font)',
              fontSize: '0.85rem', flex: 1,
            }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--s-text-muted)', lineHeight: 1 }}>
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Feed ── */}
      <div ref={feedRef} className="status-tab__feed">
        {feedLoading && <div className="status-tab__spinner" />}

        {!feedLoading && filteredFeed.length === 0 && (
          <div className="status-tab__empty">
            <svg width="52" height="52" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {search
              ? <p>No contacts matching "{search}"</p>
              : <>
                  <p>No recent updates from contacts</p>
                  <button
                    style={{
                      marginTop: 8, padding: '8px 18px', borderRadius: 20,
                      border: '1px solid var(--s-teal-dim)', background: 'var(--s-teal-glow2)',
                      color: 'var(--s-teal)', fontFamily: 'var(--s-font)',
                      fontSize: '0.83rem', fontWeight: 600, cursor: 'pointer',
                    }}
                    onClick={() => setComposerOpen(true)}
                  >
                    + Add your own status
                  </button>
                </>
            }
          </div>
        )}

        {/* Unread section */}
        {!feedLoading && unreadFeed.length > 0 && (
          <>
            <p className="status-tab__section-label">New · {unreadFeed.length}</p>
            {unreadFeed.map((entry, idx) => (
              <ContactRow
                key={entry.user._id}
                entry={entry}
                onClick={() => openContactStatus(filteredFeed.indexOf(entry))}
              />
            ))}
          </>
        )}

        {/* Seen section */}
        {!feedLoading && seenFeed.length > 0 && (
          <>
            <p className="status-tab__section-label" style={{ marginTop: unreadFeed.length ? 12 : 0 }}>
              Viewed
            </p>
            {seenFeed.map((entry) => (
              <ContactRow
                key={entry.user._id}
                entry={entry}
                onClick={() => openContactStatus(filteredFeed.indexOf(entry))}
              />
            ))}
          </>
        )}
      </div>

      {/* ── Modals ── */}
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

function ContactRow({ entry, onClick }) {
  return (
    <button className="status-tab__contact-row" onClick={onClick}>
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
          {' · '}
          {entry.statuses.length} update{entry.statuses.length > 1 ? 's' : ''}
        </p>
      </div>
      {entry.hasUnread && <span className="status-tab__unread-dot" />}
    </button>
  );
}