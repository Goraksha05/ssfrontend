/* Context/KYC/KycContext.jsx */

/**
 * UPGRADE NOTES (adminKycRoutes v2 alignment)
 * ─────────────────────────────────────────────────────────────────────────────
 * The adminKycRoutes now exposes two parallel approve/reject paths:
 *
 *   General admin path  (approveKYC / rejectKYC)
 *     → broadcasts via the kyc:user_update socket event to the user's
 *       personal room.  Already handled below.
 *
 *   Special-Offer-aware path  (verifyKyc / rejectSpOfferKyc)
 *     → emits DIRECT, per-user socket events:
 *         'kyc_verified'  { status: 'verified' }
 *         'kyc_rejected'  { status: 'rejected', reason: string }
 *       These are emitted to  io.to(userId.toString())  so they arrive only
 *       in the affected user's own room.
 *
 * Both paths write to the same User.kyc sub-document, so the client response
 * is identical: call fetchKyc(true) to pull the canonical server state.
 *
 * Changes in this version:
 *   1. Added socket listeners for 'kyc_verified' and 'kyc_rejected' (SP-offer
 *      path) alongside the existing 'kyc:user_update' listener.
 *   2. On 'kyc_verified': optimistically set status → 'verified' in local
 *      state for instant UI feedback, then force-refetch for canonical data.
 *   3. On 'kyc_rejected': optimistically set status → 'rejected' and store
 *      the rejection reason, then force-refetch.
 *   4. Exposed `rejectionReason` in the context value — sourced from either
 *      the socket event payload or the full kycData fetched from the server.
 *   5. Exposed `lastSocketEvent` for debugging / telemetry.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../Authorisation/AuthContext';
import { onSocketEvent } from '../../WebSocket/WebSocketClient';

// ── Constants ─────────────────────────────────────────────────────────────────
const KycContext = createContext(null);

export const KYC_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  REQUIRED:    'required',
  SUBMITTED:   'submitted',
  VERIFIED:    'verified',
  REJECTED:    'rejected',
});

export const KYC_STATUS_LABELS = Object.freeze({
  not_started: 'Not Started',
  required:    'Required',
  submitted:   'Under Review',
  verified:    'Verified',
  rejected:    'Rejected',
});

/** Statuses where further polling / socket events are unnecessary. */
const TERMINAL_STATUSES = new Set([
  KYC_STATUSES.VERIFIED,
  KYC_STATUSES.NOT_STARTED,
]);

const STALE_MS      = 30_000;  // don't re-fetch within 30 s (unless forced)
const POLL_INTERVAL = 60_000;  // poll every 60 s while submitted

