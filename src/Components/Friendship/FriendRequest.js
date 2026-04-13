// FriendRequest.js — Render-optimised
//
// OPTIMISATIONS (this pass):
//
//  1.  RequestItem extracted as React.memo.
//      Previously the entire list re-rendered on every processingId change
//      (e.g. accepting/declining one request caused every other row to
//      re-render). Now only the row whose isProcessing flag changed updates.
//
//  2.  handleAccept and handleDecline wrapped in useCallback.
//      Were previously plain arrows inside the component, recreated on every
//      render. Stable references are required to honour the memo boundary on
//      RequestItem (#1).
//
//  3.  validRequests derived via useMemo([requests]).
//      The Array.isArray guard + filter ran on every render including those
//      triggered by processingId changes. Now only reruns when `requests`
//      changes.
//
//  4.  Avatar style objects extracted to module-scope constants.
//      AcceptBtn / RejectBtn backgroundImage inline style objects were
//      recreated as new object literals on every render of every row.
//
//  5.  SkeletonRow already defined outside component — correct, no change.
//      SKELETON_LIST extracted as a module-scope constant (three skeleton
//      rows rendered from a fixed array, never recreated).

import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFriend } from '../../Context/Friend/FriendContext';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AcceptBtn from '../../Assets/RectaAcceptBtn.png';
import RejectBtn from '../../Assets/RectaRejectBtn.png';

dayjs.extend(relativeTime);

/* ── Optimisation #4 — module-scope stable style objects ────────────────── */
const ACCEPT_STYLE = { backgroundImage: `url(${AcceptBtn})` };
const REJECT_STYLE = { backgroundImage: `url(${RejectBtn})` };

/* ── Skeleton (already module-scope — confirmed correct) ─────────────────── */
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

/* ── Optimisation #5 — module-scope skeleton list constant ───────────────── */
const SKELETON_LIST = (
  <ul className="fr-list">
    <SkeletonRow key={1} />
    <SkeletonRow key={2} />
    <SkeletonRow key={3} />
  </ul>
);

/* ── Optimisation #1 — memo'd per-row component ──────────────────────────── */
const RequestItem = React.memo(({ req, isProcessing, onAccept, onDecline }) => {
  const { _id: requestId, requester, createdAt, updatedAt } = req;
  const timestamp = dayjs(createdAt || updatedAt || new Date()).fromNow();
  const src = requester.profileImage ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(requester.name)}&background=3b4fd8&color=fff`;

  return (
    <li className="fr-item">
      <img
        src={src}
        alt={requester.name}
        className="fr-avatar"
        loading="lazy"
        onError={(e) => {
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
          onClick={() => onAccept(requestId)}
          disabled={isProcessing}
          className={`fr-accept-btn${isProcessing ? ' fr-btn--processing' : ''}`}
          aria-label={`Accept request from ${requester.name}`}
          style={ACCEPT_STYLE}
        >
          <span className="fr-btn-label">{isProcessing ? '…' : 'Accept'}</span>
        </button>
        <button
          onClick={() => onDecline(requestId)}
          disabled={isProcessing}
          className={`fr-decline-btn${isProcessing ? ' fr-btn--processing' : ''}`}
          aria-label={`Decline request from ${requester.name}`}
          style={REJECT_STYLE}
        >
          <span className="fr-btn-label">{isProcessing ? '…' : 'Decline'}</span>
        </button>
      </div>
    </li>
  );
});

/* ── Main component ──────────────────────────────────────────────────────── */
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

  /* ── Optimisation #3 — memoised validation ───────────────────────────── */
  const validRequests = useMemo(
    () => (Array.isArray(requests)
      ? requests.filter(r => r?.requester?._id && r?.requester?.name)
      : []),
    [requests],
  );

  /* ── Optimisation #2 — stable action handlers ────────────────────────── */
  const handleAccept = useCallback(async (requestId) => {
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
  }, [processingId, acceptRequest, fetchRequests, fetchFriends]);

  const handleDecline = useCallback(async (requestId) => {
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
  }, [processingId, declineRequest, fetchRequests]);

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
              <span className="fr-badge" aria-label={`${validRequests.length} pending requests`}>
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
          SKELETON_LIST /* Optimisation #5 — constant, not recreated */
        ) : validRequests.length === 0 ? (
          <div className="fr-empty">
            <span className="fr-empty-icon">🙌</span>
            No pending friend requests.
          </div>
        ) : (
          <ul className="fr-list">
            {validRequests.map(req => (
              <RequestItem
                key={req._id}
                req={req}
                isProcessing={processingId === req._id}
                onAccept={handleAccept}
                onDecline={handleDecline}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FriendRequest;