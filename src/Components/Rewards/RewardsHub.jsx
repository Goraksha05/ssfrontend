/**
 * components/Rewards/RewardsHub.jsx  (React Query migration)
 *
 * WHAT CHANGED:
 *   - Removed:  useStreak()  from StreakContext (manual TTL)
 *   - Removed:  useReferral() from ReferralContext (manual TTL)
 *   - Added:    useActivityDashboard() — single React Query hook
 *
 *   - StreakTab:   streakCount / streakDates come from useActivityDashboard()
 *   - ReferralTab: referralCount / activeReferralCount come from useActivityDashboard()
 *   - After every reward claim: queryClient.invalidateQueries(['activityDashboard'])
 *     refreshes both streak and referral counts automatically.
 *
 *   - Wallet + earned-rewards (redeemed slabs): still use useEarnedRewards()
 *     which is a light local fetch hook — no Context involved.
 *
 *   - All other business logic (eligibility, bank modal, plan slabs) is
 *     unchanged so the reward claiming flow is not affected.
 *
 * UI BEHAVIOUR:
 *   - While loading: counts show "—" (not 0) to avoid the 0→actual flicker.
 *   - After cache hit (60 s stale window): data appears instantly on re-mount.
 *   - After invalidation: background refetch runs; UI keeps showing old value
 *     until new data arrives (no flicker / no spinner for background refetches).
 */

import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { useNavigate }              from 'react-router-dom';
import { toast }                    from 'react-toastify';
import { useQueryClient }           from '@tanstack/react-query';

import { useAuth }                  from '../../Context/Authorisation/AuthContext';
import { useRewardEligibility }     from '../../hooks/useRewardEligibility';
import { useActivityDashboard, DASHBOARD_QUERY_KEY }
                                    from '../../hooks/useActivityDashboard';
import apiRequest                   from '../../utils/apiRequest';

import RedeemGroceryCoupons from './RedeemGroceryCoupons';

