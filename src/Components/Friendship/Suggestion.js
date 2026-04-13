// Suggestion.js — Render-optimised
//
// OPTIMISATIONS (this pass):
//
//  1.  SuggestionCard extracted as React.memo.
//      The card grid previously re-rendered every card on every pendingId
//      change (sending one request caused every other card to re-render).
//      Now only the card whose isSending or alreadySent flag changed updates.
//
//  2.  handleConnect wrapped in useCallback.
//      Was a plain async arrow (not memoised at all), recreated on every
//      render. Stable reference is required to honour the memo boundary on
//      SuggestionCard (#1).
//      Note: sentIds and pendingId are accessed via refs inside the callback
//      so the dep array stays [sendRequest] and the callback is never
//      needlessly recreated when transient in-flight state changes.
//
//  3.  sentIds / pendingId guard logic moved to refs inside handleConnect.
//      Using refs for the guard (rather than closure over state) means the
//      callback doesn't need sentIds or pendingId in its dep array, which
//      would force recreation on every send. The Set and the current
//      pendingId are always read from their refs at call time.
//
//  4.  validSuggestions and paginated derived via useMemo.
//      Array validation + slice ran on every render including those triggered
//      by pendingId / sentIds changes. Now only reruns when suggestions or
//      page changes.
//
//  5.  toStr helper moved to module scope (was already at the bottom of the
//      file but after the component — hoisted above it to make the
//      dependency obvious).
//
//  6.  ConnectBtn backgroundImage style object extracted to module-scope
//      constant so it is not re-created on every render of every card.
//
//  7.  SkeletonCard already defined outside component — correct, no change.
//      SKELETON_GRID extracted as a module-scope constant (fixed-length
//      array rendered once, never recreated).
//
//  8.  Pagination onClick handlers wrapped in useCallback.
//      `() => setPage(p => Math.max(1, p - 1))` etc. were new arrows on
//      every render.

import React, { useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';
import ConnectBtn from '../../Assets/RectaAcceptBtn.png';

/* ── Optimisation #5 — module-scope helper ───────────────────────────────── */
function toStr(id) {
  return id?.toString?.() ?? String(id ?? '');
}

/* ── Optimisation #6 — module-scope stable style ─────────────────────────── */
const CONNECT_BTN_STYLE = { backgroundImage: `url(${ConnectBtn})` };

const PER_PAGE = 6;

/* ── Skeleton (already module-scope — confirmed correct) ─────────────────── */
const SkeletonCard = () => (
  <div className="sg-skeleton-card">
    <div className="sg-skeleton-circle" />
    <div className="sg-skeleton-line" style={{ width: '70%' }} />
    <div className="sg-skeleton-line" style={{ width: '50%' }} />
    <div className="sg-skeleton-btn" />
  </div>
);

/* ── Optimisation #7 — module-scope skeleton grid constant ───────────────── */
const SKELETON_GRID = (
  <div className="sg-grid">
    {Array.from({ length: PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)}
  </div>
);

/* ── Optimisation #1 — memo'd per-card component ──────────────────────────── */
const SuggestionCard = React.memo(({ user, isSending, alreadySent, onConnect }) => {
  const loc       = user.currentcity || user.hometown || '';
  const userId    = toStr(user._id);
  const avatarSrc = user.profileavatar?.URL ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b4fd8&color=fff`;

  return (
    <div className="sg-suggestion-card">
      <img
        src={avatarSrc}
        alt={user.name}
        className="sg-avatar"
        loading="lazy"
        onError={(e) => {
          e.target.onerror = null;
          e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b4fd8&color=fff`;
        }}
      />
      <p className="sg-name" title={user.name}>{user.name}</p>
      {loc && <p className="sg-location" title={loc}>📍 {loc}</p>}
      {user.mutualFriendsCount > 0 && (
        <p className="sg-mutual">
          {user.mutualFriendsCount} mutual{' '}
          {user.mutualFriendsCount === 1 ? 'friend' : 'friends'}
        </p>
      )}
      {alreadySent ? (
        <button className="sg-sent-btn" disabled>Request Sent</button>
      ) : (
        <button
          className={`sg-connect-btn${isSending ? ' sg-connect-btn--sending' : ''}`}
          onClick={() => onConnect(userId, user.name)}
          disabled={isSending}
          aria-label={`Send friend request to ${user.name}`}
          style={CONNECT_BTN_STYLE}
        >
          <span className="sg-connect-btn-label">{isSending ? '…' : '+ Connect'}</span>
        </button>
      )}
    </div>
  );
});