// ── Provider ──────────────────────────────────────────────────────────────────
export const KycProvider = ({ children }) => {
  const { token } = useAuth();

  const [kycData,      setKycData]      = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState(null);
  const [submitResult, setSubmitResult] = useState(null); // last submit response

  // ── NEW: last socket event received (type + timestamp) ────────────────────
  // Surfaced in context for debugging panels and analytics.
  const [lastSocketEvent, setLastSocketEvent] = useState(null);

  const lastFetchRef  = useRef(0);
  const fetchingRef   = useRef(false);
  const abortRef      = useRef(null);
  const pollTimerRef  = useRef(null);

  // ── Core fetch ───────────────────────────────────────────────────────────────
  const fetchKyc = useCallback(async (force = false) => {
    if (!token) return;
    if (!force && Date.now() - lastFetchRef.current < STALE_MS) return;
    if (fetchingRef.current) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest.get('/api/kyc/me', {
        headers:        { Authorization: `Bearer ${token}` },
        signal:         controller.signal,
        _silenceToast:  true,
      });
      setKycData(res.data);
      lastFetchRef.current = Date.now();
    } catch (err) {
      if (err.name === 'CanceledError' || err.name === 'AbortError') return;
      if (err?.response?.status === 404) {
        setKycData({ status: KYC_STATUSES.NOT_STARTED });
        lastFetchRef.current = Date.now();
      } else {
        setError(err?.response?.data?.message || 'Failed to load KYC status.');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [token]);

  // ── Polling (only when status is 'submitted') ─────────────────────────────
  const startPolling = useCallback(() => {
    if (pollTimerRef.current) return;
    pollTimerRef.current = setInterval(() => {
      fetchKyc(true);
    }, POLL_INTERVAL);
  }, [fetchKyc]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Start / stop polling based on current status.
  useEffect(() => {
    const status = kycData?.status;
    if (status === KYC_STATUSES.SUBMITTED) {
      startPolling();
    } else if (!status || TERMINAL_STATUSES.has(status)) {
      stopPolling();
    }
    return stopPolling;
  }, [kycData?.status, startPolling, stopPolling]);

  // ── Socket: General admin path ────────────────────────────────────────────
  // Listens for 'kyc:user_update' broadcast from approveKYC / rejectKYC
  // (the original admin route handlers).  The event carries a `type` field
  // ('approved' | 'rejected' | 'reset') and triggers a force-refetch.
  useEffect(() => {
    const off = onSocketEvent('kyc:user_update', ({ type }) => {
      if (type === 'approved' || type === 'rejected' || type === 'reset') {
        setLastSocketEvent({ event: 'kyc:user_update', type, at: Date.now() });
        fetchKyc(true);
      }
    });
    return off;
  }, [fetchKyc]);

  // ── Socket: Special-Offer-aware path — kyc_verified ──────────────────────
  // Emitted by verifyKyc() in adminKycController directly to the user's
  // personal socket room: io.to(userId.toString()).emit('kyc_verified', ...)
  //
  // On receipt:
  //   1. Optimistically flip local status → 'verified' for instant UI update.
  //      This stops polling immediately (TERMINAL_STATUSES check in the
  //      useEffect above) and shows the "Verified ✓" badge without waiting
  //      for the refetch round-trip.
  //   2. Force-refetch to pull the full canonical record (verifiedAt,
  //      verifiedBy, score, etc.) so the KYC detail page is complete.
  useEffect(() => {
    const off = onSocketEvent('kyc_verified', (payload) => {
      setLastSocketEvent({ event: 'kyc_verified', payload, at: Date.now() });

      // Optimistic update — status flips to verified immediately
      setKycData((prev) => ({
        ...prev,
        status:          KYC_STATUSES.VERIFIED,
        verifiedAt:      payload?.verifiedAt ?? new Date().toISOString(),
        rejectionReason: null,
      }));

      // Stop polling immediately — VERIFIED is terminal.
      stopPolling();

      // Fetch canonical data (verifiedBy, score, thumbnails, etc.)
      fetchKyc(true);
    });
    return off;
  }, [fetchKyc, stopPolling]);

  // ── Socket: Special-Offer-aware path — kyc_rejected ──────────────────────
  // Emitted by rejectSpOfferKyc() in adminKycController directly to the
  // user's personal socket room:
  //   io.to(userId.toString()).emit('kyc_rejected', { status: 'rejected', reason })
  //
  // On receipt:
  //   1. Optimistically flip local status → 'rejected' and store the reason
  //      so the UI can show the specific rejection message without a refetch.
  //   2. Force-refetch to get the full server record.
  useEffect(() => {
    const off = onSocketEvent('kyc_rejected', (payload) => {
      setLastSocketEvent({ event: 'kyc_rejected', payload, at: Date.now() });

      // Optimistic update — show rejection reason immediately
      setKycData((prev) => ({
        ...prev,
        status:          KYC_STATUSES.REJECTED,
        rejectionReason: payload?.reason ?? 'Documents could not be verified.',
        verifiedAt:      null,
      }));

      // Rejection is not terminal for polling (user can resubmit), but there
      // is nothing to poll for — stop polling until the user resubmits.
      stopPolling();

      // Fetch canonical data
      fetchKyc(true);
    });
    return off;
  }, [fetchKyc, stopPolling]);

  // ── Token change: fetch fresh or clear ───────────────────────────────────
  useEffect(() => {
    if (token) {
      fetchKyc(true);
    } else {
      setKycData(null);
      setError(null);
      stopPolling();
    }
    return () => {
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopPolling();
    };
  }, [stopPolling]);

  // ── submitKyc: owns the POST /api/kyc/submit call ────────────────────────
  /**
   * @param {FormData} formData  Must include aadhaar, pan, bank, selfie fields.
   * @returns {{ success: boolean, decision?: string, score?: number, error?: string }}
   */
  const submitKyc = useCallback(async (formData) => {
    if (!token) return { success: false, error: 'Not authenticated.' };
    setSubmitting(true);
    setError(null);
    setSubmitResult(null);

    try {
      const res = await apiRequest.post('/api/kyc/submit', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          // Let axios set Content-Type with the correct boundary for FormData
        },
        timeout:       120_000,
        _silenceToast: true,
      });

      const result = {
        success:  true,
        decision: res.data?.decision,
        score:    res.data?.score,
        status:   res.data?.status,
        message:  res.data?.message,
      };
      setSubmitResult(result);

      // Immediately update local state so the UI reflects the new status
      setKycData((prev) => ({
        ...prev,
        status:          res.data?.status ?? prev?.status,
        score:           res.data?.score  ?? prev?.score,
        submittedAt:     new Date().toISOString(),
        rejectionReason: null,
      }));
      lastFetchRef.current = Date.now();

      // Stop polling for terminal / rejection statuses
      if (
        TERMINAL_STATUSES.has(res.data?.status) ||
        res.data?.status === KYC_STATUSES.REJECTED
      ) {
        stopPolling();
      }

      return result;
    } catch (err) {
      const msg = err?.response?.data?.message || 'KYC submission failed. Please try again.';
      setError(msg);
      return { success: false, error: msg };
    } finally {
      setSubmitting(false);
    }
  }, [token, stopPolling]);

  // ── Derived values ────────────────────────────────────────────────────────
  const status          = kycData?.status || KYC_STATUSES.NOT_STARTED;
  const rejectionReason = kycData?.rejectionReason ?? null;
  const isVerified      = status === KYC_STATUSES.VERIFIED;
  const isSubmitted     = status === KYC_STATUSES.SUBMITTED;
  const isRejected      = status === KYC_STATUSES.REJECTED;
  const isRequired      = status === KYC_STATUSES.REQUIRED;
  const needsAction     = isRequired || isRejected;
  const showBadge       = needsAction;
  const statusLabel     = KYC_STATUS_LABELS[status] ?? status;

  const resetError = useCallback(() => setError(null), []);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    kycData,
    status,
    statusLabel,
    rejectionReason,      // ← NEW: sourced from kycData or optimistic socket update
    loading,
    submitting,
    error,
    submitResult,
    isVerified,
    isSubmitted,
    isRejected,
    isRequired,
    needsAction,
    showBadge,
    lastSocketEvent,      // ← NEW: { event, type|payload, at } for debugging
    refetch:   () => fetchKyc(true),
    submitKyc,
    resetError,
  }), [
    kycData, status, statusLabel, rejectionReason,
    loading, submitting, error, submitResult,
    isVerified, isSubmitted, isRejected, isRequired,
    needsAction, showBadge, lastSocketEvent,
    fetchKyc, submitKyc, resetError,
  ]);

  return (
    <KycContext.Provider value={value}>
      {children}
    </KycContext.Provider>
  );
};

// ── Hook ──────────────────────────────────────────────────────────────────────
export const useKyc = () => {
  const ctx = useContext(KycContext);
  if (!ctx) throw new Error('useKyc must be used inside <KycProvider>');
  return ctx;
};

export default KycContext;