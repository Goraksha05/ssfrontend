/**
 * components/Rewards/SpecialOfferTab.jsx
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WIRING FIXES (this revision)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * WIRE-1 · offerState prop was missing from RewardsHub entirely
 *   RewardsHub only passed `user`, `eligible`, `kycStatus` — `offerState`
 *   was `undefined`, causing an immediate crash on destructuring.
 *   FIX → Remove the `offerState` prop completely. The tab now calls
 *   `useSpecialOffer()` directly; the SpecialOfferProvider that wraps the
 *   whole hub already owns that data.
 *
 * WIRE-2 · offerState should never have been a prop
 *   Passing context data down as a prop defeats the provider pattern and
 *   creates a second place where data can go stale or be wired incorrectly.
 *   FIX → same as WIRE-1: read from context, not from props.
 *
 * WIRE-3 · rewardPer vs rewardPerReferral field name mismatch
 *   The context's `status` object uses `rewardPerReferral`.
 *   The tab destructured it as `rewardPer` → always undefined.
 *   FIX → alias at destructuring: `rewardPerReferral: rewardPer = 100`.
 *
 * WIRE-4 · expiresIn (snapshot) vs countdown (live-ticking)
 *   The context exposes a live `countdown` that is decremented every second
 *   by a setInterval inside the provider.  `status.expiresIn` is only the
 *   value captured at the last HTTP fetch — it never ticks.
 *   FIX → use `countdown` for the on-screen display.
 *
 * WIRE-5 · newRewardEarned / clearNewReward did not exist on the context
 *   The old offerState was expected to carry these fields, but the context
 *   has no flash-banner state.
 *   FIX → implement locally: track the previous `rewardsSummary.total` via
 *   a useRef.  When the total increases (i.e. a new reward arrived via the
 *   socket → context refresh cycle) set a local `newRewardFlash` boolean
 *   that the banner consumes.
 *
 * WIRE-6 · useLockedRewards local hook was redundant
 *   The context already fetches, caches, and refreshes `lockedRewards` and
 *   `rewardsSummary`.  The tab's own hook fired a second independent fetch
 *   for the same data, creating duplicate requests and a race condition.
 *   FIX → delete useLockedRewards; read `lockedRewards` / `rewardsSummary`
 *   / `rewardsLoading` directly from the context.
 *
 * WIRE-7 · handleWithdrawSubmit re-implemented the context's withdraw()
 *   The context already exposes `withdraw(bankDetails)` which POSTs to the
 *   API and calls `refresh()`.  The tab's local handler did the same, so
 *   submitting would fire two overlapping POSTs.
 *   FIX → delegate to `ctx.withdraw(bankDetails)`; handle success/error
 *   from its return value.
 *
 * WIRE-8 · withdrawing state was duplicated
 *   Both context and tab had their own `withdrawing` boolean — they could
 *   diverge, leaving the button stuck in a disabled state after success.
 *   FIX → remove local `withdrawing` state; read it from the context.
 *
 * WIRE-9 · kycStatus prop was redundant
 *   RewardsHub passed `kycStatus={user?.kyc?.status}`.  The dedicated
 *   `useSpecialOfferEligibility` hook already reads this from AuthContext
 *   with proper normalisation and gate metadata.
 *   FIX → drop `kycStatus` prop; use the hook.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * BUGS FIXED (carried over from previous revision)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * BUG-1/2/3 · axios/fetch mismatch + wrong call signature in withdraw
 *   Resolved by delegating to ctx.withdraw() (WIRE-7 above), which already
 *   uses the correct apiFetch helper in SpecialOfferContext.
 *
 * BUG-4 · Wrong modal component (BankDetailsModal → SpecialOfferWithdrawModal)
 *   Kept: import is SpecialOfferWithdrawModal.
 *
 * BUG-5 · Typo invitaionLink + duplicated URL construction
 *   Kept: uses buildInviteLink() from inviteLink.js.
 *
 * BUG-6/7 · approvedCount null-guard / first-render flash
 *   Superseded: approvedCount now comes from context's rewardsSummary which
 *   is always a number (defaults to 0 before the first fetch completes).
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { toast }                          from 'react-toastify';
import SpecialOfferWithdrawModal          from './SpecialOfferWithdrawModal';
import { useSpecialOffer }                from '../../Context/SpecialOffer/SpecialOfferContext';
import { useSpecialOfferEligibility }     from '../../hooks/useSpecialOfferEligibility';
import { buildInviteLink, nativeShare }   from '../../utils/inviteLink';
import { useAuth }                        from '../../Context/Authorisation/AuthContext';

/* ── Design tokens — inherit from RewardsHub theme ──────────────────────── */
const T = {
  card: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 10,
    padding: '20px 20px 16px',
    marginBottom: 16,
  },
  sectionHead: {
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: 'var(--color-text-tertiary)',
    margin: '24px 0 12px',
    paddingBottom: 6,
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  countdownWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '20px 16px 16px',
    borderRadius: 10,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    marginBottom: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  countdownLabel: {
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    color: 'var(--color-text-tertiary)',
    marginBottom: 6,
  },
  countdownTime: {
    fontFamily: '"Courier New", "Courier", monospace',
    fontSize: 42,
    fontWeight: 400,
    letterSpacing: -2,
    lineHeight: 1,
    color: 'var(--color-text-primary)',
  },
  countdownSub: {
    fontSize: 12,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-tertiary)',
    marginTop: 6,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginBottom: 16,
  },
  statCell: {
    padding: '14px 16px',
    borderRadius: 8,
    background: 'var(--color-background-secondary)',
    border: '0.5px solid var(--color-border-tertiary)',
    textAlign: 'center',
  },
  statNum: {
    display: 'block',
    fontFamily: '"Courier New", monospace',
    fontSize: 26,
    fontWeight: 400,
    letterSpacing: -1,
    color: 'var(--color-text-primary)',
    lineHeight: 1.1,
  },
  statLabel: {
    display: 'block',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-tertiary)',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  capWrap: { marginBottom: 16, fontFamily: 'var(--font-sans)' },
  capRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 5,
    fontSize: 12,
    color: 'var(--color-text-secondary)',
  },
  capTrack: {
    height: 3,
    background: 'var(--color-border-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  btnRow: {
    display: 'flex',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  shareBtn: {
    flex: '1 1 140px',
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    background: 'none',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 7,
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    transition: 'all 0.12s',
    textAlign: 'center',
  },
  withdrawBtn: (disabled) => ({
    flex: '1 1 140px',
    padding: '9px 18px',
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    border: '0.5px solid',
    borderRadius: 7,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'all 0.12s',
    textAlign: 'center',
    ...(disabled
      ? {
          background: 'var(--color-background-secondary)',
          color: 'var(--color-text-tertiary)',
          borderColor: 'var(--color-border-tertiary)',
        }
      : {
          background: 'var(--color-text-primary)',
          color: 'var(--color-background-primary)',
          borderColor: 'var(--color-text-primary)',
        }),
  }),
  gateBanner: (severity) => ({
    display: 'flex',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 8,
    border: '0.5px solid',
    fontFamily: 'var(--font-sans)',
    fontSize: 12,
    lineHeight: 1.5,
    marginBottom: 14,
    ...(severity === 'warning' || severity === 'error'
      ? {
          background: 'var(--color-background-warning)',
          borderColor: 'var(--color-border-warning)',
          color: 'var(--color-text-warning)',
        }
      : {
          background: 'var(--color-background-secondary)',
          borderColor: 'var(--color-border-tertiary)',
          color: 'var(--color-text-secondary)',
        }),
  }),
  rewardRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
  },
  badge: (status) => ({
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 500,
    padding: '2px 7px',
    borderRadius: 4,
    ...(status === 'approved'
      ? {
          background: 'var(--color-background-success)',
          color: 'var(--color-text-success)',
          border: '0.5px solid var(--color-border-success)',
        }
      : status === 'rejected'
      ? {
          background: 'var(--color-background-danger)',
          color: 'var(--color-text-danger)',
          border: '0.5px solid var(--color-border-danger)',
        }
      : {
          background: 'var(--color-background-warning)',
          color: 'var(--color-text-warning)',
          border: '0.5px solid var(--color-border-warning)',
        }),
  }),
  flashBanner: {
    padding: '10px 14px',
    borderRadius: 8,
    background: 'var(--color-background-success)',
    border: '0.5px solid var(--color-border-success)',
    color: 'var(--color-text-success)',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 14,
    animation: 'so-pulse 0.6s ease',
  },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */
