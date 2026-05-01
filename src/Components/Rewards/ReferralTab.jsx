/**
 * ReferralTab.jsx — v3
 *
 * CHANGES from v2:
 *  • Removed all local `getToken()` / `localStorage.getItem('token')` calls.
 *    Token is now sourced exclusively from `useAuth()` (AuthContext).
 *  • All backend requests now go through `apiRequest` (axios instance with
 *    interceptors) instead of raw `fetch()`.  This means the token-refresh
 *    queue, retry logic, and toast handling are applied uniformly.
 *  • `usePlanSlabs` and `useReferredUsers` accept `token` as a parameter and
 *    use `apiRequest.get()` — no manual Authorization header needed because
 *    the apiRequest interceptor attaches it automatically.
 *  • `handleBankSubmit` no longer passes a manual Authorization header to
 *    `apiRequest.post()`.
 */

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import { useActivityDashboard } from '../../hooks/useActivityDashboard';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';
import BankDetailsModal from '../Common/BankDetailsModal';
import ShareModal from '../UserActivities/ShareModal';
import { buildInviteLink, copyToClipboard } from '../../utils/inviteLink';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

// ─── Local style tokens ────────────────────────────────────────────────────────

const S = {
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
  progressBar: (pct, color) => ({
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
  cancelBtn: {
    padding: '7px 16px', fontSize: 13, fontWeight: 400,
    border: '0.5px solid var(--color-border-secondary)',
    borderRadius: 6, background: 'none',
    color: 'var(--color-text-secondary)', cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
  },
};

// ─── Inline helpers ────────────────────────────────────────────────────────────

/**
 * Fetch reward plan slabs via apiRequest.
 * Token is injected automatically by the apiRequest interceptor.
 */
function usePlanSlabs(type, token) {
  const [slabs, setSlabs] = useState([]);
  useEffect(() => {
    if (!token) return;
    apiRequest
      .get(`${BACKEND_URL}/api/rewards/${type}`)
      .then(res => {
        if (res.data?.slabs) setSlabs(res.data.slabs);
      })
      .catch(() => {});
  }, [type, token]);
  return slabs;
}

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
  const range = next - prev;
  const pct   = range > 0 ? Math.min(100, Math.round(((current - prev) / range) * 100)) : 100;
  const remaining = next - current;
  return (
    <div style={S.progressWrap}>
      <div style={S.progressRow}>
        <span style={S.progressText}>{label}</span>
        <span style={S.progressPct}>{pct}%</span>
      </div>
      <div style={S.progressTrack}>
        <div style={S.progressBar(pct, color)} />
      </div>
      <span style={S.progressHint}>
        {remaining} more {remaining === 1 ? 'unit' : 'units'} to next milestone
      </span>
    </div>
  );
}

function MilestoneChip({ label, sublabel, state, badge }) {
  return (
    <div style={S.milestoneChip(state)}>
      <span style={S.chipMain}>{label}</span>
      {sublabel && <span style={S.chipSub}>{sublabel}</span>}
      {badge && <span style={S.chipBadge}>{badge}</span>}
    </div>
  );
}

function maskPhone(phone) {
  if (!phone) return '—';
  const p = String(phone).replace(/\D/g, '');
  if (p.length < 6) return '×'.repeat(p.length);
  return p.slice(0, 5) + ' ' + '×'.repeat(p.length - 5);
}

function fmtDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  } catch {
    return '—';
  }
}

const NUDGE_MSG =
  'Hi! Just a reminder — your SoShoLife membership is not yet active. ' +
  'Activate your subscription to unlock referral rewards for both of us. ' +
  'Need help? Just reply here!';

// ─── DownlineTracker ───────────────────────────────────────────────────────────

