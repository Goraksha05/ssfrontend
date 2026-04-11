/**
 * ReferralTab.jsx — Drop-in replacement for the ReferralTab inside RewardsHub.jsx
 *
 * HOW TO USE:
 *   1. Copy this file to your components/Rewards/ folder.
 *   2. In RewardsHub.jsx, replace the existing `function ReferralTab(...)` block
 *      with an import:
 *        import ReferralTab from './ReferralTab';
 *   3. The props signature is identical to the original:
 *        <ReferralTab
 *          eligible={eligible}
 *          user={user}
 *          redeemedReferral={redeemed.referral}
 *          onRewardClaimed={onRewardClaimed}
 *        />
 *
 * WHAT'S NEW vs the original ReferralTab:
 *   ✅  Downline tracker panel — shows every referred member with:
 *         • Name, masked phone number (full shown on click / copy)
 *         • Active / Inactive subscription badge
 *         • Join date
 *         • "Call" shortcut (opens tel: link on mobile)
 *         • "Copy phone" button for desktop follow-up
 *   ✅  Search by name or phone
 *   ✅  Filter tab: All | Active | Inactive (with badge counts)
 *   ✅  Inline reminder nudge text that the user can copy to share
 *   ✅  Warning banner when inactive members exist, with count
 *   ✅  Loading skeleton while referredUsers fetches
 *   ✅  Empty state messages per filter
 *   ✅  referredUsers fetched from /api/auth/users/referred (already in backend)
 *      and supplemented by activeReferralCount from useActivityDashboard()
 *
 * BACKEND NOTE:
 *   GET /api/auth/users/referred  returns:
 *     { referredUsers: [{ _id, name, email, phone, subscription, date }] }
 *   This already exists in authController.getReferredUsers.
 *   Phone is returned as a plain string (10 digits).  The component masks it
 *   by default for privacy and reveals on explicit interaction.
 */

import React, {
  useState, useEffect, useMemo, useCallback, useRef,
} from 'react';
import { toast } from 'react-toastify';
import apiRequest from '../../utils/apiRequest';
import { useActivityDashboard } from '../../hooks/useActivityDashboard';
import { useRewardEligibility } from '../../hooks/useRewardEligibility';

// ─── Re-used from RewardsHub (these are defined there, so we import them) ─────
// If you keep this component inside RewardsHub.jsx as a function, just remove
// the imports below and rely on the closure. If it's a separate file, you
// need to either duplicate these tiny helpers or export them from RewardsHub.
//
// For a separate file, we inline the three helpers we need (they are tiny):

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const getToken    = () => localStorage.getItem('token');

// ─── Local style tokens (match RewardsHub design language exactly) ─────────────

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

// ─── Inline helpers (avoid depending on RewardsHub internals) ─────────────────

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