import ReferralTab from './ReferralTab';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const getToken    = () => localStorage.getItem('token');

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens — unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  shell: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 0 80px',
    fontFamily: '"Georgia", "Times New Roman", serif',
    color: 'var(--color-text-primary)',
  },
  walletBar: {
    display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 1, background: 'var(--color-border-tertiary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8, overflow: 'hidden', marginBottom: 24,
  },
  walletCell: {
    background: 'var(--color-background-primary)',
    padding: '14px 16px', textAlign: 'center',
  },
  walletNum: {
    display: 'block', fontSize: 22, fontWeight: 500,
    fontFamily: '"Courier New", "Courier", monospace',
    letterSpacing: '-1px', color: 'var(--color-text-primary)', lineHeight: 1.1,
  },
  walletLabel: {
    display: 'block', fontSize: 11, fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-tertiary)', marginTop: 4,
    textTransform: 'uppercase', letterSpacing: '0.5px',
  },
  tabBar: {
    display: 'flex', gap: 0,
    borderBottom: '1px solid var(--color-border-tertiary)', marginBottom: 28,
  },
  tab: (active) => ({
    padding: '10px 18px', fontSize: 13, fontFamily: 'var(--font-sans)',
    fontWeight: active ? 500 : 400,
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--color-text-primary)' : '2px solid transparent',
    cursor: 'pointer', marginBottom: -1, transition: 'color 0.12s', letterSpacing: '-0.1px',
  }),
  banner: (code) => ({
    display: 'flex', gap: 12, padding: '12px 14px', marginBottom: 24,
    borderRadius: 8, border: '0.5px solid',
    fontFamily: 'var(--font-sans)', fontSize: 13, lineHeight: 1.5,
    ...(code === 'REWARDS_FROZEN'
      ? { background: 'var(--color-background-danger)', borderColor: 'var(--color-border-danger)', color: 'var(--color-text-danger)' }
      : { background: 'var(--color-background-warning)', borderColor: 'var(--color-border-warning)', color: 'var(--color-text-warning)' }
    ),
  }),
  bannerCta: {
    display: 'inline-block', marginTop: 6, fontSize: 12, fontWeight: 500,
    textDecoration: 'underline', cursor: 'pointer',
    background: 'none', border: 'none', color: 'inherit',
    padding: 0, fontFamily: 'var(--font-sans)',
  },
  sectionHead: {
    fontSize: 11, fontFamily: 'var(--font-sans)', fontWeight: 500,
    textTransform: 'uppercase', letterSpacing: '0.8px',
    color: 'var(--color-text-tertiary)', margin: '24px 0 12px',
    padding: '0 0 6px', borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  progressWrap: { marginBottom: 20, fontFamily: 'var(--font-sans)' },
  progressRow: {
    display: 'flex', justifyContent: 'space-between',
    alignItems: 'baseline', marginBottom: 6,
  },
  progressText: { fontSize: 13, color: 'var(--color-text-secondary)' },
  progressPct: {
    fontSize: 12, fontFamily: '"Courier New", monospace',
    fontWeight: 500, color: 'var(--color-text-primary)',
  },
  progressTrack: {
    height: 3, background: 'var(--color-border-tertiary)',
    borderRadius: 2, overflow: 'hidden', marginBottom: 5,
  },
  progressBar: (pct, color = '#b45309') => ({
    height: '100%', width: `${pct}%`, background: color,
    borderRadius: 2, transition: 'width 0.4s ease',
  }),
  progressHint: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  milestoneGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8, marginBottom: 20,
  },
  milestoneChip: (state) => ({
    padding: '10px 12px', borderRadius: 6, border: '0.5px solid',
    fontFamily: 'var(--font-sans)', textAlign: 'center', fontSize: 12,
    ...(state === 'claimed'
      ? { background: 'var(--color-background-success)', borderColor: 'var(--color-border-success)', color: 'var(--color-text-success)' }
      : state === 'active'
      ? { background: 'var(--color-background-primary)', borderColor: 'var(--color-border-secondary)', color: 'var(--color-text-primary)' }
      : { background: 'var(--color-background-secondary)', borderColor: 'var(--color-border-tertiary)', color: 'var(--color-text-tertiary)' }
    ),
  }),
  chipMain: {
    display: 'block', fontSize: 15,
    fontFamily: '"Courier New", monospace', fontWeight: 500,
  },
  chipSub: { display: 'block', fontSize: 11, marginTop: 2, opacity: 0.75 },
  chipBadge: {
    display: 'inline-block', marginTop: 4, fontSize: 10,
    fontFamily: 'var(--font-sans)', fontWeight: 500,
    padding: '1px 6px', borderRadius: 3,
    background: 'var(--color-background-success)',
    color: 'var(--color-text-success)',
    border: '0.5px solid var(--color-border-success)',
  },
  claimRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 0',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    fontFamily: 'var(--font-sans)', flexWrap: 'wrap',
  },
  select: {
    flex: '1 1 200px', fontSize: 13, padding: '8px 10px',
    border: '0.5px solid var(--color-border-secondary)', borderRadius: 6,
    background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 0,
  },
  claimBtn: (state) => ({
    padding: '8px 18px', borderRadius: 6, fontSize: 13, fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: state === 'ready' ? 'pointer' : 'not-allowed',
    border: '0.5px solid', transition: 'all 0.12s', whiteSpace: 'nowrap',
    ...(state === 'ready'
      ? { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', borderColor: 'var(--color-text-primary)' }
      : state === 'claimed'
      ? { background: 'var(--color-background-success)', color: 'var(--color-text-success)', borderColor: 'var(--color-border-success)' }
      : { background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border-tertiary)' }
    ),
  }),
  modalBackdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modalCard: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12, padding: '28px 28px 22px',
    width: '100%', maxWidth: 400, fontFamily: 'var(--font-sans)',
  },
  modalTitle: {
    fontSize: 15, fontWeight: 500, margin: '0 0 20px',
    color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
  },
  fieldLabel: {
    display: 'block', fontSize: 12,
    color: 'var(--color-text-secondary)', marginBottom: 4,
  },
  fieldWrap: { marginBottom: 14 },
  input: {
    width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)', borderRadius: 6,
    background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)', outline: 'none',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    marginTop: 22, paddingTop: 14,
    borderTop: '0.5px solid var(--color-border-tertiary)',
  },
  cancelBtn: {
    padding: '7px 16px', fontSize: 13, fontWeight: 400,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6, background: 'none',
    color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
  submitBtn: (disabled) => ({
    padding: '7px 18px', fontSize: 13, fontWeight: 500,
    border: '0.5px solid var(--color-text-primary)', borderRadius: 6,
    background: disabled ? 'var(--color-background-secondary)' : 'var(--color-text-primary)',
    color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-background-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Placeholder component — shown while a count is loading
// ─────────────────────────────────────────────────────────────────────────────

function CountDisplay({ value, suffix, isLoading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
      <span style={{
        fontFamily: '"Courier New", monospace', fontSize: 40,
        fontWeight: 400, letterSpacing: -2, lineHeight: 1,
        // Subtle pulse while loading — no layout shift
        opacity: isLoading && value === null ? 0.35 : 1,
        transition: 'opacity 0.2s',
      }}>
        {value === null ? '—' : value}
      </span>
      <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>
        {suffix}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// BankDetailsModal — unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

function BankModal({ open, loading, onClose, onSubmit, rewardLabel }) {
  const [form, setForm]     = useState({ accountNumber: '', confirm: '', ifscCode: '', panNumber: '' });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (open) setForm({ accountNumber: '', confirm: '', ifscCode: '', panNumber: '' });
  }, [open]);

  if (!open) return null;

  const validate = () => {
    const e = {};
    if (!form.accountNumber) e.accountNumber = 'Required';
    else if (!/^\d{9,18}$/.test(form.accountNumber)) e.accountNumber = 'Invalid account number';
    if (form.confirm !== form.accountNumber) e.confirm = 'Account numbers do not match';
    if (!form.ifscCode) e.ifscCode = 'Required';
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) e.ifscCode = 'Invalid IFSC code';
    if (!form.panNumber) e.panNumber = 'Required';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panNumber.toUpperCase())) e.panNumber = 'Invalid PAN';
    return e;
  };

  const handleSubmit = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    onSubmit({
      accountNumber: form.accountNumber,
      ifscCode:      form.ifscCode.toUpperCase(),
      panNumber:     form.panNumber.toUpperCase(),
    });
  };

  const field = (key, label, placeholder) => (
    <div style={styles.fieldWrap}>
      <label style={styles.fieldLabel}>{label}</label>
      <input
        style={{ ...styles.input, ...(errors[key] ? { borderColor: 'var(--color-border-danger)' } : {}) }}
        value={form[key]}
        placeholder={placeholder}
        onChange={e => {
          setForm(p => ({ ...p, [key]: e.target.value }));
          setErrors(p => ({ ...p, [key]: undefined }));
        }}
      />
      {errors[key] && (
        <span style={{ fontSize: 11, color: 'var(--color-text-danger)', marginTop: 2, display: 'block' }}>
          {errors[key]}
        </span>
      )}
    </div>
  );

  return (
    <div style={styles.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={styles.modalCard}>
        <p style={styles.modalTitle}>Bank details — {rewardLabel}</p>
        {field('accountNumber', 'Account number', '1234567890')}
        {field('confirm', 'Confirm account number', '1234567890')}
        {field('ifscCode', 'IFSC code', 'SBIN0001234')}
        {field('panNumber', 'PAN number', 'ABCDE1234F')}
        <div style={styles.modalFooter}>
          <button style={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={styles.submitBtn(loading)} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit & claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Local hooks (plan slabs + earned rewards) — unchanged from original
// ─────────────────────────────────────────────────────────────────────────────

function usePlanSlabs(type) {
  const [slabs, setSlabs] = useState([]);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND_URL}/api/rewards/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slabs) setSlabs(d.slabs); })
      .catch(() => {});
  }, [type]);
  return slabs;
}

