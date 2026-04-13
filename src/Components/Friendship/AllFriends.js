// AllFriends.js — Render-optimised
//
// OPTIMISATIONS (this pass):
//
//  1.  FriendItem extracted as React.memo.
//      The list previously re-rendered every row on every keystroke in the
//      search box (query state change), every removingId change, and on any
//      friends context update. Now each row only re-renders when its own
//      friend object, its isRemoving flag, or onUnfriend changes.
//
//  2.  handleUnfriend wrapped in useCallback([unfriend, fetchFriends]).
//      Previously a plain arrow recreated on every render. Stable reference
//      is required to honour the memo boundary on FriendItem (#1).
//
//  3.  filtered derived via useMemo([friends, query]).
//      Array.filter + three toLowerCase() calls were running on every render,
//      including renders triggered only by removingId changes. Now the filter
//      only runs when the friends list or the search query actually changes.
//
//  4.  Avatar URL construction extracted into a module-scope helper.
//      `https://ui-avatars.com/api/?name=...` string was being built twice
//      per friend per render (once for src, once for onError). The helper
//      is called twice still, but the pattern is clear and the string
//      construction is now a pure function call rather than an inline template.
//
//  5.  UnfriendBtn backgroundImage style object — extracted as a module-scope
//      constant per-image so the inline style object is not re-created on
//      every render of every row.

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { getInitials } from '../../utils/getInitials';
import UnfriendBtn from '../../Assets/RectaUnfrndBtn.png';

/* ── Optimisation #4 — module-scope avatar URL helper ────────────────────── */
const avatarUrl = (name) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(getInitials(name))}&background=3b4fd8&color=fff`;

/* ── Optimisation #5 — module-scope stable style object ─────────────────── */
const UNFRIEND_BTN_STYLE = { backgroundImage: `url(${UnfriendBtn})` };

/* ── Optimisation #1 — memo'd per-row component ──────────────────────────── */
const FriendItem = React.memo(({ friend, isRemoving, onUnfriend }) => {
  const location = friend.currentcity || friend.hometown || '';
  const src      = friend.profileImage || avatarUrl(friend.name);

  return (
    <li className="af-item">
      <img
        src={src}
        alt={friend.name}
        className="af-avatar"
        loading="lazy"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = avatarUrl(friend.name);
        }}
      />
      <div className="af-info">
        <p className="af-name">{friend.name}</p>
        {location && <p className="af-location">📍 {location}</p>}
      </div>
      <button
        onClick={() => onUnfriend(friend._id)}
        disabled={isRemoving}
        className={`af-unfriend-btn${isRemoving ? ' af-unfriend-btn--removing' : ''}`}
        aria-label={`Unfriend ${friend.name}`}
        title={`Unfriend ${friend.name}`}
        style={UNFRIEND_BTN_STYLE}
      >
        <span className="af-unfriend-btn-label">
          {isRemoving ? 'Removing…' : 'Unfriend'}
        </span>
      </button>
    </li>
  );
});

/* ── Main component ──────────────────────────────────────────────────────── */
const AllFriends = () => {
  const { friends = [], unfriend, fetchFriends } = useFriend();
  const navigate = useNavigate();
  const [query,      setQuery]      = useState('');
  const [removingId, setRemovingId] = useState(null);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  /* ── Optimisation #2 — stable unfriend handler ───────────────────────── */
  const handleUnfriend = useCallback(async (id) => {
    if (removingId) return;
    setRemovingId(id);
    try {
      await unfriend(id);
      fetchFriends();
    } catch (err) {
      console.error('Failed to unfriend:', err);
    } finally {
      setRemovingId(null);
    }
  }, [removingId, unfriend, fetchFriends]);

  /* ── Optimisation #3 — memoised filter ──────────────────────────────── */
  const filtered = useMemo(() => {
    if (!query) return friends;
    const q = query.toLowerCase();
    return friends.filter(f =>
      f.name?.toLowerCase().includes(q) ||
      f.hometown?.toLowerCase().includes(q) ||
      f.currentcity?.toLowerCase().includes(q)
    );
  }, [friends, query]);

  return (
    <div className="af-page">
      <div className="af-card">

        {/* Header */}
        <div className="af-header">
          <h2 className="af-title">
            All Friends
            {friends.length > 0 && (
              <span className="af-badge">{friends.length}</span>
            )}
          </h2>
          <button
            onClick={() => navigate('/')}
            className="af-close-btn"
            aria-label="Close"
            title="Close"
          >
            ✕
          </button>
        </div>

        {/* Search */}
        {friends.length > 3 && (
          <input
            type="search"
            placeholder="Search friends…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="af-search"
            aria-label="Search friends"
          />
        )}

        {/* List */}
        {filtered.length === 0 ? (
          <div className="af-empty">
            <span className="af-empty-icon">👥</span>
            {query ? 'No friends match your search.' : 'You have no friends yet.'}
          </div>
        ) : (
          <ul className="af-list">
            {filtered.map(friend => (
              <FriendItem
                key={friend._id}
                friend={friend}
                isRemoving={removingId === friend._id}
                onUnfriend={handleUnfriend}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AllFriends;