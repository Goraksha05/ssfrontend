/**
 * Context/KYC/KycContext.jsx
 *
 * Owns all KYC state for the current user.
 * Wrap your router or App root with <KycProvider>.
 *
 * Consumed by:
 *   - KycVerification.jsx      (submit form)
 *   - KYCStatusBanner.jsx      (top-of-page nudge)
 *   - ProfileWithKYC.js        (KYCTab, name-row chip, tab badge)
 *   - AdminKycDashboard.jsx    (uses its own apiRequest, not this context)
 *
 * API consumed:
 *   GET  /api/kyc/me  → { status, score, liveness, verifiedAt,
 *                         rejectionReason, submittedAt, documents:{...} }
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../Authorisation/AuthContext';

// ── Context ──────────────────────────────────────────────────────────────────
const KycContext = createContext(null);

// ── Helper ───────────────────────────────────────────────────────────────────
export const KYC_STATUSES = Object.freeze({
  NOT_STARTED: 'not_started',
  REQUIRED:    'required',
  SUBMITTED:   'submitted',
  VERIFIED:    'verified',
  REJECTED:    'rejected',
});

// ── Provider ─────────────────────────────────────────────────────────────────
export const KycProvider = ({ children }) => {
  const { token } = useAuth();

  const [kycData,    setKycData]    = useState(null);   // raw API response
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState(null);
  const [lastFetch,  setLastFetch]  = useState(null);

  // Prevent re-fetch within 30 s unless forced
  const STALE_MS = 30_000;
  const fetchingRef = useRef(false);

  const fetchKyc = useCallback(async (force = false) => {
    if (!token) return;
    if (!force && lastFetch && Date.now() - lastFetch < STALE_MS) return;
    if (fetchingRef.current) return;

    fetchingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      const res = await apiRequest.get('/api/kyc/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setKycData(res.data);
      setLastFetch(Date.now());
    } catch (err) {
      if (err?.response?.status === 404) {
        // No KYC record yet — treat as not_started
        setKycData({ status: KYC_STATUSES.NOT_STARTED });
        setLastFetch(Date.now());
      } else {
        setError(err?.response?.data?.message || 'Failed to load KYC status.');
      }
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [token, lastFetch]);

  // Fetch once on mount / when token changes
  useEffect(() => {
    if (token) fetchKyc(true);
    else        setKycData(null);
  }, [token]); // eslint-disable-line

  // Derived convenience values
  const status        = kycData?.status || KYC_STATUSES.NOT_STARTED;
  const isVerified    = status === KYC_STATUSES.VERIFIED;
  const isSubmitted   = status === KYC_STATUSES.SUBMITTED;
  const isRejected    = status === KYC_STATUSES.REJECTED;
  const isRequired    = status === KYC_STATUSES.REQUIRED;
  const needsAction   = isRequired || isRejected;
  const showBadge     = needsAction; // red dot on KYC tab

  return (
    <KycContext.Provider
      value={{
        kycData,
        status,
        loading,
        error,
        isVerified,
        isSubmitted,
        isRejected,
        isRequired,
        needsAction,
        showBadge,
        refetch: () => fetchKyc(true),
      }}
    >
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