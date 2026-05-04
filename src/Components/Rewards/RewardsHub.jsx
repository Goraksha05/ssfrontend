/* components/Rewards/RewardsHub.jsx */

import React, {
  useState, useEffect, useCallback, useMemo,
} from 'react';
import { useNavigate }            from 'react-router-dom';
import { toast }                  from 'react-toastify';
import { useQueryClient }         from '@tanstack/react-query';

import { useAuth }                from '../../Context/Authorisation/AuthContext';
import { useRewardEligibility }   from '../../hooks/useRewardEligibility';
import {
  useActivityDashboard,
  DASHBOARD_QUERY_KEY,
}                                 from '../../hooks/useActivityDashboard';
import apiRequest                 from '../../utils/apiRequest';
import BankDetailsModal           from '../Common/BankDetailsModal';
import ReferralTab                from './ReferralTab';
import { SpecialOfferProvider }   from '../../Context/SpecialOffer/SpecialOfferContext';
import SpecialOfferTab            from './SpecialOfferTab';
import { getSocket }              from '../../WebSocket/WebSocketClient';

const BACKEND_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
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
    overflowX: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  tab: (active) => ({
    padding: '10px 18px', fontSize: 13, fontFamily: 'var(--font-sans)',
    fontWeight: active ? 500 : 400,
    color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
    background: 'none', border: 'none',
    borderBottom: active ? '2px solid var(--color-text-primary)' : '2px solid transparent',
    cursor: 'pointer', marginBottom: -1, transition: 'color 0.12s', letterSpacing: '-0.1px',
    whiteSpace: 'nowrap',
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
  submitBtn: (disabled) => ({
    padding: '7px 18px', fontSize: 13, fontWeight: 500,
    border: '0.5px solid var(--color-text-primary)', borderRadius: 6,
    background: disabled ? 'var(--color-background-secondary)' : 'var(--color-text-primary)',
    color: disabled ? 'var(--color-text-tertiary)' : 'var(--color-background-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-sans)',
  }),
};

// ─────────────────────────────────────────────────────────────────────────────
// Local hooks — token read from useAuth() internally; not passed as a prop
// ─────────────────────────────────────────────────────────────────────────────

function usePlanSlabs(type) {
  const { token } = useAuth();
  const [slabs, setSlabs] = useState([]);

  useEffect(() => {
    if (!token) return;
    apiRequest
      .get(`${BACKEND_URL}/api/rewards/${type}`, { _silenceToast: true })
      .then((res) => { if (res.data?.slabs) setSlabs(res.data.slabs); })
      .catch(() => {});
  }, [type, token]);

  return slabs;
}

function useEarnedRewards() {
  const { token }      = useAuth();
  const queryClient    = useQueryClient();

  const [wallet,  setWallet]  = useState({ totalGroceryCoupons: 0, totalShares: 0, totalReferralToken: 0 });
  const [redeemed, setRedeemed] = useState({ posts: [], referral: [], streak: [] });
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    apiRequest
      .get(`${BACKEND_URL}/api/auth/earned-rewards`, { _silenceToast: true })
      .then((res) => {
        const d = res.data;
        if (!d) return;
        if (d.wallet)  setWallet(d.wallet);
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
  }, [token]);

  const refetch = useCallback(() => {
    fetch_();
    queryClient.invalidateQueries({ queryKey: DASHBOARD_QUERY_KEY });
  }, [fetch_, queryClient]);

  useEffect(() => { fetch_(); }, [fetch_]);

  return { wallet, redeemed, loading, refetch };
}

function useMyPostCount() {
  const { token } = useAuth();
  const [postCount, setPostCount] = useState(0);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    apiRequest
      .get(`${BACKEND_URL}/api/posts/my-count`, { _silenceToast: true })
      .then((res) => {
        if (res.data?.count !== undefined) setPostCount(Number(res.data.count));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  return { postCount, loading };
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared UI sub-components
// ─────────────────────────────────────────────────────────────────────────────

function CountDisplay({ value, suffix, isLoading }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 20 }}>
      <span style={{
        fontFamily: '"Courier New", monospace', fontSize: 40,
        fontWeight: 400, letterSpacing: -2, lineHeight: 1,
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

function ProgressBar({ current, next, prev = 0, label, color }) {
  if (!next) return null;
  const range     = next - prev;
  const pct       = range > 0 ? Math.min(100, Math.round(((current - prev) / range) * 100)) : 100;
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
          {items.map((it) => (
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
// StreakTab — reads token from useAuth internally
// ─────────────────────────────────────────────────────────────────────────────

function StreakTab({ eligible, parseClaimError, openModal, redeemedStreak }) {
  const { streakCount, isLoading: dashLoading } = useActivityDashboard();
  const slabs = usePlanSlabs('streak');

  const claimedDays   = redeemedStreak ?? [];
  const accurateCount = streakCount ?? 0;

  const milestones = useMemo(
    () => slabs.map((s) => s.dailystreak).filter((d) => typeof d === 'number').sort((a, b) => a - b),
    [slabs]
  );

  const next = milestones.find((m) => accurateCount < m)  ?? null;
  const prev = [...milestones].reverse().find((m) => accurateCount >= m) ?? 0;

  const [selected, setSelected] = useState('');
  const selectedNum = selected ? Number(selected) : null;
  const slabKey     = selectedNum ? `${selectedNum}days` : null;
  const isClaimed   = slabKey ? claimedDays.includes(slabKey) : false;
  const hasEnough   = selectedNum ? accurateCount >= selectedNum : false;

  const btnState =
    !eligible    ? 'locked'
    : !selectedNum ? 'idle'
    : isClaimed    ? 'claimed'
    : !hasEnough   ? 'locked'
    :                'ready';

  return (
    <div>
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
        {milestones.map((day) => {
          const key    = `${day}days`;
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
          onChange={(e) => setSelected(e.target.value)}
          disabled={!eligible}
        >
          <option value="">Select a milestone…</option>
          {milestones.map((day) => {
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
// PostTab — reads token and user from useAuth internally
// ─────────────────────────────────────────────────────────────────────────────

function PostTab({ eligible, redeemedPosts, onRewardClaimed }) {
  const { user }                             = useAuth();
  const slabs                                = usePlanSlabs('posts');
  const { postCount, loading: countLoading } = useMyPostCount();
  const { parseClaimError }                  = useRewardEligibility();

  const claimed = (redeemedPosts ?? []).map(String);

  const [selected,  setSelected]  = useState('');
  const [loading,   setLoading]   = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const milestones = useMemo(
    () => slabs.map((s) => s.postsCount).filter((p) => typeof p === 'number').sort((a, b) => a - b),
    [slabs]
  );

  const selectedNum = selected ? Number(selected) : null;
  const isClaimed   = selectedNum ? claimed.includes(String(selectedNum)) : false;
  const hasEnough   = selectedNum ? postCount >= selectedNum : false;

  const next = milestones.find((m) => postCount < m)  ?? null;
  const prev = [...milestones].reverse().find((m) => postCount >= m) ?? 0;

  const btnState =
    !eligible    ? 'locked'
    : !selectedNum ? 'idle'
    : isClaimed    ? 'claimed'
    : !hasEnough   ? 'locked'
    :                'ready';

  const handleBankSubmit = async (bankDetails, successCallback) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/post-reward`,
        { postreward: selectedNum, bankDetails },
      );
      toast.success(res.data?.message || `Post reward for ${selectedNum} posts claimed!`);
      setSelected('');
      setModalOpen(false);
      successCallback?.();
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
        {milestones.map((m) => {
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
          onChange={(e) => setSelected(e.target.value)}
          disabled={!eligible}
        >
          <option value="">Select a milestone…</option>
          {milestones.map((m) => {
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

      <BankDetailsModal
        isOpen={modalOpen}
        loading={loading}
        onClose={() => setModalOpen(false)}
        onSubmit={handleBankSubmit}
        rewardLabel={`${selectedNum} posts`}
        defaultValues={user?.bankDetails}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main: RewardsHub
// ─────────────────────────────────────────────────────────────────────────────

export default function RewardsHub({ initialTab = 'streak' }) {
  const { user } = useAuth();
  const socket   = getSocket();

  // useEarnedRewards no longer needs a token parameter — reads useAuth() internally
  const { wallet, redeemed, refetch: refetchEarned } = useEarnedRewards();

  const {
    eligible, checking,
    kycGate, subscriptionGate,
    blockerCode, blockerMessage,
    parseClaimError,
  } = useRewardEligibility();

  const { invalidate: invalidateDashboard } = useActivityDashboard();

  const [activeTab,    setActiveTab]    = useState(initialTab);
  const [streakModal,  setStreakModal]  = useState({ open: false, days: null, label: '' });
  const [streakLoading, setStreakLoading] = useState(false);

  const onRewardClaimed = useCallback(() => {
    refetchEarned();
    invalidateDashboard();
  }, [refetchEarned, invalidateDashboard]);

  const openModal = useCallback((type, value, label) => {
    if (type === 'streak') setStreakModal({ open: true, days: value, label });
  }, []);

  const handleStreakClaim = async (bankDetails, successCallback) => {
    setStreakLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/streak-reward`,
        { streakslab: `${streakModal.days}days`, bankDetails },
      );
      toast.success(res.data?.message || `Streak reward for ${streakModal.days} days claimed!`);
      onRewardClaimed();
      setStreakModal({ open: false, days: null, label: '' });
      successCallback?.();
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setStreakLoading(false);
    }
  };

  const displayGrocery = wallet.availableBalance ?? wallet.totalGroceryCoupons ?? 0;

  const TABS = useMemo(() => [
    { id: 'streak',        label: 'Streak'            },
    { id: 'referral',      label: 'Referral'          },
    { id: 'posts',         label: 'Posts'             },
    { id: 'special-offer', label: '🔥 Special Offer'  },
  ], []);

  useEffect(() => {
    if (!TABS.find((t) => t.id === activeTab)) {
      setActiveTab('streak');
    }
  }, [activeTab, TABS]);

  return (
    // SpecialOfferProvider reads token / user from AuthContext — no prop needed
      <div style={styles.shell}>

        {/* Eligibility banner */}
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
            <span style={styles.walletNum}>₹{displayGrocery.toLocaleString('en-IN')}</span>
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

        {/* Tabs */}
        <nav style={styles.tabBar}>
          {TABS.map((t) => (
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
        {activeTab === 'referral' && (
          <ReferralTab
            eligible={eligible}
            user={user}
            redeemedReferral={redeemed.referral}
            onRewardClaimed={onRewardClaimed}
          />
        )}
        {activeTab === 'posts' && (
          <PostTab
            eligible={eligible}
            redeemedPosts={redeemed.posts}
            onRewardClaimed={onRewardClaimed}
          />
        )}
        <SpecialOfferProvider socket={socket}>
        {activeTab === 'special-offer' && (
          <SpecialOfferTab
            user={user}
            eligible={eligible}
          />
        )}
        </SpecialOfferProvider>

        {/* Streak bank-details modal */}
        <BankDetailsModal
          isOpen={streakModal.open}
          loading={streakLoading}
          onClose={() => setStreakModal({ open: false, days: null, label: '' })}
          onSubmit={handleStreakClaim}
          rewardLabel={streakModal.label ?? 'Streak'}
          defaultValues={user?.bankDetails}
        />
      </div>
  );
}