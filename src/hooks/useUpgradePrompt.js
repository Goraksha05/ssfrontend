/**
 * hooks/useUpgradePrompt.js
 *
 * Controls WHEN the upgrade prompt modal should appear.
 *
 * Logic:
 *  1. Wait until auth is settled (not loading) and user is logged in.
 *  2. If user is already subscribed → never show.
 *  3. Fetch subscription status via SubscriptionContext.
 *  4. Respect a cooldown:
 *       - "dismissed_for_today" → suppress until midnight
 *       - "snoozed" → suppress for SNOOZE_HOURS after "Maybe Later"
 *  5. Delay the first appearance by INITIAL_DELAY_MS so the user gets
 *     to see the page before the modal interrupts.
 *  6. Expose `show`, `dismiss`, `snooze`, and `onUpgrade` to callers.
 *
 * Analytics:
 *  All significant events are forwarded to window.__analyticsTrack when
 *  present, and always logged to the console in development.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth }         from '../Context/Authorisation/AuthContext';
import { useSubscription } from '../Context/Subscription/SubscriptionContext';

// ── Configuration ─────────────────────────────────────────────────────────────
const INITIAL_DELAY_MS   = 2_500;   // wait 2.5 s after login before showing
const SNOOZE_HOURS       = 24;      // "Maybe Later" → hide for 24 hours
const STORAGE_KEY_PREFIX = 'upgrade_prompt';

// ── Storage helpers ───────────────────────────────────────────────────────────
function storageKey(userId, suffix) {
  return `${STORAGE_KEY_PREFIX}:${userId}:${suffix}`;
}

function isSnoozeActive(userId) {
  const raw = localStorage.getItem(storageKey(userId, 'snoozed_until'));
  if (!raw) return false;
  return Date.now() < Number(raw);
}

function isDismissedForToday(userId) {
  const raw = localStorage.getItem(storageKey(userId, 'dismissed_date'));
  if (!raw) return false;
  const today = new Date().toISOString().split('T')[0];
  return raw === today;
}

function setSnoozed(userId) {
  const until = Date.now() + SNOOZE_HOURS * 60 * 60 * 1000;
  localStorage.setItem(storageKey(userId, 'snoozed_until'), String(until));
}

function setDismissedForToday(userId) {
  const today = new Date().toISOString().split('T')[0];
  localStorage.setItem(storageKey(userId, 'dismissed_date'), today);
}

function clearPromptStorage(userId) {
  ['snoozed_until', 'dismissed_date'].forEach((suffix) =>
    localStorage.removeItem(storageKey(userId, suffix))
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function track(event, meta = {}) {
  const payload = { event, ...meta, ts: Date.now() };
  if (process.env.NODE_ENV !== 'production') {
    console.info('[UpgradePrompt Analytics]', payload);
  }
  if (typeof window !== 'undefined' && typeof window.__analyticsTrack === 'function') {
    window.__analyticsTrack(payload);
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useUpgradePrompt() {
  const { isAuthenticated, user, loading: authLoading } = useAuth();
  const { fetchSubscriptionDetails, subscriptionDetails } = useSubscription();

  const [show,           setShow]           = useState(false);  // eslint-disable-next-line
  const [fetchedOnce,    setFetchedOnce]    = useState(false);
  const timerRef         = useRef(null);
  const hasShownRef      = useRef(false);   // prevent double-show within a session

  const userId = user?.id || user?._id || null;

  // ── Determine whether we should show ──────────────────────────────────────
  const evaluateShouldShow = useCallback(async () => {
    if (!userId) return;
    if (hasShownRef.current) return;
    if (isSnoozeActive(userId))       return;
    if (isDismissedForToday(userId))  return;

    // Fetch fresh subscription state (may already be cached in context)
    let details = subscriptionDetails;
    if (!details) {
      details = await fetchSubscriptionDetails();
      setFetchedOnce(true);
    }

    // Already subscribed → nothing to do
    if (details?.subscribed || user?.subscription?.active) return;

    // Schedule prompt after initial delay to avoid flashing on load
    timerRef.current = setTimeout(() => {
      setShow(true);
      hasShownRef.current = true;
      track('upgrade_prompt_shown', { userId });
    }, INITIAL_DELAY_MS);
  }, [userId, subscriptionDetails, fetchSubscriptionDetails, user]);

  // ── Trigger when auth settles ─────────────────────────────────────────────
  useEffect(() => {
    if (authLoading)          return;   // wait for auth to resolve
    if (!isAuthenticated)     return;   // not logged in
    if (!userId)              return;

    evaluateShouldShow();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [authLoading, isAuthenticated, userId, evaluateShouldShow]);

  // ── If subscription becomes active while prompt is open → close it ────────
  useEffect(() => {
    if (subscriptionDetails?.subscribed && show) {
      setShow(false);
      track('upgrade_prompt_auto_closed', { userId, reason: 'subscribed' });
    }
  }, [subscriptionDetails, show, userId]);

  // ── Dismiss for today (with "Don't show again today" checkbox) ─────────────
  const dismissForToday = useCallback(() => {
    if (userId) {
      setDismissedForToday(userId);
      track('upgrade_prompt_dismissed_for_today', { userId });
    }
    setShow(false);
  }, [userId]);

  // ── Snooze ("Maybe Later") ────────────────────────────────────────────────
  const snooze = useCallback(() => {
    if (userId) {
      setSnoozed(userId);
      track('upgrade_prompt_snoozed', { userId });
    }
    setShow(false);
  }, [userId]);

  // ── User successfully subscribed ──────────────────────────────────────────
  const onUpgrade = useCallback(() => {
    if (userId) clearPromptStorage(userId);
    track('upgrade_prompt_cta_clicked', { userId });
    setShow(false);
    // Refresh subscription details in context
    fetchSubscriptionDetails().catch(() => {});
  }, [userId, fetchSubscriptionDetails]);

  return {
    show,
    snooze,
    dismissForToday,
    onUpgrade,
  };
}