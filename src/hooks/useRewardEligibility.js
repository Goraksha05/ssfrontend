// src/hooks/useRewardEligibility.js
//
// Unified reward eligibility hook.
//
// Aggregates KYC status (from KycContext) and subscription status
// (from SubscriptionContext) into a single ergonomic object that
// reward-claiming components consume.
//
// Exposes:
//   eligible          — true only when BOTH KYC is verified AND subscription is active
//   checking          — true while async eligibility data is still loading
//   kycGate           — { passed, status, label, ctaPath }
//   subscriptionGate  — { passed, active, expired, plan, ctaPath }
//   rewardsFrozen     — true when the trust engine has frozen this user's rewards
//   refresh()         — force-refresh both KYC and subscription state from server
//   blockerCode       — null | 'KYC_AND_SUBSCRIPTION' | 'KYC_NOT_VERIFIED' | 'SUBSCRIPTION_REQUIRED' | 'REWARDS_FROZEN'
//   blockerMessage    — human-readable message for the current blocker
//
// Usage:
//   const { eligible, checking, kycGate, subscriptionGate, blockerMessage } = useRewardEligibility();
//   if (!eligible) return <RewardGateBanner {...eligibility} />;

import { useMemo, useCallback } from 'react';
import { useKyc, KYC_STATUSES }      from '../Context/KYC/KycContext';
import { useSubscription }            from '../Context/Subscription/SubscriptionContext';

// ── KYC gate labels + CTA paths ────────────────────────────────────────────────
const KYC_STATUS_META = {
  [KYC_STATUSES.NOT_STARTED]: {
    label:   'KYC not started',
    message: 'Complete your KYC verification to unlock reward claiming.',
    ctaPath: '/profile?tab=kyc',
    ctaLabel: 'Start KYC',
  },
  [KYC_STATUSES.REQUIRED]: {
    label:   'KYC required',
    message: 'KYC verification is required before you can claim rewards.',
    ctaPath: '/profile?tab=kyc',
    ctaLabel: 'Complete KYC',
  },
  [KYC_STATUSES.SUBMITTED]: {
    label:   'KYC under review',
    message: 'Your KYC documents are under review. Rewards will unlock once verified.',
    ctaPath: '/profile?tab=kyc',
    ctaLabel: 'View KYC Status',
  },
  [KYC_STATUSES.REJECTED]: {
    label:   'KYC rejected',
    message: 'Your KYC was not approved. Resubmit your documents to claim rewards.',
    ctaPath: '/profile?tab=kyc',
    ctaLabel: 'Resubmit KYC',
  },
  [KYC_STATUSES.VERIFIED]: {
    label:   'KYC verified',
    message: '',
    ctaPath: null,
    ctaLabel: null,
  },
};

// ── Subscription gate labels + CTA paths ───────────────────────────────────────
const SUB_NOT_ACTIVE = {
  label:    'No active subscription',
  message:  'Subscribe to any plan to start claiming rewards.',
  ctaPath:  '/subscription',
  ctaLabel: 'View Plans',
};

const SUB_EXPIRED = {
  label:    'Subscription expired',
  message:  'Your subscription has expired. Renew it to continue claiming rewards.',
  ctaPath:  '/subscription',
  ctaLabel: 'Renew Plan',
};

// ──────────────────────────────────────────────────────────────────────────────

export function useRewardEligibility() {
  const {
    status:     kycStatus,
    isVerified: kycPassed,
    loading:    kycLoading,
    refetch:    refetchKyc,
  } = useKyc();

  const {
    subscriptionDetails,
    fetchSubscriptionDetails,
  } = useSubscription();

  // Derive subscription gate values
  const subActive  = !!subscriptionDetails?.subscribed;
  const subExpired = !!(
    subscriptionDetails?.expiresAt &&
    new Date(subscriptionDetails.expiresAt) < new Date()
  );
  const subPassed  = subActive && !subExpired;

  // Loading state — treat null subscriptionDetails as still loading
  const checking = kycLoading || subscriptionDetails === null;

  // KYC gate shape
  const kycGate = useMemo(() => {
    const meta = KYC_STATUS_META[kycStatus] ?? KYC_STATUS_META[KYC_STATUSES.NOT_STARTED];
    return {
      passed:   kycPassed,
      status:   kycStatus,
      label:    meta.label,
      message:  meta.message,
      ctaPath:  meta.ctaPath,
      ctaLabel: meta.ctaLabel,
    };
  }, [kycStatus, kycPassed]);

  // Subscription gate shape
  const subscriptionGate = useMemo(() => {
    const meta = subExpired ? SUB_EXPIRED : SUB_NOT_ACTIVE;
    return {
      passed:   subPassed,
      active:   subActive,
      expired:  subExpired,
      plan:     subscriptionDetails?.plan ?? null,
      expiresAt: subscriptionDetails?.expiresAt ?? null,
      label:    subPassed ? 'Subscription active' : meta.label,
      message:  subPassed ? '' : meta.message,
      ctaPath:  subPassed ? null : meta.ctaPath,
      ctaLabel: subPassed ? null : meta.ctaLabel,
    };
  }, [subPassed, subActive, subExpired, subscriptionDetails]);

  // Overall eligibility
  const eligible = !checking && kycPassed && subPassed;

  // Single blocker code for the current state
  const blockerCode = useMemo(() => {
    if (eligible) return null;
    if (!kycPassed && !subPassed) return 'KYC_AND_SUBSCRIPTION';
    if (!kycPassed)               return 'KYC_NOT_VERIFIED';
    if (!subPassed)               return 'SUBSCRIPTION_REQUIRED';
    return null;
  }, [eligible, kycPassed, subPassed]);

  // Human-readable combined message
  const blockerMessage = useMemo(() => {
    if (!blockerCode) return '';
    if (blockerCode === 'KYC_AND_SUBSCRIPTION') {
      return 'Complete your KYC verification and activate a subscription to claim rewards.';
    }
    if (blockerCode === 'KYC_NOT_VERIFIED') return kycGate.message;
    if (blockerCode === 'SUBSCRIPTION_REQUIRED') return subscriptionGate.message;
    return '';
  }, [blockerCode, kycGate, subscriptionGate]);

  // Parse structured error from a failed claim API response and map it to
  // a user-friendly message. Call this in the catch block of a claim handler.
  const parseClaimError = useCallback((err) => {
    const data = err?.response?.data;
    if (!data) return err?.message || 'Claim failed. Please try again.';

    // Structured eligibility response from requireRewardEligibility middleware
    if (data.code) {
      switch (data.code) {
        case 'REWARDS_FROZEN':
          return 'Your rewards are temporarily frozen pending verification. Contact support.';
        case 'KYC_NOT_VERIFIED': {
          const kycMeta = KYC_STATUS_META[data.gates?.kyc?.status];
          return kycMeta?.message || data.message;
        }
        case 'SUBSCRIPTION_REQUIRED':
          return data.gates?.subscription?.expired
            ? SUB_EXPIRED.message
            : SUB_NOT_ACTIVE.message;
        case 'KYC_AND_SUBSCRIPTION':
          return 'Complete your KYC verification and activate a subscription to claim rewards.';
        default:
          return data.message || 'Claim failed.';
      }
    }

    return data.message || 'Claim failed. Please try again.';
  }, []);

  const refresh = useCallback(async () => {
    await Promise.allSettled([
      refetchKyc(),
      fetchSubscriptionDetails(),
    ]);
  }, [refetchKyc, fetchSubscriptionDetails]);

  return {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
    blockerMessage,
    rewardsFrozen: false, // server-side only; exposed for completeness
    refresh,
    parseClaimError,
  };
}