function useEarnedRewards() {
  const queryClient                    = useQueryClient();
  const [wallet, setWallet]            = useState({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
  const [redeemed, setRedeemed]        = useState({ posts: [], referral: [], streak: [] });
  const [loading, setLoading]          = useState(true);

  const fetch_ = useCallback(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(`${BACKEND_URL}/api/auth/earned-rewards`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) return;
        if (d.wallet) setWallet(d.wallet);
        if (d.redeemed) {
          setRedeemed({
            posts:    (d.redeemed.posts    ?? []).map(Number),
            referral: (d.redeemed.referral ?? []).map(Number),
            streak:   d.redeemed.streak    ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const refetch = useCallback(() => {
    fetch_();
    // Also invalidate the activity dashboard so streak/referral counts refresh
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  }, [fetch_, queryClient]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { wallet, redeemed, loading, refetch };
}

function useMyPostCount() {
  // userId is no longer needed as a parameter — the backend reads it from
  // the JWT token in the Authorization header.
  const [postCount, setPostCount] = useState(0);
  const [loading, setLoading]     = useState(true);
 
  useEffect(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
 
    setLoading(true);
    fetch(`${BACKEND_URL}/api/posts/my-count`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.count !== undefined) setPostCount(Number(d.count));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []); // no deps — token is read imperatively, userId comes from the token
 
  return { postCount, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ current, next, prev = 0, label, color }) {
  if (!next) return null;
  const range = next - prev;
  const pct   = range > 0 ? Math.min(100, Math.round(((current - prev) / range) * 100)) : 100;
  const remaining = next - current;
  return (
    <div style={styles.progressWrap}>
      <div style={styles.progressRow}>
        <span style={styles.progressText}>{label}</span>
        <span style={styles.progressPct}>{pct}%</span>
      </div>
      <div style={styles.progressTrack}>
        <div style={styles.progressBar(pct, color)} />
      </div>
      <span style={styles.progressHint}>
        {remaining} more {remaining === 1 ? 'unit' : 'units'} to next milestone
      </span>
    </div>
  );
}

function MilestoneChip({ label, sublabel, state, badge }) {
  return (
    <div style={styles.milestoneChip(state)}>
      <span style={styles.chipMain}>{label}</span>
      {sublabel && <span style={styles.chipSub}>{sublabel}</span>}
      {badge && <span style={styles.chipBadge}>{badge}</span>}
    </div>
  );
}

function EligibilityBanner({ kycGate, subscriptionGate, blockerCode, blockerMessage }) {
  const navigate = useNavigate();
  if (!blockerCode) return null;

  const items = [];
  if (!kycGate?.passed) {
    items.push({
      label: kycGate?.label,
      cta:   kycGate?.ctaLabel,
      onCta: () => navigate(kycGate?.ctaPath),
    });
  }
  if (!subscriptionGate?.passed) {
    items.push({
      label: subscriptionGate?.label,
      cta:   subscriptionGate?.ctaLabel,
      onCta: () => subscriptionGate?.ctaAction?.(),
    });
  }

  return (
    <div style={styles.banner(blockerCode)}>
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
        {blockerCode === 'REWARDS_FROZEN' ? '!' : 'i'}
      </span>
      <div>
        <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>Rewards locked</strong>
        <p style={{ margin: '2px 0 6px', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
          {blockerMessage}
        </p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <button key={it.label} style={styles.bannerCta} onClick={it.onCta}>
              {it.cta} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StreakTab — NOW reads from useActivityDashboard (React Query)
// ─────────────────────────────────────────────────────────────────────────────

function StreakTab({ eligible, parseClaimError, openModal, redeemedStreak }) {
  // ★ CHANGED: useActivityDashboard() instead of useStreak()
  const { streakCount, isLoading: dashLoading } = useActivityDashboard();
  const slabs = usePlanSlabs('streak');

  const claimedDays   = redeemedStreak ?? [];
  const accurateCount = streakCount ?? 0;

  const milestones = useMemo(() =>
    slabs.map(s => s.dailystreak).filter(d => typeof d === 'number').sort((a, b) => a - b),
    [slabs]
  );

  const next = milestones.find(m => accurateCount < m) ?? null;
  const prev = [...milestones].reverse().find(m => accurateCount >= m) ?? 0;

  const [selected, setSelected] = useState('');
  const selectedNum = selected ? Number(selected) : null;
  const slabKey     = selectedNum ? `${selectedNum}days` : null;
  const isClaimed   = slabKey ? claimedDays.includes(slabKey) : false;
  const hasEnough   = selectedNum ? accurateCount >= selectedNum : false;

  const btnState = !eligible       ? 'locked'
    : !selectedNum                 ? 'idle'
    : isClaimed                    ? 'claimed'
    : !hasEnough                   ? 'locked'
    : 'ready';

  return (
    <div>
      {/* ★ CountDisplay shows "—" while loading, not "0" */}
      <CountDisplay value={streakCount} suffix="days" isLoading={dashLoading} />

      <ProgressBar
        current={accurateCount}
        next={next}
        prev={prev}
        label={next ? `${accurateCount} / ${next} days` : 'All milestones reached'}
        color="#b45309"
      />

      <p style={styles.sectionHead}>Milestones</p>
      <div style={styles.milestoneGrid}>
        {milestones.map(day => {
          const key     = `${day}days`;
          const claimed = claimedDays.includes(key);
          const active  = accurateCount >= day;
          return (
            <MilestoneChip
              key={day}
              label={`${day}d`}
              state={claimed ? 'claimed' : active ? 'active' : 'locked'}
              badge={claimed ? 'Claimed' : null}
            />
          );
        })}
      </div>

      <div style={styles.claimRow}>
        <select
          style={styles.select}
          value={selected}
          onChange={e => setSelected(e.target.value)}
          disabled={!eligible}
        >
          <option value="">Select a milestone…</option>
          {milestones.map(day => {
            const key  = `${day}days`;
            const isCl = claimedDays.includes(key);
            const ok   = accurateCount >= day;
            return (
              <option key={day} value={day} disabled={!ok || isCl}>
                {day} days{isCl ? ' — Claimed' : !ok ? ' — Locked' : ' — Available'}
              </option>
            );
          })}
        </select>

        <button
          style={styles.claimBtn(btnState)}
          onClick={() => btnState === 'ready' && openModal('streak', selectedNum, `${selectedNum}-day streak`)}
          disabled={btnState !== 'ready'}
        >
          {btnState === 'claimed' ? 'Claimed' : btnState === 'locked' && !eligible ? 'Locked' : 'Claim'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PostTab — unchanged (already had no Context dep)
// ─────────────────────────────────────────────────────────────────────────────

function PostTab({ eligible, user, redeemedPosts, onRewardClaimed }) {
  const slabs                         = usePlanSlabs('posts');
  const { postCount, loading: countLoading } = useMyPostCount();
  const { parseClaimError }           = useRewardEligibility();

  const claimed = (redeemedPosts ?? []).map(String);

  const [selected, setSelected]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const milestones = useMemo(() =>
    slabs.map(s => s.postsCount).filter(p => typeof p === 'number').sort((a, b) => a - b),
    [slabs]
  );

  const selectedNum = selected ? Number(selected) : null;
  const isClaimed   = selectedNum ? claimed.includes(String(selectedNum)) : false;
  const hasEnough   = selectedNum ? postCount >= selectedNum : false;

  const next = milestones.find(m => postCount < m) ?? null;
  const prev = [...milestones].reverse().find(m => postCount >= m) ?? 0;

  const btnState = !eligible   ? 'locked'
    : !selectedNum             ? 'idle'
    : isClaimed                ? 'claimed'
    : !hasEnough               ? 'locked'
    : 'ready';

  const handleSubmit = async (bankDetails) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/post-reward`,
        { postreward: selectedNum, bankDetails },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(res.data?.message || `Post reward for ${selectedNum} posts claimed!`);
      setSelected('');
      setModalOpen(false);
      onRewardClaimed?.();
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <CountDisplay value={postCount} suffix="posts" isLoading={countLoading} />

      <ProgressBar
        current={postCount}
        next={next}
        prev={prev}
        label={next ? `${postCount} / ${next} posts` : 'All milestones reached'}
        color="#0f766e"
      />

      <p style={styles.sectionHead}>Milestones</p>
      <div style={styles.milestoneGrid}>
        {milestones.map(m => {
          const cl = claimed.includes(String(m));
          const ac = postCount >= m;
          return (
            <MilestoneChip
              key={m}
              label={`${m}p`}
              state={cl ? 'claimed' : ac ? 'active' : 'locked'}
              badge={cl ? 'Claimed' : null}
            />
          );
        })}
      </div>

      <div style={styles.claimRow}>
        <select
          style={styles.select}
          value={selected}
          onChange={e => setSelected(e.target.value)}
          disabled={!eligible}
        >
          <option value="">Select a milestone…</option>
          {milestones.map(m => {
            const isCl = claimed.includes(String(m));
            const ok   = postCount >= m;
            return (
              <option key={m} value={m} disabled={!ok || isCl}>
                {m} posts{isCl ? ' — Claimed' : !ok ? ' — Locked' : ' — Available'}
              </option>
            );
          })}
        </select>

        <button
          style={styles.claimBtn(btnState)}
          onClick={() => btnState === 'ready' && setModalOpen(true)}
          disabled={btnState !== 'ready'}
        >
          {btnState === 'claimed' ? 'Claimed' : btnState === 'locked' && !eligible ? 'Locked' : 'Claim'}
        </button>
      </div>

      <BankModal
        open={modalOpen}
        loading={loading}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        rewardLabel={`${selectedNum} posts`}
      />
    </div>
  );
}

// // ─────────────────────────────────────────────────────────────────────────────
// // ReferralTab — NOW reads from useActivityDashboard (React Query)
// // ─────────────────────────────────────────────────────────────────────────────

// function ReferralTab({ eligible, user, redeemedReferral, onRewardClaimed }) {
//   // ★ CHANGED: useActivityDashboard() instead of useReferral()
//   const {
//     activeReferralCount,
//     referralCount,
//     // referredUsers,
//     isLoading: dashLoading,
//   } = useActivityDashboard();

//   const { parseClaimError } = useRewardEligibility();
//   const slabs = usePlanSlabs('referral');

//   const claimed = (redeemedReferral ?? []).map(Number);

//   const [selected, setSelected]   = useState('');
//   const [loading, setLoading]     = useState(false);
//   const [modalOpen, setModalOpen] = useState(false);

//   const activeCount = activeReferralCount ?? 0;

//   const sortedSlabs = useMemo(() =>
//     [...slabs].sort((a, b) => a.referralCount - b.referralCount),
//     [slabs]
//   );

//   const bigSlabs    = sortedSlabs.filter(s => s.groceryCoupons > 0);
//   const tokenSlabs  = sortedSlabs.filter(s => s.groceryCoupons === 0 && s.referralToken > 0);

//   const selectedNum = selected ? Number(selected) : null;
//   const isClaimed   = selectedNum ? claimed.includes(selectedNum) : false;
//   const hasEnough   = selectedNum ? activeCount >= selectedNum : false;

//   const next = sortedSlabs.find(s => activeCount < s.referralCount)?.referralCount ?? null;
//   const prev = [...sortedSlabs].reverse().find(s => activeCount >= s.referralCount)?.referralCount ?? 0;

//   const btnState = !eligible   ? 'locked'
//     : !selectedNum             ? 'idle'
//     : isClaimed                ? 'claimed'
//     : !hasEnough               ? 'locked'
//     : 'ready';

//   const handleSubmit = async (bankDetails) => {
//     setLoading(true);
//     try {
//       const res = await apiRequest.post(
//         `${BACKEND_URL}/api/activity/referral`,
//         { referralCount: selectedNum, bankDetails },
//         { headers: { Authorization: `Bearer ${getToken()}` } }
//       );
//       toast.success(res.data?.message || `Referral reward for ${selectedNum} referrals claimed!`);
//       setSelected('');
//       setModalOpen(false);
//       onRewardClaimed?.();
//     } catch (err) {
//       toast.error(parseClaimError(err));
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Referral link
//   const referralId = user?.referralId ?? '';
//   const frontendUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
//   const inviteLink  = referralId ? `${frontendUrl}?ref=${referralId}` : '—';

//   const copyLink = () => {
//     if (!referralId) return;
//     navigator.clipboard.writeText(inviteLink)
//       .then(() => toast.success('Referral link copied!'))
//       .catch(() => toast.error('Could not copy link.'));
//   };

//   return (
//     <div>
//       {/* ★ CountDisplay shows "—" while loading, not "0" */}
//       <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
//         <div>
//           <CountDisplay value={referralCount} suffix="total" isLoading={dashLoading} />
//         </div>
//         <div>
//           <CountDisplay value={activeReferralCount} suffix="active" isLoading={dashLoading} />
//         </div>
//       </div>

//       <ProgressBar
//         current={activeCount}
//         next={next}
//         prev={prev}
//         label={next ? `${activeCount} / ${next} active referrals` : 'All milestones reached'}
//         color="#7c3aed"
//       />

//       {/* Big milestone chips */}
//       {bigSlabs.length > 0 && (
//         <>
//           <p style={styles.sectionHead}>Grocery + Shares milestones</p>
//           <div style={styles.milestoneGrid}>
//             {bigSlabs.map(s => {
//               const cl = claimed.includes(s.referralCount);
//               const ac = activeCount >= s.referralCount;
//               return (
//                 <MilestoneChip
//                   key={s.referralCount}
//                   label={`${s.referralCount}r`}
//                   sublabel={`₹${s.groceryCoupons.toLocaleString('en-IN')}`}
//                   state={cl ? 'claimed' : ac ? 'active' : 'locked'}
//                   badge={cl ? 'Claimed' : null}
//                 />
//               );
//             })}
//           </div>
//         </>
//       )}

//       {/* Token milestone chips */}
//       {tokenSlabs.length > 0 && (
//         <>
//           <p style={styles.sectionHead}>Token milestones</p>
//           <div style={styles.milestoneGrid}>
//             {tokenSlabs.map(s => {
//               const cl = claimed.includes(s.referralCount);
//               const ac = activeCount >= s.referralCount;
//               return (
//                 <MilestoneChip
//                   key={s.referralCount}
//                   label={`${s.referralCount}r`}
//                   sublabel={`+${s.referralToken}t`}
//                   state={cl ? 'claimed' : ac ? 'active' : 'locked'}
//                 />
//               );
//             })}
//           </div>
//         </>
//       )}

//       {/* Referral link */}
//       <p style={styles.sectionHead}>Your referral link</p>
//       <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
//         <code style={{
//           flex: 1, fontSize: 12, padding: '8px 10px',
//           background: 'var(--color-background-secondary)',
//           border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6,
//           overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
//           fontFamily: '"Courier New", monospace', color: 'var(--color-text-secondary)',
//         }}>
//           {inviteLink}
//         </code>
//         <button style={{ ...styles.cancelBtn, fontSize: 12, padding: '6px 12px' }} onClick={copyLink}>
//           Copy
//         </button>
//       </div>

//       {/* Claim row */}
//       <div style={styles.claimRow}>
//         <select
//           style={styles.select}
//           value={selected}
//           onChange={e => setSelected(e.target.value)}
//           disabled={!eligible}
//         >
//           <option value="">Select a milestone…</option>
//           {sortedSlabs.map(s => {
//             const isCl = claimed.includes(s.referralCount);
//             const ok   = activeCount >= s.referralCount;
//             const label = s.groceryCoupons
//               ? `${s.referralCount}r — ₹${s.groceryCoupons.toLocaleString('en-IN')} + ${s.shares}sh + ${s.referralToken}t`
//               : `${s.referralCount}r — ${s.referralToken} tokens`;
//             return (
//               <option key={s.referralCount} value={s.referralCount} disabled={!ok || isCl}>
//                 {label}{isCl ? ' — Claimed' : !ok ? ' — Locked' : ' — Available'}
//               </option>
//             );
//           })}
//         </select>

//         <button
//           style={styles.claimBtn(btnState)}
//           onClick={() => btnState === 'ready' && setModalOpen(true)}
//           disabled={btnState !== 'ready'}
//         >
//           {btnState === 'claimed' ? 'Claimed' : btnState === 'locked' && !eligible ? 'Locked' : 'Claim'}
//         </button>
//       </div>

//       <BankModal
//         open={modalOpen}
//         loading={loading}
//         onClose={() => setModalOpen(false)}
//         onSubmit={handleSubmit}
//         rewardLabel={`${selectedNum} referrals`}
//       />
//     </div>
//   );
// }
<ReferralTab />
// ─────────────────────────────────────────────────────────────────────────────
// Main: RewardsHub
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'streak',   label: 'Streak rewards'  },
  { id: 'posts',    label: 'Post rewards'     },
  { id: 'referral', label: 'Referral rewards' },
];

export default function RewardsHub({ initialTab = 'streak' }) {
  const { user } = useAuth();

  const { wallet, redeemed, refetch: refetchEarned } = useEarnedRewards();

  const {
    eligible, checking,
    kycGate, subscriptionGate,
    blockerCode, blockerMessage,
    parseClaimError,
  } = useRewardEligibility();

  // ★ useActivityDashboard: single source of truth for streak + referral counts.
  // invalidate() triggers an immediate background refetch after reward claims.
  const { invalidate: invalidateDashboard } = useActivityDashboard();

  const [activeTab, setActiveTab]   = useState(initialTab);
  const [streakModal, setStreakModal] = useState({ open: false, days: null, label: '' });
  const [streakLoading, setStreakLoading] = useState(false);

  // After ANY reward claim: refetch earned-rewards AND dashboard counts
  const onRewardClaimed = useCallback(() => {
    refetchEarned();
    invalidateDashboard();
  }, [refetchEarned, invalidateDashboard]);

  // Streak modal handler — lives at shell level so it's outside the tab tree
  const openModal = useCallback((type, value, label) => {
    if (type === 'streak') setStreakModal({ open: true, days: value, label });
  }, []);

  const handleStreakClaim = async (bankDetails) => {
    setStreakLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/streak-reward`,
        { streakslab: `${streakModal.days}days`, bankDetails },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(res.data?.message || `Streak reward for ${streakModal.days} days claimed!`);
      // ★ CHANGED: onRewardClaimed() invalidates BOTH earned-rewards and dashboard
      onRewardClaimed();
      setStreakModal({ open: false, days: null, label: '' });
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setStreakLoading(false);
    }
  };

  return (
    <div style={styles.shell}>
      {/* Eligibility banner — once, not per-tab */}
      {!checking && !eligible && (
        <EligibilityBanner
          kycGate={kycGate}
          subscriptionGate={subscriptionGate}
          blockerCode={blockerCode}
          blockerMessage={blockerMessage}
        />
      )}

      {/* Wallet */}
      <div style={styles.walletBar}>
        <div style={styles.walletCell}>
          <span style={styles.walletNum}>₹{(wallet.totalGroceryCoupons || 0).toLocaleString('en-IN')}</span>
          <span style={styles.walletLabel}>Grocery coupons</span>
        </div>
        <div style={styles.walletCell}>
          <span style={styles.walletNum}>{(wallet.totalShares || 0).toLocaleString('en-IN')}</span>
          <span style={styles.walletLabel}>Shares</span>
        </div>
        <div style={styles.walletCell}>
          <span style={styles.walletNum}>{(wallet.totalReferralToken || 0).toLocaleString('en-IN')}</span>
          <span style={styles.walletLabel}>Tokens</span>
        </div>
      </div>

      <RedeemGroceryCoupons
        totalGroceryCoupons={wallet.totalGroceryCoupons}
        eligible={eligible}
        user={user}
        onRedeemed={onRewardClaimed}   // optional: same callback the tabs use
      />

      {/* Tabs */}
      <nav style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'streak' && (
        <StreakTab
          eligible={eligible}
          parseClaimError={parseClaimError}
          openModal={openModal}
          redeemedStreak={redeemed.streak}
        />
      )}
      {activeTab === 'posts' && (
        <PostTab
          eligible={eligible}
          user={user}
          redeemedPosts={redeemed.posts}
          onRewardClaimed={onRewardClaimed}
        />
      )}
      {activeTab === 'referral' && (
        <ReferralTab
          eligible={eligible}
          user={user}
          redeemedReferral={redeemed.referral}
          onRewardClaimed={onRewardClaimed}
        />
      )}

      {/* Streak bank modal — outside tab tree so it survives tab switches */}
      <BankModal
        open={streakModal.open}
        loading={streakLoading}
        onClose={() => setStreakModal({ open: false, days: null, label: '' })}
        onSubmit={handleStreakClaim}
        rewardLabel={streakModal.label ?? 'Streak'}
      />
    </div>
  );
}