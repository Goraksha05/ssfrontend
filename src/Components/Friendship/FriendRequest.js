import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

// ── Inline styles ─────────────────────────────────────────────────────────────
const styles = {
  page: {
    minHeight: '50vh',
    background: 'linear-gradient(135deg, #f0f4ff 0%, #fafaff 100%)',
    padding: '12px 12px 32px',
    boxSizing: 'border-box',
  },
  card: {
    maxWidth: 600,
    margin: '0 auto',
    background: '#ffffff',
    borderRadius: 20,
    boxShadow: '0 4px 24px rgba(80,80,160,0.10)',
    padding: '24px 20px',
    position: 'relative',
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
    fontSize: 20,
    fontWeight: 700,
    color: '#3b4fd8',
    margin: 0,
    flex: 1,
    textAlign: 'center',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 22,
    height: 22,
    padding: '0 6px',
    borderRadius: 11,
    background: '#e8382d',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
    lineHeight: 1,
    animation: 'badgePop 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
  },
  subtext: {
    textAlign: 'center',
    fontSize: 12,
    color: '#888',
    marginBottom: 16,
    marginTop: -12,
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
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#f8f9ff',
    borderRadius: 14,
    padding: '12px 14px',
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
    border: '2px solid #e0e4ff',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontWeight: 700,
    fontSize: 15,
    color: '#1a1d3a',
    margin: 0,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  time: {
    fontSize: 11,
    color: '#aaa',
    margin: '2px 0 0',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    flexShrink: 0,
  },
  acceptBtn: {
    background: '#3b4fd8',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background 0.15s, opacity 0.15s',
    whiteSpace: 'nowrap',
  },
  declineBtn: {
    background: 'none',
    border: '1.5px solid #ffcdd2',
    borderRadius: 8,
    padding: '6px 14px',
    fontSize: 13,
    fontWeight: 600,
    color: '#c62828',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    whiteSpace: 'nowrap',
  },
  // Skeleton shimmer
  skeletonItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    background: '#f0f2ff',
    borderRadius: 14,
    padding: '12px 14px',
    animation: 'pulse 1.4s ease-in-out infinite',
  },
  skeletonCircle: {
    width: 52,
    height: 52,
    borderRadius: '50%',
    background: '#dde0f5',
    flexShrink: 0,
  },
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    background: '#dde0f5',
    marginBottom: 6,
  },
};

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <li style={styles.skeletonItem}>
    <div style={styles.skeletonCircle} />
    <div style={{ flex: 1 }}>
      <div style={{ ...styles.skeletonLine, width: '55%' }} />
      <div style={{ ...styles.skeletonLine, width: '35%', marginBottom: 0 }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ ...styles.skeletonLine, width: 70, height: 30, marginBottom: 0 }} />
      <div style={{ ...styles.skeletonLine, width: 70, height: 30, marginBottom: 0 }} />
    </div>
  </li>
);

// ── Component ─────────────────────────────────────────────────────────────────
const FriendRequest = () => {
  const {
    requests = [],
    acceptRequest,
    declineRequest,
    fetchRequests,
    fetchFriends,
    requestsLoading,
  } = useFriend();

  const navigate = useNavigate();
  const [processingId, setProcessingId] = React.useState(null);

  const handleAccept = async (requestId) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      await acceptRequest(requestId);
      await Promise.all([fetchRequests(), fetchFriends()]);
      toast.success('Friend request accepted!');
    } catch {
      toast.error('Failed to accept request.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDecline = async (requestId) => {
    if (processingId) return;
    setProcessingId(requestId);
    try {
      await declineRequest(requestId);
      await fetchRequests();
      toast.info('Friend request declined.');
    } catch {
      toast.error('Failed to decline request.');
    } finally {
      setProcessingId(null);
    }
  };

  const validRequests = Array.isArray(requests)
    ? requests.filter(r => r?.requester?._id && r?.requester?.name)
    : [];

  return (
    <>
      {/* Shimmer keyframe — injected once */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.55; }
        }
        @keyframes badgePop {
          0%   { transform: scale(0.5); opacity: 0; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <div style={styles.page}>
        <div style={styles.card}>
          {/* Header */}
          <div style={styles.header}>
            <button
              style={styles.iconBtn}
              onClick={fetchRequests}
              title="Refresh requests"
              aria-label="Refresh requests"
            >
              ↺
            </button>
            <h2 style={styles.title}>
              Friend Requests
              {validRequests.length > 0 && (
                <span style={styles.badge} aria-label={`${validRequests.length} pending requests`}>
                  {validRequests.length}
                </span>
              )}
            </h2>
            <button
              style={styles.iconBtn}
              onClick={() => navigate('/')}
              title="Close"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          {!requestsLoading && validRequests.length > 0 && (
            <p style={styles.subtext}>
              You have {validRequests.length} pending friend {validRequests.length === 1 ? 'request' : 'requests'}
            </p>
          )}
          {/* List */}
          {requestsLoading ? (
            <ul style={styles.list}>
              {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
            </ul>
          ) : validRequests.length === 0 ? (
            <div style={styles.empty}>
              <span style={styles.emptyIcon}>🙌</span>
              No pending friend requests.
            </div>
          ) : (
            <ul style={styles.list}>
              {validRequests.map(req => {
                const { _id: requestId, requester, createdAt, updatedAt } = req;
                const isProcessing = processingId === requestId;
                const timestamp = dayjs(createdAt || updatedAt || new Date()).fromNow();
                const image = requester.profileImage || '';

                return (
                  <li key={requestId} style={styles.item}>
                    <img
                      src={
                        image ||
                        `https://ui-avatars.com/api/?name=${encodeURIComponent(requester.name)}&background=3b4fd8&color=fff`
                      }
                      alt={requester.name}
                      style={styles.avatar}
                      loading="lazy"
                      onError={e => {
                        e.target.onerror = null;
                        e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(requester.name)}&background=3b4fd8&color=fff`;
                      }}
                    />
                    <div style={styles.info}>
                      <p style={styles.name}>{requester.name}</p>
                      <p style={styles.time}>{timestamp}</p>
                    </div>
                    <div style={styles.actions}>
                      <button
                        onClick={() => handleAccept(requestId)}
                        disabled={isProcessing}
                        style={{
                          ...styles.acceptBtn,
                          opacity: isProcessing ? 0.6 : 1,
                          cursor:  isProcessing ? 'not-allowed' : 'pointer',
                        }}
                        aria-label={`Accept request from ${requester.name}`}
                      >
                        {isProcessing ? '…' : 'Accept'}
                      </button>
                      <button
                        onClick={() => handleDecline(requestId)}
                        disabled={isProcessing}
                        style={{
                          ...styles.declineBtn,
                          opacity: isProcessing ? 0.6 : 1,
                          cursor:  isProcessing ? 'not-allowed' : 'pointer',
                        }}
                        aria-label={`Decline request from ${requester.name}`}
                      >
                        {isProcessing ? '…' : 'Decline'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
};

export default FriendRequest;