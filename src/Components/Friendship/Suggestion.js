import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';
import ConnectBtn from '../../Assets/RectaAcceptBtn.png';
import './Suggestion.css';

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="sg-skeleton-card">
    <div className="sg-skeleton-circle" />
    <div className="sg-skeleton-line" style={{ width: '70%' }} />
    <div className="sg-skeleton-line" style={{ width: '50%' }} />
    <div className="sg-skeleton-btn" />
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const PER_PAGE = 6;

const Suggestion = () => {
  const { suggestions = [], suggestionsLoading, fetchSuggestions, sendRequest } = useFriend();
  const navigate = useNavigate();
  const [page, setPage]       = useState(1);
  const [sentIds, setSentIds] = useState(new Set());
  const [pendingId, setPendingId] = useState(null);

  const validSuggestions = Array.isArray(suggestions)
    ? suggestions.filter(s => s?._id)
    : [];

  const totalPages = Math.max(1, Math.ceil(validSuggestions.length / PER_PAGE));
  const paginated  = validSuggestions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleRefresh = useCallback(() => {
    fetchSuggestions();
    setPage(1);
  }, [fetchSuggestions]);

  const handleConnect = async (userId, name) => {
    if (pendingId || sentIds.has(userId)) return;
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
  };

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
          <div className="sg-grid">
            {Array.from({ length: PER_PAGE }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : validSuggestions.length === 0 ? (
          <div className="sg-empty">
            <span className="sg-empty-icon">🌐</span>
            No suggestions right now. Check back later!
          </div>
        ) : (
          <div className="sg-grid">
            {paginated.map(user => {
              const loc         = user.currentcity || user.hometown || '';
              const userId      = toStr(user._id);
              const alreadySent = sentIds.has(userId);
              const isSending   = pendingId === userId;
              const avatarSrc   = user.profileavatar?.URL ||
                `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b4fd8&color=fff`;

              return (
                <div key={user._id} className="sg-suggestion-card">
                  <img
                    src={avatarSrc}
                    alt={user.name}
                    className="sg-avatar"
                    loading="lazy"
                    onError={e => {
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
                      className={`sg-connect-btn ${isSending ? 'sg-connect-btn--sending' : ''}`}
                      onClick={() => handleConnect(userId, user.name)}
                      disabled={isSending}
                      aria-label={`Send friend request to ${user.name}`}
                      style={{ backgroundImage: `url(${ConnectBtn})` }}
                    >
                      <span className="sg-connect-btn-label">
                        {isSending ? '…' : '+ Connect'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!suggestionsLoading && totalPages > 1 && (
          <div className="sg-pagination">
            <button
              className="sg-page-btn"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              ← Prev
            </button>
            <span className="sg-page-info">
              Page {page} of {totalPages}
            </span>
            <button
              className="sg-page-btn"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
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

function toStr(id) {
  return id?.toString?.() ?? String(id ?? '');
}

export default Suggestion;