function DownlineTracker({ referredUsers, loading }) {
  const [filterTab, setFilterTab]     = useState('all');
  const [search, setSearch]           = useState('');
  const [revealedPhones, setRevealed] = useState(new Set());

  const totalCount    = referredUsers.length;
  const activeCount   = referredUsers.filter(u => u.subscription?.active).length;
  const inactiveCount = totalCount - activeCount;

  const visible = useMemo(() => {
    let list = referredUsers;
    if (filterTab === 'active')   list = list.filter(u => u.subscription?.active);
    if (filterTab === 'inactive') list = list.filter(u => !u.subscription?.active);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(u => {
        const nameHit  = (u.name  || '').toLowerCase().includes(q);
        const phoneHit = (u.phone || '').includes(q);
        const emailHit = (u.email || '').toLowerCase().includes(q);
        return nameHit || phoneHit || emailHit;
      });
    }
    return list;
  }, [referredUsers, filterTab, search]);

  const toggleReveal = useCallback((id) => {
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyPhone = useCallback(async (phone, name) => {
    if (!phone) return;
    const ok = await copyToClipboard(phone);
    if (ok) toast.success(`${name}'s number copied`);
    else    toast.error('Could not copy');
  }, []);

  const copyNudge = useCallback(async () => {
    const ok = await copyToClipboard(NUDGE_MSG);
    if (ok) toast.success('Reminder message copied — paste it in your chat!');
    else    toast.error('Could not copy');
  }, []);

  const tabStyle = (id) => ({
    padding: '5px 12px', fontSize: 12, fontFamily: 'var(--font-sans)',
    border: '0.5px solid', borderRadius: 20, cursor: 'pointer',
    transition: 'all 0.12s',
    ...(filterTab === id
      ? { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', borderColor: 'var(--color-text-primary)' }
      : { background: 'none', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-tertiary)' }
    ),
  });

  if (loading) {
    return (
      <div>
        <p style={S.sectionHead}>Your Group Members</p>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            display: 'flex', gap: 12, padding: '12px 0',
            borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--color-border-tertiary)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ width: '40%', height: 12, borderRadius: 4, background: 'var(--color-border-tertiary)', marginBottom: 6 }} />
              <div style={{ width: '60%', height: 10, borderRadius: 4, background: 'var(--color-border-tertiary)' }} />
            </div>
            <div style={{ width: 56, height: 22, borderRadius: 4, background: 'var(--color-border-tertiary)' }} />
          </div>
        ))}
      </div>
    );
  }

  if (totalCount === 0) {
    return (
      <div>
        <p style={S.sectionHead}>Your Group Members</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', margin: '12px 0 20px' }}>
          No referrals yet. Share your invite link to get started!
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={S.sectionHead}>Your Group Members</p>

      {inactiveCount > 0 && (
        <div style={{
          background: 'var(--color-background-warning)',
          border: '0.5px solid var(--color-border-warning)',
          borderRadius: 8, padding: '12px 14px', marginBottom: 16,
          fontFamily: 'var(--font-sans)',
        }}>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--color-text-warning)', fontWeight: 500 }}>
            {inactiveCount} member{inactiveCount !== 1 ? 's' : ''} not yet active
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-text-warning)', lineHeight: 1.5 }}>
            Encourage them to activate their subscription to unlock rewards for both of you.
          </p>
          <button
            style={{ ...S.cancelBtn, fontSize: 12, padding: '5px 12px' }}
            onClick={copyNudge}
          >
            Copy reminder message
          </button>
        </div>
      )}

      {/* Filter tabs + search */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {['all', 'active', 'inactive'].map(tab => (
          <button key={tab} style={tabStyle(tab)} onClick={() => setFilterTab(tab)}>
            {tab === 'all' ? `All (${totalCount})` : tab === 'active' ? `Active (${activeCount})` : `Inactive (${inactiveCount})`}
          </button>
        ))}
        <input
          type="text"
          placeholder="Search name / phone / email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            marginLeft: 'auto', fontSize: 12, padding: '5px 10px',
            border: '0.5px solid var(--color-border-secondary)', borderRadius: 20,
            background: 'var(--color-background-primary)', color: 'var(--color-text-primary)',
            fontFamily: 'var(--font-sans)', outline: 'none', minWidth: 140,
          }}
        />
      </div>

      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
          No members match your filter.
        </p>
      ) : (
        <div>
          {visible.map(u => {
            const isActive = !!u.subscription?.active;
            const hasPhone = !!u.phone;
            const revealed = revealedPhones.has(u._id);
            return (
              <div
                key={u._id}
                style={{
                  display: 'flex', gap: 12, padding: '12px 0',
                  borderBottom: '0.5px solid var(--color-border-tertiary)',
                  alignItems: 'center',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: isActive
                    ? 'var(--color-background-success)'
                    : 'var(--color-background-secondary)',
                  border: '0.5px solid',
                  borderColor: isActive
                    ? 'var(--color-border-success)'
                    : 'var(--color-border-tertiary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 600, color: isActive
                    ? 'var(--color-text-success)'
                    : 'var(--color-text-tertiary)',
                  fontFamily: 'var(--font-sans)',
                }}>
                  {(u.name || '?')[0].toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', fontFamily: 'var(--font-sans)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {u.name || '—'}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: '"Courier New",monospace' }}>
                    {hasPhone
                      ? (revealed ? u.phone : maskPhone(u.phone))
                      : '—'}
                    {hasPhone && (
                      <button
                        onClick={() => toggleReveal(u._id)}
                        style={{ marginLeft: 6, fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', padding: 0 }}
                      >
                        {revealed ? 'hide' : 'show'}
                      </button>
                    )}
                  </p>
                  <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>
                    Joined {fmtDate(u.createdAt)}
                    {u.subscription?.expiresAt && isActive && (
                      <> · expires {fmtDate(u.subscription.expiresAt)}</>
                    )}
                  </p>
                </div>

                {/* Right side */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  <span style={{
                    fontSize: 11, fontWeight: 500, padding: '2px 8px', borderRadius: 20,
                    fontFamily: 'var(--font-sans)',
                    ...(isActive
                      ? { background: 'var(--color-background-success)', color: 'var(--color-text-success)', border: '0.5px solid var(--color-border-success)' }
                      : { background: 'var(--color-background-secondary)', color: 'var(--color-text-tertiary)', border: '0.5px solid var(--color-border-tertiary)' }
                    ),
                  }}>
                    {isActive ? '✓ Active' : '○ Inactive'}
                  </span>
                  {hasPhone && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        title="Copy phone number"
                        style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4,
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'none', color: 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                        onClick={() => copyPhone(u.phone, u.name || 'Member')}
                      >
                        Copy
                      </button>
                      <a
                        href={`tel:${u.phone}`}
                        title="Call"
                        style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 4,
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'none', color: 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                          textDecoration: 'none', display: 'inline-block', lineHeight: '1.4',
                        }}
                      >
                        Call
                      </a>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Hook: fetch referred users via apiRequest ────────────────────────────────

function useReferredUsers(token) {
  const [referredUsers, setReferredUsers] = useState([]);
  const [loading, setLoading]             = useState(true);
  const fetchedRef                        = useRef(false);

  const fetch_ = useCallback(() => {
    if (!token) { setLoading(false); return; }
    setLoading(true);
    apiRequest
      .get(`${BACKEND_URL}/api/auth/users/referred`)
      .then(res => {
        if (res.data?.referredUsers) setReferredUsers(res.data.referredUsers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetch_();
    }
  }, [fetch_]);

  return { referredUsers, loading, refetch: fetch_ };
}

// ─── InviteLinkPanel ──────────────────────────────────────────────────────────

function InviteLinkPanel({ inviteLink, referralId, senderName }) {
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!inviteLink) return;
    const ok = await copyToClipboard(inviteLink);
    if (ok) {
      setCopied(true);
      toast.success('Referral link copied!');
      setTimeout(() => setCopied(false), 2500);
    } else {
      toast.error('Could not copy link.');
    }
  }, [inviteLink]);

  return (
    <>
      {/* Referral ID badge */}
      {referralId && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 20, marginBottom: 12,
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-secondary)',
          fontFamily: '"Courier New",monospace', fontSize: 13,
          fontWeight: 600, color: 'var(--color-text-primary)',
          cursor: 'pointer', userSelect: 'none',
          transition: 'opacity 0.15s',
        }}
          title="Click to copy your Referral ID"
          onClick={async () => {
            const ok = await copyToClipboard(referralId);
            if (ok) toast.success('Referral ID copied!');
          }}
        >
          🪪 {referralId}
          <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)' }}>tap to copy</span>
        </div>
      )}

      {/* Full link row */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12,
      }}>
        <code style={{
          flex: 1, fontSize: 12, padding: '8px 10px',
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: '"Courier New", monospace', color: 'var(--color-text-secondary)',
        }}>
          {inviteLink || '—'}
        </code>
        <button
          style={{ ...S.cancelBtn, fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}
          onClick={handleCopy}
          disabled={!inviteLink}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>

      {/* Share button */}
      <button
        disabled={!inviteLink}
        onClick={() => setShareOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          gap: 8, width: '100%', padding: '11px 0', borderRadius: 8,
          border: '0.5px solid var(--color-text-primary)',
          background: 'var(--color-text-primary)',
          color: 'var(--color-background-primary)',
          fontSize: 14, fontWeight: 500, cursor: inviteLink ? 'pointer' : 'not-allowed',
          fontFamily: 'var(--font-sans)', transition: 'opacity 0.15s',
          opacity: inviteLink ? 1 : 0.45, marginBottom: 20,
        }}
      >
        📤 Share Invite Link
      </button>

      <ShareModal
        show={shareOpen}
        inviteLink={inviteLink}
        senderName={senderName}
        onClose={() => setShareOpen(false)}
        title="Share Your Invite Link"
      />
    </>
  );
}