// ─── BankModal (self-contained, identical to RewardsHub version) ──────────────

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
    <div style={S.fieldWrap}>
      <label style={S.fieldLabel}>{key === 'confirm' ? label : label}</label>
      <input
        style={{ ...S.input, ...(errors[key] ? { borderColor: 'var(--color-border-danger)' } : {}) }}
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
    <div style={S.modalBackdrop} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={S.modalCard}>
        <p style={S.modalTitle}>Bank details — {rewardLabel}</p>
        {field('accountNumber', 'Account number', '1234567890')}
        {field('confirm', 'Confirm account number', '1234567890')}
        {field('ifscCode', 'IFSC code', 'SBIN0001234')}
        {field('panNumber', 'PAN number', 'ABCDE1234F')}
        <div style={S.modalFooter}>
          <button style={S.cancelBtn} onClick={onClose}>Cancel</button>
          <button style={S.submitBtn(loading)} onClick={handleSubmit} disabled={loading}>
            {loading ? 'Submitting…' : 'Submit & claim'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Phone masking helper ──────────────────────────────────────────────────────

/** "9876543210" → "98765 ×××××" */
function maskPhone(phone) {
  if (!phone) return '—';
  const p = String(phone).replace(/\D/g, '');
  if (p.length < 6) return '×'.repeat(p.length);
  return p.slice(0, 5) + ' ' + '×'.repeat(p.length - 5);
}

/** Format date as "12 Jan 2024" */
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

// ─── Nudge message the user can copy to share with inactive members ────────────

const NUDGE_MSG =
  'Hi! Just a reminder — your SoShoLife membership is not yet active. ' +
  'Activate your subscription to unlock referral rewards for both of us. ' +
  'Need help? Just reply here!';

// ─── Downline Tracker sub-component ──────────────────────────────────────────

function DownlineTracker({ referredUsers, loading }) {
  const [filterTab, setFilterTab]     = useState('all');   // 'all' | 'active' | 'inactive'
  const [search, setSearch]           = useState('');
  const [revealedPhones, setRevealed] = useState(new Set()); // Set of user _id whose phone is visible

  const totalCount    = referredUsers.length;
  const activeCount   = referredUsers.filter(u => u.subscription?.active).length;
  const inactiveCount = totalCount - activeCount;

  // Filter + search
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

  const copyPhone = useCallback((phone, name) => {
    if (!phone) return;
    navigator.clipboard.writeText(phone)
      .then(() => toast.success(`${name}'s number copied`))
      .catch(() => toast.error('Could not copy'));
  }, []);

  const copyNudge = useCallback(() => {
    navigator.clipboard.writeText(NUDGE_MSG)
      .then(() => toast.success('Reminder message copied — paste it in your chat!'))
      .catch(() => toast.error('Could not copy'));
  }, []);

  // ── filter tab style ─
  const tabStyle = (id) => ({
    padding: '5px 12px', fontSize: 12, fontFamily: 'var(--font-sans)',
    border: '0.5px solid', borderRadius: 20, cursor: 'pointer',
    transition: 'all 0.12s',
    ...(filterTab === id
      ? { background: 'var(--color-text-primary)', color: 'var(--color-background-primary)', borderColor: 'var(--color-text-primary)' }
      : { background: 'none', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-tertiary)' }
    ),
  });

  // ── skeleton rows while loading ─
  if (loading) {
    return (
      <div>
        <p style={S.sectionHead}>Your Group Member</p>
        {[1, 2, 3].map(i => (
          <div key={i} style={{
            display: 'flex', gap: 12, padding: '12px 0',
            borderBottom: '0.5px solid var(--color-border-tertiary)', alignItems: 'center',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%',
              background: 'var(--color-border-tertiary)', flexShrink: 0,
            }} />
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
        <p style={S.sectionHead}>Your Group Member</p>
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', margin: '12px 0 20px' }}>
          No referrals yet. Share your link to get started.
        </p>
      </div>
    );
  }

  return (
    <div>
      <p style={S.sectionHead}>Your Group Member</p>

      {/* ── Inactive warning + nudge copy ─────────────────────────────────── */}
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
            Reward milestones count <strong>active subscriptions only</strong>.
            Remind your contacts to activate their membership.
          </p>
          <button
            style={{
              fontSize: 12, padding: '5px 12px', borderRadius: 6,
              border: '0.5px solid var(--color-border-warning)',
              background: 'none', color: 'var(--color-text-warning)',
              cursor: 'pointer', fontFamily: 'var(--font-sans)', fontWeight: 500,
            }}
            onClick={copyNudge}
          >
            Copy reminder message →
          </button>
        </div>
      )}

      {/* ── Controls: filter tabs + search ────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
        <button style={tabStyle('all')} onClick={() => setFilterTab('all')}>
          All ({totalCount})
        </button>
        <button style={tabStyle('active')} onClick={() => setFilterTab('active')}>
          Active ({activeCount})
        </button>
        <button style={tabStyle('inactive')} onClick={() => setFilterTab('inactive')}>
          Inactive ({inactiveCount})
        </button>
        <div style={{ flex: 1, minWidth: 140 }}>
          <input
            style={{
              ...S.input, padding: '5px 10px', fontSize: 12, width: '100%', boxSizing: 'border-box',
            }}
            placeholder="Search name or phone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* ── Member rows ───────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontFamily: 'var(--font-sans)', margin: '8px 0 20px' }}>
          No members match your filter.
        </p>
      ) : (
        <div style={{
          border: '0.5px solid var(--color-border-tertiary)',
          borderRadius: 8, overflow: 'hidden',
        }}>
          {visible.map((u, idx) => {
            const isActive   = !!u.subscription?.active;
            const phoneShown = revealedPhones.has(u._id);
            const hasPhone   = !!u.phone;

            return (
              <div
                key={u._id || idx}
                style={{
                  display: 'flex', gap: 12, padding: '12px 14px',
                  alignItems: 'center', flexWrap: 'wrap',
                  borderBottom: idx < visible.length - 1
                    ? '0.5px solid var(--color-border-tertiary)'
                    : 'none',
                  background: idx % 2 === 0
                    ? 'var(--color-background-primary)'
                    : 'var(--color-background-secondary)',
                }}
              >
                {/* Avatar */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
                  background: isActive
                    ? 'var(--color-background-success)'
                    : 'var(--color-background-secondary)',
                  color: isActive
                    ? 'var(--color-text-success)'
                    : 'var(--color-text-tertiary)',
                  border: '0.5px solid',
                  borderColor: isActive
                    ? 'var(--color-border-success)'
                    : 'var(--color-border-tertiary)',
                }}>
                  {(u.name || '?')[0].toUpperCase()}
                </div>

                {/* Name + phone + join date */}
                <div style={{ flex: 1, minWidth: 0, fontFamily: 'var(--font-sans)' }}>
                  <div style={{
                    fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {u.name || 'Unknown'}
                  </div>

                  {/* Phone row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{
                      fontSize: 12, color: 'var(--color-text-secondary)',
                      fontFamily: '"Courier New", monospace', letterSpacing: 0.5,
                    }}>
                      {hasPhone
                        ? (phoneShown ? u.phone : maskPhone(u.phone))
                        : 'No phone on file'}
                    </span>

                    {/* Reveal / hide toggle */}
                    {hasPhone && (
                      <button
                        title={phoneShown ? 'Hide' : 'Show full number'}
                        style={{
                          fontSize: 10, padding: '1px 6px', borderRadius: 3,
                          border: '0.5px solid var(--color-border-secondary)',
                          background: 'none', color: 'var(--color-text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)',
                        }}
                        onClick={() => toggleReveal(u._id)}
                      >
                        {phoneShown ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>

                  {/* Join date */}
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 1 }}>
                    Joined {fmtDate(u.date)}
                  </div>
                </div>

                {/* Right side: status badge + action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
                  {/* Active / Inactive badge */}
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

                  {/* Action buttons */}
                  {hasPhone && (
                    <div style={{ display: 'flex', gap: 4 }}>
                      {/* Copy phone */}
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

                      {/* Call shortcut (opens dialler on mobile) */}
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

// ─── Hook: fetch referred users ───────────────────────────────────────────────

function useReferredUsers() {
  const [referredUsers, setReferredUsers] = useState([]);
  const [loading, setLoading]             = useState(true);
  const fetchedRef                        = useRef(false);

  const fetch_ = useCallback(() => {
    const token = getToken();
    if (!token) { setLoading(false); return; }
    setLoading(true);
    fetch(`${BACKEND_URL}/api/auth/users/referred`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.referredUsers) setReferredUsers(d.referredUsers);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!fetchedRef.current) {
      fetchedRef.current = true;
      fetch_();
    }
  }, [fetch_]);

  return { referredUsers, loading, refetch: fetch_ };
}

// ─── Main export: ReferralTab ─────────────────────────────────────────────────

export default function ReferralTab({ eligible, user, redeemedReferral, onRewardClaimed }) {
  // Dashboard counts (React Query — already cached by RewardsHub)
  const {
    activeReferralCount,
    referralCount,
    isLoading: dashLoading,
  } = useActivityDashboard();

  // Full referred-users list (fetched here, not in dashboard hook, because
  // the dashboard endpoint doesn't return the full user objects with phone)
  const { referredUsers, loading: usersLoading, refetch: refetchUsers } =
    useReferredUsers();

  const { parseClaimError } = useRewardEligibility();
  const slabs = usePlanSlabs('referral');

  const claimed    = (redeemedReferral ?? []).map(Number);
  const activeCount = activeReferralCount ?? 0;

  const [selected, setSelected]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
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
  const prev = [...sortedSlabs].reverse().find(s => activeCount >= s.referralCount)?.referralCount ?? 0;

  const btnState = !eligible   ? 'locked'
    : !selectedNum             ? 'idle'
    : isClaimed                ? 'claimed'
    : !hasEnough               ? 'locked'
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
      setSelected('');
      setModalOpen(false);
      onRewardClaimed?.();
      refetchUsers(); // refresh phone list after claim (subscription status may change)
    } catch (err) {
      toast.error(parseClaimError(err));
    } finally {
      setLoading(false);
    }
  };

  // Referral link
  const referralId  = user?.referralId ?? '';
  const frontendUrl = process.env.REACT_APP_FRONTEND_URL || window.location.origin;
  const inviteLink  = referralId ? `${frontendUrl}?ref=${referralId}` : '—';

  const copyLink = () => {
    if (!referralId) return;
    navigator.clipboard.writeText(inviteLink)
      .then(() => toast.success('Referral link copied!'))
      .catch(() => toast.error('Could not copy link.'));
  };

  // Inactive count for the tracker toggle badge
  const inactiveCount = referredUsers.filter(u => !u.subscription?.active).length;

  return (
    <div>
      {/* ── Count display ──────────────────────────────────────────────────── */}
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

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      <ProgressBar
        current={activeCount}
        next={next}
        prev={prev}
        label={next ? `${activeCount} / ${next} active referrals` : 'All milestones reached'}
        color="#7c3aed"
      />

      {/* ── Big milestone chips ─────────────────────────────────────────────── */}
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

      {/* ── Token milestone chips ───────────────────────────────────────────── */}
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

      {/* ── Referral link ───────────────────────────────────────────────────── */}
      <p style={S.sectionHead}>Your referral link</p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <code style={{
          flex: 1, fontSize: 12, padding: '8px 10px',
          background: 'var(--color-background-secondary)',
          border: '0.5px solid var(--color-border-tertiary)', borderRadius: 6,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: '"Courier New", monospace', color: 'var(--color-text-secondary)',
        }}>
          {inviteLink}
        </code>
        <button style={{ ...S.cancelBtn, fontSize: 12, padding: '6px 12px' }} onClick={copyLink}>
          Copy
        </button>
      </div>

      {/* ── Downline Tracker toggle ─────────────────────────────────────────── */}
      {(referralCount ?? 0) > 0 || referredUsers.length > 0 ? (
        <div style={{ marginBottom: 20 }}>
          <button
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 14px', borderRadius: 8,
              border: '0.5px solid var(--color-border-secondary)',
              background: trackerOpen
                ? 'var(--color-background-secondary)'
                : 'var(--color-background-primary)',
              color: 'var(--color-text-primary)', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500,
              justifyContent: 'space-between',
            }}
            onClick={() => setTrackerOpen(v => !v)}
          >
            <span>
              {trackerOpen ? '▲' : '▼'}&nbsp; Downline tracker
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
              borderTop: 'none', borderRadius: '0 0 8px 8px',
              padding: '0 0 4px',
            }}>
              <DownlineTracker referredUsers={referredUsers} loading={usersLoading} />
            </div>
          )}
        </div>
      ) : null}

      {/* ── Claim row ───────────────────────────────────────────────────────── */}
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