function fmt2(n) {
  return String(Math.max(0, Math.floor(n))).padStart(2, '0');
}

function fmtCountdown(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${fmt2(h)}:${fmt2(m)}:${fmt2(s)}`;
  return `${fmt2(m)}:${fmt2(s)}`;
}

function capPct(today, cap) {
  if (!cap) return 0;
  return Math.min(100, Math.round((today / cap) * 100));
}

/* ── CSS injected once ────────────────────────────────────────────────────── */
const CSS = `
@keyframes so-pulse {
  0%   { opacity: 0; transform: translateY(-6px) scale(0.97); }
  60%  { opacity: 1; transform: translateY(0)     scale(1.01); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes so-capfill {
  from { width: 0; }
}
.so-capbar {
  height: 100%;
  border-radius: 2px;
  background: var(--color-text-primary);
  animation: so-capfill 0.6s ease;
  transition: width 0.4s ease;
}
.so-share-btn:hover {
  background: var(--color-background-secondary) !important;
}
`;

/* ══════════════════════════════════════════════════════════════════════════ */
/*  SpecialOfferTab                                                           */
/* ══════════════════════════════════════════════════════════════════════════ */

/**
 * Props
 *   user     – user object from AuthContext (passed by RewardsHub for referralId)
 *   eligible – from useRewardEligibility (passed by RewardsHub)
 *
 * All offer data (status, countdown, rewards, withdraw action) is read from
 * SpecialOfferContext via useSpecialOffer().  KYC eligibility is read from
 * useSpecialOfferEligibility() which reads AuthContext internally.
 * Neither offerState nor kycStatus should be passed as props.
 */
export default function SpecialOfferTab({ user, eligible }) {
  // ── WIRE-1/2 FIX: consume context directly, no offerState prop ────────────
  const ctx = useSpecialOffer();
  const {
    // Offer status fields — nested under `status`
    status,
    // Live countdown (ticks every second inside the provider)
    // WIRE-4 FIX: use `countdown`, NOT `status.expiresIn`
    countdown,
    // Rewards from the provider's own fetch — no duplicate hook needed
    // WIRE-6 FIX: delete local useLockedRewards; use context values
    lockedRewards:  rewards,
    rewardsSummary: summary,
    rewardsLoading,
    // FIX: gate the "expired" UI on a confirmed server response, not the
    // default isActive:false that exists before the first fetch completes.
    statusReady,
    // Withdraw action + its async state
    // WIRE-7/8 FIX: delegate to context action; remove local duplicates
    withdraw:       ctxWithdraw,
    withdrawing,
    withdrawError,
  } = ctx;

  // Destructure status fields.
  // WIRE-3 FIX: alias `rewardPerReferral` → `rewardPer` to match template usage.
  const {
    isActive,
    earned        = 0,
    referrals     = 0,
    pendingCount  = 0,
    todayEarned   = 0,
    dailyCap      = 1800,
    canEarnMore   = true,
    rewardPerReferral: rewardPer = 100,
  } = status;

  // ── WIRE-9 FIX: KYC gate from the dedicated hook (reads AuthContext) ──────
  const { kycVerified, kycGate } = useSpecialOfferEligibility();

  // User from AuthContext is preferred; prop is a fallback for referralId only
  const { user: authUser } = useAuth();
  const resolvedUser = user ?? authUser;

  /* ── Local UI state ───────────────────────────────────────────────────── */
  const [copied, setCopied]               = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);

  // ── WIRE-5 FIX: newRewardFlash implemented locally ────────────────────────
  // Watch rewardsSummary.total.  When it increases the context has just been
  // refreshed after a socket 'special_offer_reward' event → show the banner.
  const prevTotalRef = useRef(null);
  const [newRewardFlash, setNewRewardFlash] = useState(false);

  useEffect(() => {
    const current = summary?.total ?? 0;
    if (prevTotalRef.current !== null && current > prevTotalRef.current) {
      setNewRewardFlash(true);
    }
    prevTotalRef.current = current;
  }, [summary?.total]);

  /* ── Inject CSS once ──────────────────────────────────────────────────── */
  useEffect(() => {
    const STYLE_ID = 'so-styles';
    if (document.getElementById(STYLE_ID)) return;
    const tag = document.createElement('style');
    tag.id = STYLE_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
  }, []);

  /* ── Sync withdrawError toast ─────────────────────────────────────────── */
  // The context sets withdrawError when withdraw() rejects; surface it here.
  useEffect(() => {
    if (withdrawError) {
      toast.error(withdrawError);
    }
  }, [withdrawError]);

  /* ── Referral link ────────────────────────────────────────────────────── */
  const referralId     = resolvedUser?.referralId ?? '';
  const invitationLink = buildInviteLink(referralId);

  /* ── Gate checks ──────────────────────────────────────────────────────── */
  const approvedCount     = summary?.approved ?? 0;
  const approvedAmountINR = approvedCount * rewardPer;

  const withdrawDisabled =
    !kycVerified || rewardsLoading || approvedCount === 0 || withdrawing;

  let withdrawHint = '';
  if (!kycVerified)             withdrawHint = kycGate.message ?? 'KYC verification required to withdraw.';
  else if (rewardsLoading)      withdrawHint = 'Loading reward status…';
  else if (approvedCount === 0) withdrawHint = 'No approved rewards yet. Approval takes 24–48 hrs.';

  /* ── Share ────────────────────────────────────────────────────────────── */
  const handleShare = useCallback(async () => {
    if (!invitationLink) {
      toast.error('Referral link unavailable. Please reload and try again.');
      return;
    }
    const result = await nativeShare(invitationLink, resolvedUser?.name);
    if (result === 'shared' || result === 'cancelled') return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Could not copy link. Please copy it manually.');
    }
  }, [invitationLink, resolvedUser?.name]);

  /* ── Withdraw ─────────────────────────────────────────────────────────── */
  const handleWithdrawOpen = useCallback(() => {
    if (withdrawDisabled) return;
    setWithdrawModalOpen(true);
  }, [withdrawDisabled]);

  // WIRE-7 FIX: delegate entirely to ctx.withdraw().
  // The context handles the POST, error state, and the post-success refresh.
  const handleWithdrawSubmit = useCallback(
    async (bankDetails, successCallback) => {
      const result = await ctxWithdraw(bankDetails);
      if (result.success) {
        toast.success(
          result.message || 'Withdrawal request submitted. Admin will process within 24–48 hrs.',
        );
        setWithdrawModalOpen(false);
        successCallback?.();
      }
      // On failure, ctx.withdraw() sets withdrawError → the useEffect above
      // surfaces it as a toast; no extra handling needed here.
    },
    [ctxWithdraw],
  );

  if (!statusReady) {
    return (
      <div>
        <p style={T.sectionHead}>Special Offer</p>
        <div style={{ ...T.card, textAlign: 'center', padding: '28px 20px' }}>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-tertiary)', margin: 0 }}>
            Loading offer status…
          </p>
        </div>
      </div>
    );
  }

  /* ── Expired state ────────────────────────────────────────────────────── */
  // Only reached once statusReady is true, i.e. we have a real server answer.
  if (!isActive) {
    return (
      <div>
        <p style={T.sectionHead}>Special Offer</p>
        <div style={{ ...T.card, textAlign: 'center', padding: '28px 20px' }}>
          <span style={{ fontSize: 28, display: 'block', marginBottom: 10 }}>⏰</span>
          <p style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--color-text-secondary)', margin: '0 0 6px' }}>
            Your 12-hour special offer has ended.
          </p>
          {earned > 0 && (
            <p style={{ fontFamily: '"Courier New", monospace', fontSize: 18, color: 'var(--color-text-primary)', margin: 0 }}>
              Total earned: ₹{earned.toLocaleString('en-IN')}
            </p>
          )}
        </div>
        <LockedRewardsList rewards={rewards} summary={summary} loading={rewardsLoading} badge={T.badge} rewardRow={T.rewardRow} sectionHead={T.sectionHead} />
      </div>
    );
  }

  /* ── Active state ─────────────────────────────────────────────────────── */
  // WIRE-4 FIX: `countdown` ticks live; `status.expiresIn` does not
  const pct = capPct(todayEarned, dailyCap);

  return (
    <div>
      {/* ── New reward flash ─────────────────────────────────────────── */}
      {newRewardFlash && (
        <div style={T.flashBanner}>
          🎊 ₹{rewardPer} reward earned! It's pending admin approval.
          <button
            onClick={() => setNewRewardFlash(false)}
            style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 14, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}

      {/* ── Countdown — uses live `countdown`, not `status.expiresIn` ── */}
      <div style={T.countdownWrap}>
        <span style={T.countdownLabel}>⚡ Special Offer — Time Remaining</span>
        <span style={T.countdownTime}>{fmtCountdown(countdown)}</span>
        <span style={T.countdownSub}>Earn ₹{rewardPer} per referral whose KYC is verified</span>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────── */}
      <div style={T.statRow}>
        <div style={T.statCell}>
          <span style={T.statNum}>₹{earned.toLocaleString('en-IN')}</span>
          <span style={T.statLabel}>Total Earned</span>
        </div>
        <div style={T.statCell}>
          <span style={T.statNum}>{referrals}</span>
          <span style={T.statLabel}>Referrals</span>
        </div>
        <div style={T.statCell}>
          <span style={T.statNum}>{pendingCount}</span>
          <span style={T.statLabel}>Pending Approval</span>
        </div>
        <div style={T.statCell}>
          <span style={T.statNum}>{approvedCount}</span>
          <span style={T.statLabel}>Approved</span>
        </div>
      </div>

      {/* ── Daily cap progress ───────────────────────────────────────── */}
      <div style={T.capWrap}>
        <div style={T.capRow}>
          <span>Today's earnings</span>
          <span style={{ fontFamily: '"Courier New", monospace', fontWeight: 500, color: 'var(--color-text-primary)' }}>
            ₹{todayEarned} / ₹{dailyCap}
          </span>
        </div>
        <div style={T.capTrack}>
          <div className="so-capbar" style={{ width: `${pct}%` }} />
        </div>
        {!canEarnMore && (
          <p style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-warning)', marginTop: 4 }}>
            Daily cap reached. Resets at midnight IST.
          </p>
        )}
      </div>

      {/* ── Gate banners ─────────────────────────────────────────────── */}
      {/* WIRE-9 FIX: kycGate comes from useSpecialOfferEligibility, not a prop */}
      {!kycVerified && (
        <div style={T.gateBanner(kycGate.severity)}>
          ⚠️ {kycGate.message}
        </div>
      )}
      {kycVerified && pendingCount > 0 && approvedCount === 0 && !rewardsLoading && (
        <div style={T.gateBanner('info')}>
          ⏳ {pendingCount} reward{pendingCount > 1 ? 's' : ''} pending admin approval (24–48 hrs).
          You'll be notified once approved.
        </div>
      )}

      {/* ── Action buttons ───────────────────────────────────────────── */}
      <div style={T.btnRow}>
        <button className="so-share-btn" style={T.shareBtn} onClick={handleShare}>
          {copied ? '✓ Copied!' : '🔗 Share Referral Link'}
        </button>
        <button
          style={T.withdrawBtn(withdrawDisabled)}
          onClick={handleWithdrawOpen}
          disabled={withdrawDisabled}
          title={withdrawHint}
        >
          {withdrawing ? 'Requesting…' : '💸 Withdraw'}
        </button>
      </div>
      {withdrawHint && withdrawDisabled && (
        <p style={{ fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', marginBottom: 14 }}>
          {withdrawHint}
        </p>
      )}

      {/* ── How it works ─────────────────────────────────────────────── */}
      <p style={T.sectionHead}>How it works</p>
      <div style={{ ...T.card, fontSize: 13, fontFamily: 'var(--font-sans)', lineHeight: 1.7, color: 'var(--color-text-secondary)' }}>
        <ol style={{ margin: 0, paddingLeft: 18 }}>
          <li>Share your referral link with friends.</li>
          <li>Each friend who signs up and completes KYC earns you ₹{rewardPer}.</li>
          <li>Rewards are locked pending admin approval (24–48 hrs).</li>
          <li>Daily cap: ₹{dailyCap}. Cap resets at midnight IST.</li>
          <li>Offer expires in <strong>{fmtCountdown(countdown)}</strong>.</li>
        </ol>
      </div>

      {/* ── Locked rewards list ──────────────────────────────────────── */}
      <LockedRewardsList rewards={rewards} summary={summary} loading={rewardsLoading} badge={T.badge} rewardRow={T.rewardRow} sectionHead={T.sectionHead} />

      {/* ── Withdraw modal ───────────────────────────────────────────── */}
      <SpecialOfferWithdrawModal
        isOpen={withdrawModalOpen}
        loading={withdrawing}
        onClose={() => setWithdrawModalOpen(false)}
        onSubmit={handleWithdrawSubmit}
        approvedCount={approvedCount}
        approvedAmountINR={approvedAmountINR}
        pendingCount={pendingCount}
        rewardPer={rewardPer}
      />
    </div>
  );
}

/* ── Locked Rewards sub-component ─────────────────────────────────────────── */

function LockedRewardsList({ rewards, summary, loading, badge, rewardRow, sectionHead }) {
  if (loading) {
    return (
      <>
        <p style={sectionHead}>Locked Rewards</p>
        <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          Loading…
        </p>
      </>
    );
  }

  if (!rewards?.length) {
    return (
      <>
        <p style={sectionHead}>Locked Rewards</p>
        <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
          No rewards yet. Start referring friends!
        </p>
      </>
    );
  }

  return (
    <>
      <p style={sectionHead}>Locked Rewards</p>

      {summary && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {[
            { label: 'Pending',  count: summary.pending,  status: 'pending'  },
            { label: 'Approved', count: summary.approved, status: 'approved' },
            { label: 'Rejected', count: summary.rejected, status: 'rejected' },
          ]
            .filter((c) => c.count > 0)
            .map((c) => (
              <span key={c.status} style={{ ...badge(c.status), fontSize: 11, padding: '3px 10px' }}>
                {c.label}: {c.count}
              </span>
            ))}
          <span style={{ marginLeft: 'auto', fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-text-secondary)', alignSelf: 'center' }}>
            Non-rejected total: ₹{(summary.totalINR || 0).toLocaleString('en-IN')}
          </span>
        </div>
      )}

      <div>
        {rewards.map((r, i) => (
          <div key={r._id ?? i} style={rewardRow}>
            <div>
              <span style={{ fontFamily: '"Courier New", monospace', fontWeight: 500 }}>
                ₹{r.amount}
              </span>
              <span style={{ marginLeft: 8, color: 'var(--color-text-tertiary)', fontSize: 12 }}>
                {r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                    })
                  : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              <span style={badge(r.status)}>
                {r.status === 'pending' ? 'Pending' : r.status === 'approved' ? 'Approved' : 'Rejected'}
              </span>
              {r.status === 'pending' && (
                <span style={{ fontSize: 10, fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)' }}>
                  24–48 hrs
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}