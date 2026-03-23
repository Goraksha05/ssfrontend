// src/Context/Subscription/SubscriptionContext.js
//
// FIXES:
//   1. fetchSubscriptionDetails called GET /api/subscription/details which does
//      not exist in the backend. Subscription data is served by two separate
//      endpoints on the payment router:
//        GET /api/payment/subscription-status  — active plan, expiry, autoRenew
//        GET /api/payment/progress             — referral progress toward free plan
//      Fix: replace the non-existent endpoint with the two correct ones and
//      merge their responses into a single subscription object.
//
//   2. The context now also exposes `subscriptionProgress` so components can
//      display referral-to-activation progress without a separate fetch.

import React, { createContext, useContext, useState, useCallback } from 'react';
import apiRequest from '../../utils/apiRequest';

const SubscriptionContext = createContext(null);

export const SubscriptionProvider = ({ children }) => {
  const [showSubscription,    setShowSubscription]    = useState(false);
  const [subscriptionPlan,    setSubscriptionPlan]    = useState(null);
  const [subscriptionDetails, setSubscriptionDetails] = useState(null);
  const [subscriptionProgress, setSubscriptionProgress] = useState(null);

  const openSubscription  = useCallback(() => setShowSubscription(true),  []);
  const closeSubscription = useCallback(() => setShowSubscription(false), []);

  /**
   * Fetches both subscription status and referral progress in parallel,
   * merges them, and stores in state.
   *
   * Correct backend routes (payment.js):
   *   GET /api/payment/subscription-status
   *   GET /api/payment/progress
   */
  const fetchSubscriptionDetails = useCallback(async () => {
    try {
      const [statusRes, progressRes] = await Promise.allSettled([
        apiRequest.get('/api/payment/subscription-status'),
        apiRequest.get('/api/payment/progress'),
      ]);

      // ── Subscription status ─────────────────────────────────────────────
      let statusData = null;
      if (statusRes.status === 'fulfilled') {
        statusData = statusRes.value?.data ?? null;
      } else {
        console.error('[SubscriptionContext] subscription-status failed:', statusRes.reason?.message);
      }

      // ── Referral progress ───────────────────────────────────────────────
      let progressData = null;
      if (progressRes.status === 'fulfilled') {
        progressData = progressRes.value?.data ?? null;
        setSubscriptionProgress(progressData);
      } else {
        console.error('[SubscriptionContext] progress failed:', progressRes.reason?.message);
      }

      // Merge into a single details object for consumers that want everything
      const merged = {
        // from subscription-status
        subscribed:       statusData?.subscribed       ?? false,
        plan:             statusData?.plan             ?? null,
        expiresAt:        statusData?.expiresAt        ?? null,
        autoRenew:        statusData?.autoRenew        ?? false,
        activationMethod: statusData?.activationMethod ?? null,
        startDate:        statusData?.startDate        ?? null,
        expired:          statusData?.expired          ?? false,
        // from progress
        referredCount:    progressData?.referredCount  ?? 0,
        referralTarget:   progressData?.target         ?? 10,
        remaining:        progressData?.remaining      ?? 0,
        eligible:         progressData?.eligible       ?? false,
      };

      setSubscriptionPlan(merged.plan);
      setSubscriptionDetails(merged);
      return merged;
    } catch (err) {
      console.error('[SubscriptionContext] fetchSubscriptionDetails error:', err?.message);
      return null;
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        showSubscription,
        openSubscription,
        closeSubscription,
        fetchSubscriptionDetails,
        subscriptionPlan,
        setSubscriptionPlan,
        subscriptionDetails,
        subscriptionProgress,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used within a SubscriptionProvider');
  return ctx;
};