// ─── Main export: ReferralTab ──────────────────────────────────────────────────

export default function ReferralTab({ eligible, user, redeemedReferral, onRewardClaimed }) {
  // ── Centralized token from AuthContext ─────────────────────────────────────
  const { token } = useAuth();

  const {
    activeReferralCount,
    referralCount,
    isLoading: dashLoading,
  } = useActivityDashboard();

  const { referredUsers, loading: usersLoading, refetch: refetchUsers } =
    useReferredUsers(token);

  const { parseClaimError } = useRewardEligibility();
  const slabs = usePlanSlabs('referral', token);

  const claimed    = (redeemedReferral ?? []).map(Number);
  const activeCount = activeReferralCount ?? 0;

  const [selected, setSelected]       = useState('');
  const [loading, setLoading]         = useState(false);
  const [modalOpen, setModalOpen]     = useState(false);
  const [trackerOpen, setTrackerOpen] = useState(false);

  const sortedSlabs = useMemo(() =>
    [...slabs].sort((a, b) => a.referralCount - b.referralCount),
    [slabs]
  );

  const bigSlabs   = sortedSlabs.filter(s => s.groceryCoupons > 0);
  const tokenSlabs = sortedSlabs.filter(s => s.groceryCoupons === 0 && s.referralToken > 0);

  const selectedNum = selected ? Number(selected) : null;
  const isClaimed   = selectedNum ? claimed.includes(selectedNum) : false;
  const hasEnough   = selectedNum ? activeCount >= selectedNum : false;

  const next = sortedSlabs.find(s => activeCount < s.referralCount)?.referralCount ?? null;
  const prev = [...sortedSlabs].reverse().find(s => activeCount > s.referralCount)?.referralCount ?? 0;

  const btnState = !eligible   ? 'locked'
    : !selectedNum             ? 'idle'
    : isClaimed                ? 'claimed'
    : !hasEnough               ? 'locked'
    : 'ready';

  // apiRequest interceptor attaches token automatically — no manual header needed
  const handleBankSubmit = async (bankDetails, successCallback) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/referral`,
        { referralCount: selectedNum, bankDetails },
      );
      toast.success(res.data?.message || `Referral reward for ${selectedNum} referrals claimed!`);
      setSelected('');
      setModalOpen(false);
      successCallback?.();
      onRewardClaimed?.();
      refetchUsers();
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Invite link ────────────────────────────────────────────────────────────
  const referralId  = user?.referralId ?? '';
  const inviteLink  = buildInviteLink(referralId);
  const senderName  = user?.name ?? '';

  const inactiveCount = referredUsers.filter(u => !u.subscription?.active).length;

  return (
    <div>
      {/* ── Count display ── */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <CountDisplay value={referralCount} suffix="total" isLoading={dashLoading} />
        </div>
        <div>
          <CountDisplay value={activeReferralCount} suffix="active" isLoading={dashLoading} />
        </div>
        {!dashLoading && referralCount !== null && inactiveCount > 0 && (
          <div>
            <CountDisplay value={inactiveCount} suffix="inactive" isLoading={false} />
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      <ProgressBar
        current={activeCount}
        next={next}
        prev={prev}
        label={next ? `${activeCount} / ${next} active referrals` : 'All milestones reached'}
        color="#7c3aed"
      />

      {/* ── Milestone chips ── */}
      {bigSlabs.length > 0 && (
        <>
          <p style={S.sectionHead}>Grocery + Shares milestones</p>
          <div style={S.milestoneGrid}>
            {bigSlabs.map(s => {
              const cl = claimed.includes(s.referralCount);
              const ac = activeCount >= s.referralCount;
              return (
                <MilestoneChip
                  key={s.referralCount}
                  label={`${s.referralCount}r`}
                  sublabel={`₹${s.groceryCoupons.toLocaleString('en-IN')}`}
                  state={cl ? 'claimed' : ac ? 'active' : 'locked'}
                  badge={cl ? 'Claimed' : null}
                />
              );
            })}
          </div>
        </>
      )}

      {tokenSlabs.length > 0 && (
        <>
          <p style={S.sectionHead}>Token milestones</p>
          <div style={S.milestoneGrid}>
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

      {/* ── Invite link panel ── */}
      <p style={S.sectionHead}>Your referral link</p>
      <InviteLinkPanel
        inviteLink={inviteLink}
        referralId={referralId}
        senderName={senderName}
      />

      {/* ── Downline Tracker toggle ── */}
      {((referralCount ?? 0) > 0 || referredUsers.length > 0) && (
        <div style={{ marginBottom: 20 }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '0.5px solid var(--color-border-secondary)',
              background: trackerOpen ? 'var(--color-background-secondary)' : 'var(--color-background-primary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              justifyContent: 'space-between',
            }}
            onClick={() => setTrackerOpen(v => !v)}
          >
            <span>
              {trackerOpen ? '▲' : '▼'}&nbsp; Active / Inactive status of your referrals
              {!usersLoading && referredUsers.length > 0 && (
                <span style={{
                  marginLeft: 8, fontSize: 11, padding: '1px 7px', borderRadius: 10,
                  background: 'var(--color-background-secondary)',
                  border: '0.5px solid var(--color-border-tertiary)',
                  color: 'var(--color-text-secondary)',
                }}>
                  {referredUsers.length}
                </span>
              )}
            </span>
            {inactiveCount > 0 && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 10, fontWeight: 500,
                background: 'var(--color-background-warning)',
                color: 'var(--color-text-warning)',
                border: '0.5px solid var(--color-border-warning)',
              }}>
                {inactiveCount} inactive
              </span>
            )}
          </button>

          {trackerOpen && (
            <div style={{
              border: '0.5px solid var(--color-border-secondary)',
              borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '0 0 4px',
            }}>
              <DownlineTracker referredUsers={referredUsers} loading={usersLoading} />
            </div>
          )}
        </div>
      )}

      {/* ── Claim row ── */}
      <div style={S.claimRow}>
        <select
          style={S.select}
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

        <button
          style={S.claimBtn(btnState)}
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
        rewardLabel={`${selectedNum} referrals`}
      />
    </div>
  );
}