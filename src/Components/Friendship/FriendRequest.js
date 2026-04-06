import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AcceptBtn from '../../Assets/RectaAcceptBtn.png';
import RejectBtn from '../../Assets/RectaRejectBtn.png';

dayjs.extend(relativeTime);

// ── Skeleton row ──────────────────────────────────────────────────────────────
const SkeletonRow = () => (
  <li className="fr-skeleton-item">
    <div className="fr-skeleton-circle" />
    <div style={{ flex: 1 }}>
      <div className="fr-skeleton-line" style={{ width: '55%' }} />
      <div className="fr-skeleton-line" style={{ width: '35%' }} />
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="fr-skeleton-btn" />
      <div className="fr-skeleton-btn" />
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
    <div className="fr-page">
      <div className="fr-card">

        {/* Header */}
        <div className="fr-header">
          <button
            className="fr-icon-btn"
            onClick={fetchRequests}
            title="Refresh requests"
            aria-label="Refresh requests"
          >
            ↺
          </button>
          <h2 className="fr-title">
            Friend Requests
            {validRequests.length > 0 && (
              <span
                className="fr-badge"
                aria-label={`${validRequests.length} pending requests`}
              >
                {validRequests.length}
              </span>
            )}
          </h2>
          <button
            className="fr-icon-btn"
            onClick={() => navigate('/')}
            title="Close"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Subtext */}
        {!requestsLoading && validRequests.length > 0 && (
          <p className="fr-subtext">
            You have {validRequests.length} pending friend{' '}
            {validRequests.length === 1 ? 'request' : 'requests'}
          </p>
        )}

        {/* List */}
        {requestsLoading ? (
          <ul className="fr-list">
            {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
          </ul>
        ) : validRequests.length === 0 ? (
          <div className="fr-empty">
            <span className="fr-empty-icon">🙌</span>
            No pending friend requests.
          </div>
        ) : (
          <ul className="fr-list">
            {validRequests.map(req => {
              const { _id: requestId, requester, createdAt, updatedAt } = req;
              const isProcessing = processingId === requestId;
              const timestamp    = dayjs(createdAt || updatedAt || new Date()).fromNow();
              const image        = requester.profileImage || '';

              return (
                <li key={requestId} className="fr-item">
                  <img
                    src={
                      image ||
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(requester.name)}&background=3b4fd8&color=fff`
                    }
                    alt={requester.name}
                    className="fr-avatar"
                    loading="lazy"
                    onError={e => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(requester.name)}&background=3b4fd8&color=fff`;
                    }}
                  />
                  <div className="fr-info">
                    <p className="fr-name">{requester.name}</p>
                    <p className="fr-time">{timestamp}</p>
                  </div>
                  <div className="fr-actions">
                    <button
                      onClick={() => handleAccept(requestId)}
                      disabled={isProcessing}
                      className={`fr-accept-btn ${isProcessing ? 'fr-btn--processing' : ''}`}
                      aria-label={`Accept request from ${requester.name}`}
                      style={{ backgroundImage: `url(${AcceptBtn})` }}
                    >
                      <span className="fr-btn-label">
                        {isProcessing ? '…' : 'Accept'}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDecline(requestId)}
                      disabled={isProcessing}
                      className={`fr-decline-btn ${isProcessing ? 'fr-btn--processing' : ''}`}
                      aria-label={`Decline request from ${requester.name}`}
                      style={{ backgroundImage: `url(${RejectBtn})` }}
                    >
                      <span className="fr-btn-label">
                        {isProcessing ? '…' : 'Decline'}
                      </span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FriendRequest;