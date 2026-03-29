/**
 * hooks/useRewardEligibility.js
 *
 * Fetches and caches eligibility from GET /api/activity/reward-eligibility.
 * Single source of truth consumed by:
 *   - RewardClaimButton
 *   - RewardEligibilityGate
 *   - RewardEligibilityStatus
 *   - DailyStreak, PostRewards, UserReferrals
 *
 * Gate shape returned:
 *   {
 *     eligible: bool,
 *     checking: bool,
 *     kycGate: { passed, status, message, ctaLabel, ctaPath, label },
 *     subscriptionGate: { passed, active, expired, plan, expiresAt, message, ctaLabel, ctaPath, label },
 *     blockerCode: string | null,
 *     blockerMessage: string | null,
 *     parseClaimError: (err) => string,
 *     refetch: () => void,
 *   }
 *
 * FIXES applied:
 *   1. Replaced useEffect-with-local-fetch with SWR-style cache (30 s stale).
 *      Previously every component that called useRewardEligibility() fired its
 *      own independent fetch on mount, so 3 reward panels = 3 simultaneous
 *      GET /api/activity/reward-eligibility calls. Now all instances share one
 *      in-flight request and one cached result.
 *
 *   2. Added parseClaimError() — interprets structured 403 responses from the
 *      requireRewardEligibility middleware so components show the right human
 *      message without duplicating the mapping logic in each file.
 *
 *   3. Gate objects now carry `label` (short, for compact banners) in addition
 *      to `message` (full, for cards and popovers).
 *
 *   4. ctaPath / ctaLabel are derived from the gate, not hardcoded per
 *      component — changing the route in one place propagates everywhere.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { KYC_STATUSES } from '../Context/KYC/KycContext';
import { useSubscription } from "../Context/Subscription/SubscriptionContext";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const STALE_MS    = 30_000;

// Shared cache
const _cache = {
  data: null,
  fetchedAt: 0,
  promise: null,
};

function getToken() {
  return localStorage.getItem('token');
}

async function fetchEligibility() {
  const token = getToken();
  if (!token) return null;

  const res = await fetch(`${BACKEND_URL}/api/activity/reward-eligibility`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    if (res.status === 401) return null;
    throw new Error(`Eligibility check failed: ${res.status}`);
  }

  return res.json();
}

// ✅ FIXED: accepts openSubscription
function buildGates(data, openSubscription) {
  if (!data) return null;

  const { gates = {}, eligible = false, rewardsFrozen = false } = data;
  const kyc = gates.kyc ?? {};
  const sub = gates.subscription ?? {};

  // ── KYC ─────────────────────────
  const kycStatus = kyc.status ?? KYC_STATUSES.NOT_STARTED;
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
      ? 'Your documents are under review. We\'ll notify you within 1–2 business days.'
      : isRejected
        ? 'Your KYC was not approved. Please check the reason and resubmit your documents.'
        : 'Complete KYC verification to unlock all reward claiming.',

    ctaLabel: isSubmitted
      ? 'Check status'
      : isRejected
        ? 'Resubmit KYC'
        : 'Start KYC',

    ctaPath: '/profile?tab=kyc',

    // 🎯 attention trigger
    ctaAttention: !kyc.passed,
  };

  // ── Subscription ─────────────────────────
  const expired = sub?.expired ?? false;
  const active  = sub?.active ?? false;

  const subscriptionGate = {
    passed: sub?.passed ?? false,
    active,
    expired,
    plan: sub?.plan ?? null,
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

    // ✅ modal trigger
    ctaAction: () => openSubscription(),

    // 🎯 ATTENTION FLAG (important)
    ctaAttention: !active || expired,
  };

  // ── Blockers ─────────────────────────
  let blockerCode = null;
  let blockerMessage = null;

  if (rewardsFrozen) {
    blockerCode = 'REWARDS_FROZEN';
    blockerMessage = 'Your reward payouts are temporarily suspended. Please contact support.';
  } else if (!kycGate.passed && !subscriptionGate.passed) {
    blockerCode = 'KYC_AND_SUBSCRIPTION';
    blockerMessage = 'Complete KYC verification and activate a subscription to claim rewards.';
  } else if (!kycGate.passed) {
    blockerCode = 'KYC_NOT_VERIFIED';
    blockerMessage = kycGate.message;
  } else if (!subscriptionGate.passed) {
    blockerCode = 'SUBSCRIPTION_REQUIRED';
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
    KYC_NOT_VERIFIED: 'KYC verification is required.',
    SUBSCRIPTION_REQUIRED: 'Subscription required.',
    KYC_AND_SUBSCRIPTION: 'Complete KYC and subscribe.',
    REWARDS_FROZEN: 'Rewards suspended.',
  };

  return codeMessages[code] ?? 'Failed to claim reward.';
}

// ── MAIN HOOK ─────────────────────────
export function useRewardEligibility() {
  const { openSubscription } = useSubscription(); // ✅ correct usage

  const [state, setState] = useState({
    checking: true,
    eligible: false,
    rewardsFrozen: false,
    kycGate: {},
    subscriptionGate: {},
    blockerCode: null,
    blockerMessage: null,
  });

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const loadEligibility = useCallback(async (force = false) => {
    const now = Date.now();

    if (!force && _cache.data && (now - _cache.fetchedAt) < STALE_MS) {
      const gates = buildGates(_cache.data, openSubscription);
      if (gates && mountedRef.current) {
        setState(prev => ({ ...prev, checking: false, ...gates }));
      }
      return;
    }

    if (!_cache.promise) {
      _cache.promise = fetchEligibility()
        .then(data => {
          _cache.data = data;
          _cache.fetchedAt = Date.now();
          _cache.promise = null;
          return data;
        })
        .catch(err => {
          _cache.promise = null;
          throw err;
        });
    }

    try {
      const data = await _cache.promise;
      const gates = buildGates(data, openSubscription);

      if (mountedRef.current) {
        setState(prev => ({ ...prev, checking: false, ...gates }));
      }
    } catch {
      if (mountedRef.current) {
        setState(prev => ({ ...prev, checking: false }));
      }
    }
  }, [openSubscription]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  return {
    ...state,
    parseClaimError,
    refetch: () => {
      _cache.data = null;
      _cache.fetchedAt = 0;
      setState(prev => ({ ...prev, checking: true }));
      loadEligibility(true);
    },
  };
}