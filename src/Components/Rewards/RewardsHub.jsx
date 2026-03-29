/**
 * components/Rewards/RewardsHub.jsx
 *
 * Unified Rewards Hub — single page covering Streak, Post, and Referral rewards.
 *
 * Architecture decisions:
 *   - One eligibility check shared across all three tabs (useRewardEligibility cache).
 *   - One BankDetailsModal instance re-used across all three claim flows.
 *   - Claim logic lives entirely in each tab component; this shell only handles
 *     tab routing, the eligibility banner, and the wallet summary.
 *   - The eligibility banner is shown ONCE at the top, not repeated inside each tab.
 *
 * Backend endpoints consumed:
 *   GET  /api/activity/reward-eligibility     eligibility check
 *   POST /api/activity/referral               claim referral reward
 *   POST /api/activity/post-reward            claim post reward
 *   POST /api/activity/streak-reward          claim streak reward
 *   POST /api/activity/log-daily-streak       log a streak day
 *   GET  /api/activity/streak-history         heatmap data
 *   GET  /api/activity/user                   activity history
 *   GET  /api/auth/users/referred             referred users list
 *   GET  /api/rewards/referral|posts|streak   plan slabs
 *   GET  /api/auth/earned-rewards             wallet + all claims
 *
 * Design: editorial, refined, institutional — charcoal on cream with amber accents.
 * Monospace numbers for wallet values. Clean horizontal tab bar.
 */

import React, {
  useState, useEffect, useCallback, useMemo
} from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useAuth }             from '../../Context/Authorisation/AuthContext';
import { useReferral }         from '../../Context/Activity/ReferralContext';
import { useStreak }           from '../../Context/Activity/StreakContext';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';
import apiRequest              from '../../utils/apiRequest';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const getToken    = () => localStorage.getItem('token');

