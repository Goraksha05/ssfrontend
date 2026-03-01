import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '80vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafaff 100%)',
    padding: '12px 12px 32px',
    boxSizing: 'border-box',
  },
  card: {
    maxWidth: 680,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 4px 24px rgba(80,80,160,0.10)',
    padding: '24px 20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    borderBottom: '2px solid #eef0ff',
    paddingBottom: 14,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: '#3b4fd8',
    margin: 0,
    flex: 1,
    textAlign: 'center',
  },
  iconBtn: {
    background: 'none',
    border: '1.5px solid #e0e0e0',
    borderRadius: 8,
    width: 32,
    height: 32,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 15,
    color: '#666',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  empty: {
    textAlign: 'center',
    padding: '40px 0',
    color: '#aaa',
    fontSize: 15,
  },
  emptyIcon: {
    fontSize: 40,
    display: 'block',
    marginBottom: 8,
  },
  // Responsive grid: 2 columns on narrow, 3 on wide
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14,
  },
  suggestionCard: {
    background: '#f8f9ff',
    borderRadius: 16,
    padding: '18px 12px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    transition: 'box-shadow 0.15s',
    cursor: 'default',
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #dde0ff',
  },
  name: {
    fontWeight: 700,
    fontSize: 14,
    color: '#1a1d3a',
    margin: 0,
    textAlign: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  location: {
    fontSize: 11,
    color: '#999',
    margin: 0,
    textAlign: 'center',
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  mutual: {
    fontSize: 11,
    color: '#7b83d8',
    margin: 0,
    fontWeight: 600,
    textAlign: 'center',
  },
  connectBtn: {
    marginTop: 4,
    background: '#3b4fd8',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    transition: 'background 0.15s, opacity 0.15s',
  },
  sentBtn: {
    marginTop: 4,
    background: 'none',
    color: '#aaa',
    border: '1.5px solid #ddd',
    borderRadius: 8,
    padding: '6px 18px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'default',
    width: '100%',
  },
  paginationRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 20,
    borderTop: '1.5px solid #eef0ff',
    paddingTop: 16,
    flexWrap: 'wrap',
  },
  pageBtn: {
    background: '#3b4fd8',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  pageInfo: {
    fontSize: 13,
    color: '#999',
  },
  // Skeleton shimmer
  skeletonCard: {
    background: '#f0f2ff',
    borderRadius: 16,
    padding: '18px 12px 14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  skeletonCircle: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    background: '#dde0f5',
  },
  skeletonLine: {
    height: 11,
    borderRadius: 6,
    background: '#dde0f5',
  },
  skeletonBtn: {
    height: 32,
    borderRadius: 8,
    background: '#dde0f5',
    width: '100%',
    marginTop: 4,
  },
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div style={styles.skeletonCard}>
    <div style={styles.skeletonCircle} />
    <div style={{ ...styles.skeletonLine, width: '70%' }} />
    <div style={{ ...styles.skeletonLine, width: '50%' }} />
    <div style={styles.skeletonBtn} />
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────
const PER_PAGE = 6;

const Suggestion = () => {
  const { suggestions = [], suggestionsLoading, fetchSuggestions, sendRequest } = useFriend();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  // Track which user IDs have had a request sent this session
  const [sentIds, setSentIds] = useState(new Set());
  const [pendingId, setPendingId] = useState(null);

  const validSuggestions = Array.isArray(suggestions)
    ? suggestions.filter(s => s?._id)
    : [];

  const totalPages  = Math.max(1, Math.ceil(validSuggestions.length / PER_PAGE));
  const paginated   = validSuggestions.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.55; }
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <button
              style={styles.iconBtn}
              onClick={handleRefresh}
              title="Refresh suggestions"
              aria-label="Refresh suggestions"
            >
              ↺
            </button>
            <h2 style={styles.title}>People You May Know</h2>
            <button
              style={styles.iconBtn}
              onClick={() => navigate('/')}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Grid */}
          {suggestionsLoading ? (
            <div style={styles.grid}>
              {Array.from({ length: PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : validSuggestions.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}>🌐</span>
              No suggestions right now. Check back later!
            </div>
          ) : (
            <div style={styles.grid}>
              {paginated.map(user => {
                const loc = user.currentcity || user.hometown || '';
                const alreadySent = sentIds.has(toStr(user._id));
                const isSending   = pendingId === toStr(user._id);
                const avatarSrc   = user.profileavatar?.URL ||
                  `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b4fd8&color=fff`;

                return (
                  <div key={user._id} style={styles.suggestionCard}>
                    <img
                      src={avatarSrc}
                      alt={user.name}
                      style={styles.avatar}
                      loading="lazy"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=3b4fd8&color=fff`;
                      }}
                    />
                    <p style={styles.name} title={user.name}>{user.name}</p>
                    {loc && <p style={styles.location} title={loc}>📍 {loc}</p>}
                    {user.mutualFriendsCount > 0 && (
                      <p style={styles.mutual}>
                        {user.mutualFriendsCount} mutual {user.mutualFriendsCount === 1 ? 'friend' : 'friends'}
                      </p>
                    )}

                    {alreadySent ? (
                      <button style={styles.sentBtn} disabled>Request Sent</button>
                    ) : (
                      <button
                        style={{
                          ...styles.connectBtn,
                          opacity: isSending ? 0.6 : 1,
                          cursor:  isSending ? 'not-allowed' : 'pointer',
                        }}
                        onClick={() => handleConnect(toStr(user._id), user.name)}
                        disabled={isSending}
                        aria-label={`Send friend request to ${user.name}`}
                      >
                        {isSending ? '…' : '+ Connect'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pagination */}
          {!suggestionsLoading && totalPages > 1 && (
            <div style={styles.paginationRow}>
              <button
                style={{ ...styles.pageBtn, opacity: page <= 1 ? 0.4 : 1 }}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Previous page"
              >
                ← Prev
              </button>
              <span style={styles.pageInfo}>
                Page {page} of {totalPages}
              </span>
              <button
                style={{ ...styles.pageBtn, opacity: page >= totalPages ? 0.4 : 1 }}
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
    </>
  );
};

// Local helper since it's a frontend-only file
function toStr(id) {
  return id?.toString?.() ?? String(id ?? '');
}

export default Suggestion;