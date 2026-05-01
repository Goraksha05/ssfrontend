/**
 * hooks/useRewardEligibility.js — v2
**/

import { useState, useEffect, useRef, useCallback } from 'react';
import { KYC_STATUSES } from '../Context/KYC/KycContext';
import { useSubscription } from '../Context/Subscription/SubscriptionContext';
import { useAuth } from '../Context/Authorisation/AuthContext';
import apiRequest from '../utils/apiRequest';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STALE_MS    = 30_000;

// Shared cache — keyed by token so different users never share entries
const _cacheByToken = new Map();

function getCache(token) {
  if (!token) return null;
  if (!_cacheByToken.has(token)) {
    _cacheByToken.set(token, { data: null, fetchedAt: 0, promise: null });
  }
  return _cacheByToken.get(token);
}

// apiRequest interceptor attaches the Authorization header automatically
async function fetchEligibility(token) {
  if (!token) return null;

  const res = await apiRequest.get(
    `${BACKEND_URL}/api/activity/reward-eligibility`,
    { _silent: true }, // suppress auto-toasts; caller handles errors
  );

  return res.data;
}

// ✅ FIXED: accepts openSubscription
function buildGates(data, openSubscription) {
  if (!data) return null;

  const { gates = {}, eligible = false, rewardsFrozen = false } = data;
  const kyc = gates.kyc ?? {};
  const sub = gates.subscription ?? {};

  // ── KYC ─────────────────────────
  const kycStatus   = kyc.status ?? KYC_STATUSES.NOT_STARTED;
  const isSubmitted = kycStatus === KYC_STATUSES.SUBMITTED;
  const isRejected  = kycStatus === KYC_STATUSES.REJECTED;

  const kycGate = {
    passed: kyc.passed ?? false,
    status: kycStatus,
    label: isSubmitted
      ? 'KYC under review'
      : isRejected
        ? 'KYC rejected'
        : 'KYC verification required',

    message: isSubmitted
      ? "Your documents are under review. We'll notify you within 1–2 business days."
      : isRejected
        ? 'Your KYC was not approved. Please check the reason and resubmit your documents.'
        : 'Complete KYC verification to unlock all reward claiming.',

    ctaLabel: isSubmitted
      ? 'Check status'
      : isRejected
        ? 'Resubmit KYC'
        : 'Start KYC',

    ctaPath: '/profile?tab=kyc',
    ctaAttention: !kyc.passed,
  };

  // ── Subscription ─────────────────────────
  const expired = sub?.expired ?? false;
  const active  = sub?.active  ?? false;

  const subscriptionGate = {
    passed: sub?.passed ?? false,
    active,
    expired,
    plan:      sub?.plan      ?? null,
    expiresAt: sub?.expiresAt ?? null,

    label: expired
      ? 'Subscription expired'
      : active
        ? `${sub?.plan ?? 'Plan'} (active)`
        : 'No active subscription',

    message: expired
      ? 'Your subscription has expired. Please renew to continue claiming rewards.'
      : 'An active subscription is required to claim rewards. Choose a plan to get started.',

    ctaLabel: expired ? 'Renew plan' : 'View plans',
    ctaAction: () => openSubscription(),
    ctaAttention: !active || expired,
  };

  // ── Blockers ─────────────────────────
  let blockerCode    = null;
  let blockerMessage = null;

  if (rewardsFrozen) {
    blockerCode    = 'REWARDS_FROZEN';
    blockerMessage = 'Your reward payouts are temporarily suspended. Please contact support.';
  } else if (!kycGate.passed && !subscriptionGate.passed) {
    blockerCode    = 'KYC_AND_SUBSCRIPTION';
    blockerMessage = 'Complete KYC verification and activate a subscription to claim rewards.';
  } else if (!kycGate.passed) {
    blockerCode    = 'KYC_NOT_VERIFIED';
    blockerMessage = kycGate.message;
  } else if (!subscriptionGate.passed) {
    blockerCode    = 'SUBSCRIPTION_REQUIRED';
    blockerMessage = subscriptionGate.message;
  }

  return {
    eligible,
    rewardsFrozen,
    kycGate,
    subscriptionGate,
    blockerCode,
    blockerMessage,
  };
}

// ── Error Parser ─────────────────────────
function parseClaimError(err) {
  const data = err?.response?.data ?? err?.data;
  if (!data) return err?.message ?? 'Something went wrong.';

  const { code, message } = data;
  if (message) return message;

  const codeMessages = {
    KYC_NOT_VERIFIED:    'KYC verification is required.',
    SUBSCRIPTION_REQUIRED: 'Subscription required.',
    KYC_AND_SUBSCRIPTION:  'Complete KYC and subscribe.',
    REWARDS_FROZEN:      'Rewards suspended.',
  };

  return codeMessages[code] ?? 'Failed to claim reward.';
}

// ── MAIN HOOK ─────────────────────────
export function useRewardEligibility() {
  // ── Token from AuthContext — single source of truth ─────────────────────
  const { token } = useAuth();
  const { openSubscription } = useSubscription();

  const [state, setState] = useState({
    checking:         true,
    eligible:         false,
    rewardsFrozen:    false,
    kycGate:          {},
    subscriptionGate: {},
    blockerCode:      null,
    blockerMessage:   null,
  });

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadEligibility = useCallback(async (force = false) => {
    const cache = getCache(token);

    // Not logged in — nothing to check
    if (!cache) {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, checking: false }));
      }
      return;
    }

    const now = Date.now();

    if (!force && cache.data && (now - cache.fetchedAt) < STALE_MS) {
      const gates = buildGates(cache.data, openSubscription);
      if (gates && mountedRef.current) {
        setState(prev => ({ ...prev, checking: false, ...gates }));
      }
      return;
    }

    if (!cache.promise) {
      cache.promise = fetchEligibility(token)
        .then(data => {
          cache.data      = data;
          cache.fetchedAt = Date.now();
          cache.promise   = null;
          return data;
        })
        .catch(err => {
          cache.promise = null;
          throw err;
        });
    }

    try {
      const data  = await cache.promise;
      const gates = buildGates(data, openSubscription);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, checking: false, ...gates }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, checking: false }));
      }
    }
  }, [token, openSubscription]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  return {
    ...state,
    parseClaimError,
    refetch: () => {
      const cache = getCache(token);
      if (cache) {
        cache.data      = null;
        cache.fetchedAt = 0;
        cache.promise   = null;
      }
      setState(prev => ({ ...prev, checking: true }));
      loadEligibility(true);
    },
  };
}

/**
 * Invalidate the eligibility cache.
 * @param {string} [token] — if provided, invalidates only that token's entry.
 *                           If omitted, clears all entries (e.g. on logout).
 */
export function invalidateEligibilityCache(token) {
  if (token) {
    const cache = _cacheByToken.get(token);
    if (cache) {
      cache.data      = null;
      cache.fetchedAt = 0;
      cache.promise   = null;
    }
  } else {
    _cacheByToken.clear();
  }
}