// ─────────────────────────────────────────────────────────────────────────────
// Tiny design-system primitives
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  // Page shell
  shell: {
    maxWidth: 720,
    margin: '0 auto',
    padding: '0 0 80px',
    fontFamily: '"Georgia", "Times New Roman", serif',
    color: 'var(--color-text-primary)',
  },
  // Masthead
  masthead: {
    padding: '32px 0 20px',
    borderBottom: '1px solid var(--color-border-tertiary)',
    marginBottom: 24,
  },
  mastheadTitle: {
    fontSize: 26,
    fontWeight: 400,
    letterSpacing: '-0.5px',
    margin: '0 0 4px',
    fontFamily: '"Georgia", serif',
  },
  mastheadSub: {
    fontSize: 13,
    color: 'var(--color-text-secondary)',
    margin: 0,
    fontFamily: 'var(--font-sans)',
  },
  // Wallet bar
  walletBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 1,
    background: 'var(--color-border-tertiary)',
    border: '0.5px solid var(--color-border-tertiary)',
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 24,
  },
  walletCell: {
    background: 'var(--color-background-primary)',
    padding: '14px 16px',
    textAlign: 'center',
  },
  walletNum: {
    display: 'block',
    fontSize: 22,
    fontWeight: 500,
    fontFamily: '"Courier New", "Courier", monospace',
    letterSpacing: '-1px',
    color: 'var(--color-text-primary)',
    lineHeight: 1.1,
  },
  walletLabel: {
    display: 'block',
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    color: 'var(--color-text-tertiary)',
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  // Tab bar
  tabBar: {
    display: 'flex',
    gap: 0,
    borderBottom: '1px solid var(--color-border-tertiary)',
    marginBottom: 28,
  },
  tab: (active) => ({
    padding: '10px 18px',
    fontSize: 13,
    fontFamily: 'var(--font-sans)',
    fontWeight: active ? 500 : 400,
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    background: 'none',
    border: 'none',
    borderBottom: active ? '2px solid var(--color-text-primary)' : '2px solid transparent',
    cursor: 'pointer',
    marginBottom: -1,
    transition: 'color 0.12s',
    letterSpacing: '-0.1px',
  }),
  // Eligibility banner
  banner: (code) => ({
    display: 'flex',
    gap: 12,
    padding: '12px 14px',
    marginBottom: 24,
    borderRadius: 8,
    border: '0.5px solid',
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    lineHeight: 1.5,
    ...(code === 'REWARDS_FROZEN'
      ? { background: 'var(--color-background-danger)', borderColor: 'var(--color-border-danger)', color: 'var(--color-text-danger)' }
      : { background: 'var(--color-background-warning)', borderColor: 'var(--color-border-warning)', color: 'var(--color-text-warning)' }
    ),
  }),
  bannerCta: {
    display: 'inline-block',
    marginTop: 6,
    fontSize: 12,
    fontWeight: 500,
    textDecoration: 'underline',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    color: 'inherit',
    padding: 0,
    fontFamily: 'var(--font-sans)',
  },
  // Section headers
  sectionHead: {
    fontSize: 11,
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: 'var(--color-text-tertiary)',
    margin: '24px 0 12px',
    padding: '0 0 6px',
    borderBottom: '0.5px solid var(--color-border-tertiary)',
  },
  // Progress row
  progressWrap: {
    marginBottom: 20,
    fontFamily: 'var(--font-sans)',
  },
  progressRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  progressText: { fontSize: 13, color: 'var(--color-text-secondary)' },
  progressPct:  { fontSize: 12, fontFamily: '"Courier New", monospace', fontWeight: 500, color: 'var(--color-text-primary)' },
  progressTrack: {
    height: 3,
    background: 'var(--color-border-tertiary)',
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressBar: (pct, color = '#b45309') => ({
    height: '100%',
    width: `${pct}%`,
    background: color,
    borderRadius: 2,
    transition: 'width 0.4s ease',
  }),
  progressHint: { fontSize: 12, color: 'var(--color-text-tertiary)' },
  // Milestone grid
  milestoneGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: 8,
    marginBottom: 20,
  },
  milestoneChip: (state) => ({
    padding: '10px 12px',
    borderRadius: 6,
    border: '0.5px solid',
    fontFamily: 'var(--font-sans)',
    textAlign: 'center',
    fontSize: 12,
    ...(state === 'claimed'
      ? { background: 'var(--color-background-success)', borderColor: 'var(--color-border-success)', color: 'var(--color-text-success)' }
      : state === 'active'
      ? { background: 'var(--color-background-primary)', borderColor: 'var(--color-border-secondary)', color: 'var(--color-text-primary)' }
      : { background: 'var(--color-background-secondary)', borderColor: 'var(--color-border-tertiary)', color: 'var(--color-text-tertiary)' }
    ),
  }),
  chipMain: { display: 'block', fontSize: 15, fontFamily: '"Courier New", monospace', fontWeight: 500 },
  chipSub: { display: 'block', fontSize: 11, marginTop: 2, opacity: 0.75 },
  chipBadge: {
    display: 'inline-block', marginTop: 4, fontSize: 10,
    fontFamily: 'var(--font-sans)', fontWeight: 500,
    padding: '1px 6px', borderRadius: 3,
    background: 'var(--color-background-success)',
    color: 'var(--color-text-success)',
    border: '0.5px solid var(--color-border-success)',
  },
  // Claim row
  claimRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 0',
    borderTop: '0.5px solid var(--color-border-tertiary)',
    fontFamily: 'var(--font-sans)',
    flexWrap: 'wrap',
  },
  select: {
    flex: '1 1 200px',
    fontSize: 13,
    padding: '8px 10px',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6,
    background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
    outline: 'none',
    minWidth: 0,
  },
  // Claim button
  claimBtn: (state) => ({
    padding: '8px 18px',
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    cursor: state === 'ready' ? 'pointer' : 'not-allowed',
    border: '0.5px solid',
    transition: 'all 0.12s',
    whiteSpace: 'nowrap',
    ...(state === 'ready'
      ? { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', borderColor: 'var(--color-text-primary)' }
      : state === 'claimed'
      ? { background: 'var(--color-background-success)', color: 'var(--color-text-success)', borderColor: 'var(--color-border-success)' }
      : state === 'locked'
      ? { background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border-tertiary)' }
      : { background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', borderColor: 'var(--color-border-tertiary)' }
    ),
  }),
  // Bank modal backdrop (faux viewport)
  modalBackdrop: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    background: 'var(--color-background-primary)',
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 12,
    padding: '28px 28px 22px',
    width: '100%',
    maxWidth: 400,
    fontFamily: 'var(--font-sans)',
  },
  modalTitle: {
    fontSize: 15, fontWeight: 500, margin: '0 0 20px',
    color: 'var(--color-text-primary)',
    fontFamily: 'var(--font-sans)',
  },
  fieldLabel: {
    display: 'block', fontSize: 12, color: 'var(--color-text-secondary)',
    marginBottom: 4,
  },
  fieldWrap: { marginBottom: 14 },
  input: {
    width: '100%', boxSizing: 'border-box',
    padding: '8px 10px', fontSize: 13,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6, background: 'var(--color-background-primary)',
    color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)',
    outline: 'none',
  },
  modalFooter: {
    display: 'flex', justifyContent: 'flex-end', gap: 10,
    marginTop: 22,
    paddingTop: 14,
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
    border: '0.5px solid var(--color-text-primary)',
    borderRadius: 6,
    background: disabled ? 'var(--color-background-secondary)' : 'var(--color-text-primary)',
    color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-background-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: 'var(--font-sans)',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// BankDetailsModal — portable, portal-like (fixed positioning via faux viewport)
// ─────────────────────────────────────────────────────────────────────────────

function BankModal({ open, loading, onClose, onSubmit, rewardLabel }) {
  const [form, setForm] = useState({ accountNumber: '', confirm: '', ifscCode: '', panNumber: '' });
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
        onChange={e => { setForm(p => ({ ...p, [key]: e.target.value })); setErrors(p => ({ ...p, [key]: undefined })); }}
      />
      {errors[key] && <span style={{ fontSize: 11, color: 'var(--color-text-danger)', marginTop: 2, display: 'block' }}>{errors[key]}</span>}
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
// Hook: slab data from the plan-based reward API
// ─────────────────────────────────────────────────────────────────────────────

function usePlanSlabs(type) {
  const [slabs, setSlabs] = useState([]);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND_URL}/api/rewards/${type}`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.slabs) setSlabs(d.slabs); })
      .catch(() => {});
  }, [type]);
  return slabs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook: wallet totals
// ─────────────────────────────────────────────────────────────────────────────

function useWallet() {
  const [wallet, setWallet] = useState({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
  const fetchWallet = useCallback(() => {
    const token = getToken();
    if (!token) return;
    fetch(`${BACKEND_URL}/api/auth/earned-rewards`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.wallet) setWallet(d.wallet); })
      .catch(() => {});
  }, []);
  useEffect(() => { fetchWallet(); }, [fetchWallet]);
  return { wallet, refetchWallet: fetchWallet };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────────

function ProgressBar({ current, next, prev = 0, label, color }) {
  if (!next) return null;
  const pct = Math.min(100, Math.round(((current - prev) / (next - prev)) * 100));
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

// ─────────────────────────────────────────────────────────────────────────────
// EligibilityBanner — single shared banner at page top
// ─────────────────────────────────────────────────────────────────────────────

function EligibilityBanner({ kycGate, subscriptionGate, blockerCode, blockerMessage }) {
  const navigate = useNavigate();
  if (!blockerCode) return null;

  const items = [];
  if (!kycGate.passed) items.push({ label: kycGate.label, cta: kycGate.ctaLabel, path: kycGate.ctaPath });
  if (!subscriptionGate.passed) items.push({ label: subscriptionGate.label, cta: subscriptionGate.ctaLabel, path: subscriptionGate.ctaPath });

  return (
    <div style={styles.banner(blockerCode)}>
      <span style={{ fontSize: 16, flexShrink: 0, lineHeight: 1 }}>
        {blockerCode === 'REWARDS_FROZEN' ? '!' : 'i'}
      </span>
      <div>
        <strong style={{ fontFamily: 'var(--font-sans)', fontSize: 13 }}>Rewards locked</strong>
        <p style={{ margin: '2px 0 6px', fontFamily: 'var(--font-sans)', fontSize: 13 }}>{blockerMessage}</p>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {items.map(it => (
            <button key={it.label} style={styles.bannerCta} onClick={() => navigate(it.path)}>
              {it.cta} →
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// StreakTab
// ─────────────────────────────────────────────────────────────────────────────

function StreakTab({ eligible, parseClaimError, openModal }) {
  const { streakCount, totalUniqueDays, claimedDays } = useStreak();
  const slabs = usePlanSlabs('streak');

  const accurateCount = totalUniqueDays ?? streakCount ?? 0;

  const milestones = useMemo(() =>
    slabs.map(s => s.dailystreak).filter(d => typeof d === 'number').sort((a, b) => a - b),
    [slabs]
  );

  const next = milestones.find(m => accurateCount < m) ?? null;
  const prev = [...milestones].reverse().find(m => accurateCount >= m) ?? 0;

  const [selected, setSelected] = useState('');
  const selectedNum = selected ? Number(selected) : null;
  const slabKey = selectedNum ? `${selectedNum}days` : null;
  const isClaimed = slabKey ? (claimedDays || []).includes(slabKey) : false;
  const hasEnough = selectedNum ? accurateCount >= selectedNum : false;

  const btnState = !eligible ? 'locked'
    : !selectedNum ? 'idle'
    : isClaimed ? 'claimed'
    : !hasEnough ? 'locked'
    : 'ready';

  const handleOpen = () => {
    if (btnState !== 'ready') return;
    openModal('streak', selectedNum, `${selectedNum}-day streak`);
  };

  return (
    <div>
      {/* Hero */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 40, fontWeight: 400, letterSpacing: -2, lineHeight: 1 }}>
          {accurateCount}
        </span>
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>days</span>
      </div>

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
          const key = `${day}days`;
          const isClaimed = (claimedDays || []).includes(key);
          const active = accurateCount >= day;
          return (
            <MilestoneChip
              key={day}
              label={`${day}d`}
              state={isClaimed ? 'claimed' : active ? 'active' : 'locked'}
              badge={isClaimed ? 'Claimed' : null}
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
            const key = `${day}days`;
            const isCl = (claimedDays || []).includes(key);
            const ok   = accurateCount >= day;
            return (
              <option key={day} value={day} disabled={!ok || isCl}>
                {day} days{isCl ? ' — Claimed' : !ok ? ' — Locked' : ' — Available'}
              </option>
            );
          })}
        </select>

        <button style={styles.claimBtn(btnState)} onClick={handleOpen} disabled={btnState !== 'ready'}>
          {btnState === 'claimed' ? 'Claimed' : btnState === 'locked' && !eligible ? 'Locked' : 'Claim'}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PostTab
// ─────────────────────────────────────────────────────────────────────────────

function PostTab({ eligible, user }) {
  const slabs = usePlanSlabs('posts');
  const [postCount, setPostCount] = useState(0);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [claimed, setClaimed] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const milestones = useMemo(() =>
    slabs.map(s => s.postsCount).filter(p => typeof p === 'number').sort((a, b) => a - b),
    [slabs]
  );

  useEffect(() => {
    setClaimed((user?.redeemedPostSlabs ?? []).map(String));
  }, [user]);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // Count from the posts endpoint — lean fallback
    fetch(`${BACKEND_URL}/api/posts/fetchallposts?limit=1`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        // Try pagination total if available
        if (d?.pagination) return;
        // Fallback: fetch activity history
        return fetch(`${BACKEND_URL}/api/activity/user`, { headers: { Authorization: `Bearer ${token}` } })
          .then(r => r.ok ? r.json() : null)
          .then(ad => {
            if (!ad?.activities) return;
            const posts = ad.activities.filter(a => a.type === 'post' || a.type === 'post_reward' || a.userpost);
            setPostCount(posts.length);
          });
      })
      .catch(() => {});
  }, []);

  const { parseClaimError } = useRewardEligibility();

  const selectedNum = selected ? Number(selected) : null;
  const isClaimed = selectedNum ? claimed.includes(String(selectedNum)) : false;
  const hasEnough = selectedNum ? postCount >= selectedNum : false;

  const next = milestones.find(m => postCount < m) ?? null;
  const prev = [...milestones].reverse().find(m => postCount >= m) ?? 0;

  const btnState = !eligible ? 'locked'
    : !selectedNum ? 'idle'
    : isClaimed ? 'claimed'
    : !hasEnough ? 'locked'
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
      setClaimed(p => [...p, String(selectedNum)]);
      setSelected('');
      setModalOpen(false);
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
        <span style={{ fontFamily: '"Courier New", monospace', fontSize: 40, fontWeight: 400, letterSpacing: -2, lineHeight: 1 }}>
          {postCount}
        </span>
        <span style={{ fontSize: 14, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)' }}>posts</span>
      </div>

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

        <button style={styles.claimBtn(btnState)} onClick={() => btnState === 'ready' && setModalOpen(true)} disabled={btnState !== 'ready'}>
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

// ─────────────────────────────────────────────────────────────────────────────
// ReferralTab
// ─────────────────────────────────────────────────────────────────────────────

function ReferralTab({ eligible, user }) {
  const { referralCount = 0, referredUsers = [], fetchReferralData } = useReferral();
  const slabs = usePlanSlabs('referral');
  const [selected, setSelected]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [claimed, setClaimed]     = useState([]);
  const { parseClaimError }       = useRewardEligibility();

  const activeCount = useMemo(
    () => referredUsers.filter(u => u.subscription?.active).length,
    [referredUsers]
  );

  const sortedSlabs = useMemo(() =>
    [...slabs].filter(s => typeof s.referralCount === 'number').sort((a, b) => a.referralCount - b.referralCount),
    [slabs]
  );
  const bigSlabs   = useMemo(() => sortedSlabs.filter(s => s.groceryCoupons > 0 || s.shares > 0), [sortedSlabs]);
  const tokenSlabs = useMemo(() => sortedSlabs.filter(s => !s.groceryCoupons && !s.shares && s.referralToken > 0), [sortedSlabs]);

  const { referralId } = user || {};
  const inviteLink = referralId
    ? `${window.location.origin}/invite/${referralId}`
    : `${window.location.origin}/invite`;

  useEffect(() => {
    setClaimed((user?.redeemedReferralSlabs ?? []).map(Number));
  }, [user]);

  const selectedNum = selected ? Number(selected) : null;
  const isClaimed = selectedNum ? claimed.includes(selectedNum) : false;
  const hasEnough = selectedNum ? activeCount >= selectedNum : false;

  const next = bigSlabs.find(s => activeCount < s.referralCount) ?? null;
  const prev = [...bigSlabs].reverse().find(s => activeCount >= s.referralCount) ?? null;

  const btnState = !eligible ? 'locked'
    : !selectedNum ? 'idle'
    : isClaimed ? 'claimed'
    : !hasEnough ? 'locked'
    : 'ready';

  const handleSubmit = async (bankDetails) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/referral`,
        { referralCount: selectedNum, bankDetails },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success(res.data?.message || `Referral reward for ${selectedNum} referrals claimed!`);
      setClaimed(p => [...p, selectedNum]);
      fetchReferralData();
      setSelected('');
      setModalOpen(false);
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setLoading(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink).then(() => toast.success('Referral link copied!'));
  };

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'flex', gap: 1, background: 'var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden', marginBottom: 20 }}>
        {[
          { num: referralCount, label: 'Total referred' },
          { num: activeCount, label: 'Active (paid)' },
          { num: referralCount - activeCount, label: 'Inactive' },
        ].map(({ num, label }) => (
          <div key={label} style={{ flex: 1, background: 'var(--color-background-primary)', padding: '12px 14px', textAlign: 'center' }}>
            <span style={{ display: 'block', fontFamily: '"Courier New", monospace', fontSize: 22, fontWeight: 400 }}>{num}</span>
            <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</span>
          </div>
        ))}
      </div>

      {activeCount < referralCount && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontFamily: 'var(--font-sans)', padding: '8px 12px', background: 'var(--color-background-secondary)', borderRadius: 6, marginBottom: 16, border: '0.5px solid var(--color-border-tertiary)' }}>
          {referralCount - activeCount} referred member{referralCount - activeCount !== 1 ? 's' : ''} have no active subscription. Rewards are based on <em>active</em> referrals only.
        </div>
      )}

      <ProgressBar
        current={activeCount}
        next={next?.referralCount ?? null}
        prev={prev?.referralCount ?? 0}
        label={next ? `${activeCount} / ${next.referralCount} active referrals` : 'All big milestones reached'}
        color="#7c3aed"
      />

      {/* Big milestone chips */}
      {bigSlabs.length > 0 && (
        <>
          <p style={styles.sectionHead}>Big milestones</p>
          <div style={styles.milestoneGrid}>
            {bigSlabs.map(s => {
              const cl = claimed.includes(s.referralCount);
              const ac = activeCount >= s.referralCount;
              return (
                <MilestoneChip
                  key={s.referralCount}
                  label={`${s.referralCount}r`}
                  sublabel={s.groceryCoupons ? `₹${s.groceryCoupons.toLocaleString('en-IN')}` : `${s.referralToken}t`}
                  state={cl ? 'claimed' : ac ? 'active' : 'locked'}
                  badge={cl ? 'Claimed' : null}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Token milestone chips */}
      {tokenSlabs.length > 0 && (
        <>
          <p style={styles.sectionHead}>Per-referral tokens (11–{tokenSlabs[tokenSlabs.length - 1]?.referralCount})</p>
          <div style={{ ...styles.milestoneGrid, gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))' }}>
            {tokenSlabs.map(s => {
              const cl = claimed.includes(s.referralCount);
              const ac = activeCount >= s.referralCount;
              return (
                <MilestoneChip
                  key={s.referralCount}
                  label={`${s.referralCount}r`}
                  sublabel={`+${s.referralToken}t`}
                  state={cl ? 'claimed' : ac ? 'active' : 'locked'}
                />
              );
            })}
          </div>
        </>
      )}

      {/* Referral link */}
      <p style={styles.sectionHead}>Your referral link</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <code style={{ flex: 1, fontSize: 12, padding: '8px 10px', background: 'var(--color-background-secondary)', border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: '"Courier New", monospace', color: 'var(--color-text-secondary)' }}>
          {inviteLink}
        </code>
        <button style={{ ...styles.cancelBtn, fontSize: 12, padding: '6px 12px' }} onClick={copyLink}>Copy</button>
      </div>

      {/* Claim row */}
      <div style={styles.claimRow}>
        <select
          style={styles.select}
          value={selected}
          onChange={e => setSelected(e.target.value)}
          disabled={!eligible}
        >
          <option value="">Select a milestone…</option>
          {sortedSlabs.map(s => {
            const isCl = claimed.includes(s.referralCount);
            const ok   = activeCount >= s.referralCount;
            const label = s.groceryCoupons
              ? `${s.referralCount}r — ₹${s.groceryCoupons.toLocaleString('en-IN')} + ${s.shares}sh + ${s.referralToken}t`
              : `${s.referralCount}r — ${s.referralToken} tokens`;
            return (
              <option key={s.referralCount} value={s.referralCount} disabled={!ok || isCl}>
                {label}{isCl ? ' — Claimed' : !ok ? ' — Locked' : ' — Available'}
              </option>
            );
          })}
        </select>

        <button style={styles.claimBtn(btnState)} onClick={() => btnState === 'ready' && setModalOpen(true)} disabled={btnState !== 'ready'}>
          {btnState === 'claimed' ? 'Claimed' : btnState === 'locked' && !eligible ? 'Locked' : 'Claim'}
        </button>
      </div>

      <BankModal
        open={modalOpen}
        loading={loading}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        rewardLabel={`${selectedNum} referrals`}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: RewardsHub
// ─────────────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'streak',   label: 'Streak rewards'   },
  { id: 'posts',    label: 'Post rewards'     },
  { id: 'referral', label: 'Referral rewards' },
];

export default function RewardsHub({ initialTab = 'streak' }) {
  const { user }                 = useAuth();
  const { wallet, refetchWallet } = useWallet();
  const {
    eligible, checking,
    kycGate, subscriptionGate,
    blockerCode, blockerMessage,
    parseClaimError,
  } = useRewardEligibility();

  const [activeTab, setActiveTab] = useState(initialTab);

  // Streak tab also needs the modal to live in this shell so one BankModal
  // serves all three tabs. StreakTab calls openModal(type, milestone, label).
  const [streakModal, setStreakModal] = useState({ open: false, days: null });
  const [streakLoading, setStreakLoading] = useState(false);
  const { fetchStreakHistory } = useStreak();

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
      fetchStreakHistory?.();
      refetchWallet();
      setStreakModal({ open: false, days: null });
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setStreakLoading(false);
    }
  };

  return (
    <div style={styles.shell}>
      {/* Masthead */}
      <div style={styles.masthead}>
        <h1 style={styles.mastheadTitle}>Rewards</h1>
        <p style={styles.mastheadSub}>Claim grocery coupons, shares, and referral tokens</p>
      </div>

      {/* Eligibility banner — shown once, not per-tab */}
      {!checking && !eligible && (
        <EligibilityBanner
          kycGate={kycGate}
          subscriptionGate={subscriptionGate}
          blockerCode={blockerCode}
          blockerMessage={blockerMessage}
        />
      )}

      {/* Wallet bar */}
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

      {/* Tab bar */}
      <nav style={styles.tabBar}>
        {TABS.map(t => (
          <button key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      {activeTab === 'streak' && (
        <StreakTab eligible={eligible} parseClaimError={parseClaimError} openModal={openModal} />
      )}
      {activeTab === 'posts' && (
        <PostTab eligible={eligible} user={user} />
      )}
      {activeTab === 'referral' && (
        <ReferralTab eligible={eligible} user={user} />
      )}

      {/* Streak bank modal lives here so it's outside the tab tree */}
      <BankModal
        open={streakModal.open}
        loading={streakLoading}
        onClose={() => setStreakModal({ open: false, days: null })}
        onSubmit={handleStreakClaim}
        rewardLabel={streakModal.label ?? 'Streak'}
      />
    </div>
  );
}