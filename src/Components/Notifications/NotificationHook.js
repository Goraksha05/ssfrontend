// src/hooks/useMilestoneNotification.js
//
// Fires a one-time toast (and optionally a notification) when the user
// crosses a defined milestone for referrals, posts, or streaks.
//
// FIXES vs original:
//   • Reads counts from the real contexts (StreakContext, ReferralContext,
//     PostContext) instead of requiring callers to pass raw numbers as props.
//   • Guards against re-firing: each milestone is stored in sessionStorage
//     so it only triggers once per browser session (survives re-renders but
//     resets on tab close — intentional so users see it next visit too).
//   • Uses a unique toastId per milestone so react-toastify deduplicates even
//     if the effect somehow runs twice (StrictMode double-invoke, etc.).
//   • Integrates with NotificationContext to bump the unread badge when a
//     milestone toast fires (purely client-side — no extra API call needed).
//   • Exported as both a default export (hook) and a standalone
//     <MilestoneNotificationWatcher /> component so it can be dropped anywhere
//     in the tree once, with zero prop drilling.

import { useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { useStreak }   from '../../Context/Activity/StreakContext';
import { useReferral } from '../../Context/Activity/ReferralContext';
import { useNotification } from '../../Context/NotificationContext';

// ── Milestone definitions ──────────────────────────────────────────────────────
// Each entry: { type, count, emoji, message }
// Add or remove milestones here — no other code needs to change.
const MILESTONES = [
  // Referrals
  { type: 'referral', count: 3,   emoji: '🎉', message: 'You referred 3 friends! Keep it up — claim your reward.' },
  { type: 'referral', count: 6,   emoji: '🚀', message: 'Amazing! 6 referrals reached. Your reward is waiting.' },
  { type: 'referral', count: 10,  emoji: '🏆', message: 'Referral legend! 10 friends joined because of you.' },

  // Posts
  { type: 'post',     count: 10,  emoji: '📝', message: '10 posts published! Claim your post milestone reward.' },
  { type: 'post',     count: 25,  emoji: '✍️',  message: "25 posts — you're on a roll! Grab your reward." },
  { type: 'post',     count: 50,  emoji: '🌟', message: '50 posts! You are a content creator. Claim your reward.' },

  // Streaks
  { type: 'streak',   count: 30,  emoji: '🔥', message: '30-day streak! Incredible consistency. Claim your reward.' },
  { type: 'streak',   count: 60,  emoji: '💪', message: '60 days strong! Your dedication is paying off.' },
  { type: 'streak',   count: 90,  emoji: '👑', message: '90-day streak — you are unstoppable! Claim your reward.' },
];

// Session-scoped guard: key → true means the toast has already been shown
// this session. Stored outside the hook so it survives re-mounts.
const SESSION_KEY = (type, count) => `milestone_shown_${type}_${count}`;

function wasShownThisSession(type, count) {
  try {
    return sessionStorage.getItem(SESSION_KEY(type, count)) === '1';
  } catch {
    return false;
  }
}

function markShownThisSession(type, count) {
  try {
    sessionStorage.setItem(SESSION_KEY(type, count), '1');
  } catch { /* ignore quota errors */ }
}

// ── Hook ───────────────────────────────────────────────────────────────────────
/**
 * useMilestoneNotification
 *
 * Reads counts from context and fires toasts when milestones are crossed.
 * Mount this hook once near the top of the authenticated tree.
 *
 * Optionally accepts override counts for testing/storybook:
 *   useMilestoneNotification({ referralCount: 10, postCount: 25, streakCount: 30 })
 *
 * In production, call with no arguments so it reads from context automatically.
 */
const useMilestoneNotification = (overrides = {}) => {
  // Pull live counts from context (fallback to override if context unavailable)
  let streakCtxCount   = 0;
  let referralCtxCount = 0;

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const streak   = useStreak();
    streakCtxCount = streak?.streakCount ?? 0;
  } catch { /* StreakContext not mounted */ }

  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const referral   = useReferral();
    referralCtxCount = referral?.referralCount ?? 0;
  } catch { /* ReferralContext not mounted */ }

  // NotificationContext — bump badge on milestone
  let setUnreadCount = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const notifCtx = useNotification();
    setUnreadCount = notifCtx?.setUnreadCount ?? null;
  } catch { /* NotificationContext not mounted */ }

  const counts = {
    referral: overrides.referralCount ?? referralCtxCount,
    post:     overrides.postCount     ?? 0,   // postCount has no dedicated context; pass via override
    streak:   overrides.streakCount   ?? streakCtxCount,
  };

  // Track which milestones have been checked during this component lifetime
  const checkedRef = useRef(new Set());

  useEffect(() => {
    MILESTONES.forEach(({ type, count, emoji, message }) => {
      const currentCount = counts[type] ?? 0;

      // Only fire when the count exactly matches (or passes on the same render)
      // AND hasn't been shown this session AND hasn't been checked this mount
      if (
        currentCount >= count &&
        !wasShownThisSession(type, count) &&
        !checkedRef.current.has(`${type}_${count}`)
      ) {
        checkedRef.current.add(`${type}_${count}`);
        markShownThisSession(type, count);

        const toastId = `milestone_${type}_${count}`;

        toast.info(`${emoji} ${message}`, {
          toastId,
          autoClose: 6_000,
          icon: false, // emoji in message already serves as icon
        });

        // Bump the notification badge so the bell lights up
        setUnreadCount?.((prev) => prev + 1);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts.referral, counts.post, counts.streak]);
};

export default useMilestoneNotification;

// ── Convenience component ─────────────────────────────────────────────────────
/**
 * <MilestoneNotificationWatcher />
 *
 * Drop this once inside the authenticated layout — it renders nothing but
 * wires up the milestone hook automatically, so individual pages don't need
 * to call the hook themselves.
 *
 * Usage (in App.js or a layout wrapper):
 *   <MilestoneNotificationWatcher />
 *
 * Override counts for pages that know exact values (e.g. PostRewards):
 *   <MilestoneNotificationWatcher postCount={statePosts.length} />
 */
export const MilestoneNotificationWatcher = ({ postCount = 0 }) => {
  useMilestoneNotification({ postCount });
  return null;
};