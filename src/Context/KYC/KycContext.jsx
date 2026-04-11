/* Context/KYC/KycContext.jsx */

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

const STALE_MS       = 30_000;  // don't refetch within 30 s (unless forced)
const POLL_INTERVAL  = 60_000;  // poll every 60 s while submitted

// ── Provider ──────────────────────────────────────────────────────────────────
export const KycProvider = ({ children }) => {
  const { token } = useAuth();

  const [kycData,    setKycData]    = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState(null);
  const [submitResult, setSubmitResult] = useState(null); // last submit response

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
        _silenceToast:  true,  // handled below
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
    if (pollTimerRef.current) return; // already polling
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
  // Poll only while submitted; stop immediately once a terminal status is reached.
  useEffect(() => {
    const status = kycData?.status;
    if (status === KYC_STATUSES.SUBMITTED) {
      startPolling();
    } else if (!status || TERMINAL_STATUSES.has(status)) {
      stopPolling();
    }
    return stopPolling;
  }, [kycData?.status, startPolling, stopPolling]);

  // ── Socket: live admin review updates ────────────────────────────────────
  useEffect(() => {
    const off = onSocketEvent('kyc:user_update', ({ type }) => {
      // Re-fetch fresh data when admin acts on our KYC
      if (type === 'approved' || type === 'rejected' || type === 'reset') {
        fetchKyc(true);
      }
    });
    return off;
  }, [fetchKyc]);

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
        timeout: 120_000, // KYC upload may take a while
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
        status:          res.data?.status    ?? prev?.status,
        score:           res.data?.score     ?? prev?.score,
        submittedAt:     new Date().toISOString(),
        rejectionReason: null,
      }));
      lastFetchRef.current = Date.now();

      // Stop polling when the server returns a terminal status (VERIFIED, NOT_STARTED)
      // or REJECTED — which is non-terminal but makes further polling pointless.
      if (TERMINAL_STATUSES.has(res.data?.status) || res.data?.status === KYC_STATUSES.REJECTED) {
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
  const status      = kycData?.status || KYC_STATUSES.NOT_STARTED;
  const isVerified  = status === KYC_STATUSES.VERIFIED;
  const isSubmitted = status === KYC_STATUSES.SUBMITTED;
  const isRejected  = status === KYC_STATUSES.REJECTED;
  const isRequired  = status === KYC_STATUSES.REQUIRED;
  const needsAction = isRequired || isRejected;
  const showBadge   = needsAction;
  const statusLabel = KYC_STATUS_LABELS[status] ?? status;

  const resetError  = useCallback(() => setError(null), []);

  // ── Stable context value ──────────────────────────────────────────────────
  const value = useMemo(() => ({
    kycData,
    status,
    statusLabel,
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
    refetch:   () => fetchKyc(true),
    submitKyc,
    resetError,
  }), [
    kycData, status, statusLabel,
    loading, submitting, error, submitResult,
    isVerified, isSubmitted, isRejected, isRequired,
    needsAction, showBadge,
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