/* ── Main component ──────────────────────────────────────────────────────── */
const Suggestion = () => {
  const { suggestions = [], suggestionsLoading, fetchSuggestions, sendRequest } = useFriend();
  const navigate    = useNavigate();
  const [page,      setPage]      = useState(1);
  const [sentIds,   setSentIds]   = useState(new Set());
  const [pendingId, setPendingId] = useState(null);

  // Optimisation #3 — refs let the callback read live state without being in
  // the dep array, keeping handleConnect identity stable.
  const pendingIdRef = useRef(null);
  const sentIdsRef   = useRef(sentIds);
  pendingIdRef.current = pendingId;
  sentIdsRef.current   = sentIds;

  /* ── Optimisation #4 — memoised list derivation ─────────────────────── */
  const validSuggestions = useMemo(
    () => (Array.isArray(suggestions) ? suggestions.filter(s => s?._id) : []),
    [suggestions],
  );

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(validSuggestions.length / PER_PAGE)),
    [validSuggestions.length],
  );

  const paginated = useMemo(
    () => validSuggestions.slice((page - 1) * PER_PAGE, page * PER_PAGE),
    [validSuggestions, page],
  );

  /* ── Optimisation #8 — stable pagination handlers ────────────────────── */
  const handlePrevPage = useCallback(() => setPage(p => Math.max(1, p - 1)), []);
  const handleNextPage = useCallback(
    () => setPage(p => Math.min(totalPages, p + 1)),
    [totalPages],
  );

  const handleRefresh = useCallback(() => {
    fetchSuggestions();
    setPage(1);
  }, [fetchSuggestions]);

  /* ── Optimisation #2/#3 — stable connect handler via refs ───────────── */
  const handleConnect = useCallback(async (userId, name) => {
    if (pendingIdRef.current || sentIdsRef.current.has(userId)) return;
    setPendingId(userId);
    try {
      const res = await sendRequest(userId);
      if (res?.status === 'success') {
        setSentIds(prev => new Set(prev).add(userId));
        toast.success(`Friend request sent to ${name}!`);
      } else {
        toast.error(res?.message || 'Could not send request.');
      }
    } catch {
      toast.error('Something went wrong.');
    } finally {
      setPendingId(null);
    }
  }, [sendRequest]);

  return (
    <div className="sg-page">
      <div className="sg-card">

        {/* Header */}
        <div className="sg-header">
          <button
            className="sg-icon-btn"
            onClick={handleRefresh}
            title="Refresh suggestions"
            aria-label="Refresh suggestions"
          >
            ↺
          </button>
          <h2 className="sg-title">People You May Know</h2>
          <button
            className="sg-icon-btn"
            onClick={() => navigate('/')}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Grid */}
        {suggestionsLoading ? (
          SKELETON_GRID /* Optimisation #7 — constant, not recreated */
        ) : validSuggestions.length === 0 ? (
          <div className="sg-empty">
            <span className="sg-empty-icon">🌐</span>
            No suggestions right now. Check back later!
          </div>
        ) : (
          <div className="sg-grid">
            {paginated.map(user => (
              <SuggestionCard
                key={toStr(user._id)}
                user={user}
                isSending={pendingId === toStr(user._id)}
                alreadySent={sentIds.has(toStr(user._id))}
                onConnect={handleConnect}
              />
            ))}
          </div>
        )}

        {/* Pagination — Optimisation #8 */}
        {!suggestionsLoading && totalPages > 1 && (
          <div className="sg-pagination">
            <button
              className="sg-page-btn"
              onClick={handlePrevPage}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span className="sg-page-info">Page {page} of {totalPages}</span>
            <button
              className="sg-page-btn"
              onClick={handleNextPage}
              disabled={page >= totalPages}
              aria-label="Next page"
            >
              Next →
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Suggestion;