/**
 * views/PageCampaignsView.jsx
 *
 * Second-level view: shows all Campaigns for the currently selected Page.
 * Clicking a campaign row drills into CampaignDetailView (ad sets).
 */

import { useState } from 'react';
import { useAds } from '../../../Context/Ads/AdsContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmt = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtINR = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:         { label: 'Active',          dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',  text: '#16a34a' },
  paused:         { label: 'Paused',          dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)', text: '#d97706' },
  pending_review: { label: 'Pending Review',  dot: '#60a5fa', bg: 'rgba(96,165,250,0.1)', text: '#2563eb' },
  completed:      { label: 'Completed',       dot: '#a1a1aa', bg: 'rgba(161,161,170,0.1)',text: '#52525b' },
  rejected:       { label: 'Rejected',        dot: '#ef4444', bg: 'rgba(239,68,68,0.1)',  text: '#dc2626' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? { label: status, dot: '#a1a1aa', bg: 'rgba(161,161,170,0.1)', text: '#52525b' };
  return (
    <span style={{
      display:      'inline-flex',
      alignItems:   'center',
      gap:          5,
      padding:      '3px 9px',
      borderRadius: 20,
      background:   cfg.bg,
      fontSize:     11,
      fontWeight:   600,
      color:        cfg.text,
      fontFamily:   'var(--font-ui)',
      whiteSpace:   'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const ObjectiveBadge = ({ objective }) => {
  const icons = { traffic: '🚦', engagement: '💬', awareness: '📣', leads: '🎯', conversions: '💰' };
  return (
    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
      {icons[objective] ?? '🎯'} {objective}
    </span>
  );
};

// Skeleton loader card
const SkeletonRow = () => (
  <div style={{
    padding: '16px 20px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    animation: 'pulse 1.5s ease-in-out infinite',
  }}>
    <div style={{ flex: 1 }}>
      <div style={{ height: 13, background: 'var(--bg-hover)', borderRadius: 4, width: '40%', marginBottom: 6 }} />
      <div style={{ height: 10, background: 'var(--bg-hover)', borderRadius: 4, width: '25%' }} />
    </div>
    <div style={{ height: 22, background: 'var(--bg-hover)', borderRadius: 12, width: 80 }} />
    <div style={{ height: 13, background: 'var(--bg-hover)', borderRadius: 4, width: 60 }} />
    <div style={{ height: 13, background: 'var(--bg-hover)', borderRadius: 4, width: 40 }} />
  </div>
);

// Summary stat card
const StatCard = ({ icon, label, value, subValue }) => (
  <div style={{
    background:   'var(--bg-card)',
    border:       '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding:      '14px 16px',
    flex:         1,
    minWidth:     0,
  }}>
    <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
      {value}
    </div>
    {subValue && (
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subValue}</div>
    )}
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
  </div>
);

// Campaign row
const CampaignRow = ({ campaign, onSelect, onDelete, isDeletingCampaign }) => {
  const [hovered, setHovered] = useState(false);

  const spent    = campaign.totalSpent        ?? 0;
  const budget   = campaign.budget            ?? 0;
  const spendPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  return (
    <div
      style={{
        padding:    '0 20px',
        borderBottom: '1px solid var(--border)',
        background: hovered ? 'var(--bg-hover)' : 'transparent',
        transition: 'background 0.13s ease',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0' }}>

        {/* Name + meta */}
        <button
          onClick={onSelect}
          style={{
            flex:      1,
            minWidth:  0,
            textAlign: 'left',
            background:'transparent',
            border:    'none',
            cursor:    'pointer',
            padding:   0,
          }}
        >
          <div style={{
            fontSize:     14,
            fontWeight:   600,
            color:        'var(--text-primary)',
            marginBottom: 3,
            overflow:     'hidden',
            textOverflow: 'ellipsis',
            whiteSpace:   'nowrap',
          }}>
            {campaign.campaignName}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <ObjectiveBadge objective={campaign.objective} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              📅 {fmt(campaign.startDate)} – {fmt(campaign.endDate)}
            </span>
          </div>
        </button>

        {/* Status */}
        <StatusBadge status={campaign.status} />

        {/* Budget + spend */}
        <div style={{ textAlign: 'right', minWidth: 90, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {fmtINR(budget)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>
            {fmtINR(spent)} spent
          </div>
          {/* Spend bar */}
          <div style={{
            marginTop:    4,
            height:       3,
            borderRadius: 2,
            background:   'var(--border)',
            overflow:     'hidden',
          }}>
            <div style={{
              height:     '100%',
              width:      `${spendPct}%`,
              background: spendPct > 80 ? '#ef4444' : 'var(--accent)',
              borderRadius: 2,
              transition:   'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Clicks / Impressions */}
        <div style={{ textAlign: 'center', minWidth: 60, flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {(campaign.clickCount ?? 0).toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>clicks</div>
        </div>

        {/* Actions */}
        <div style={{
          display:    'flex',
          gap:        6,
          opacity:    hovered ? 1 : 0,
          transition: 'opacity 0.13s ease',
          flexShrink: 0,
        }}>
          <button
            onClick={onSelect}
            style={{
              padding:      '5px 12px',
              borderRadius: 6,
              border:       'none',
              background:   'linear-gradient(135deg, var(--accent), var(--accent-hover))',
              color:        '#fff',
              fontSize:     11,
              fontWeight:   700,
              cursor:       'pointer',
              fontFamily:   'var(--font-ui)',
              whiteSpace:   'nowrap',
            }}
          >
            View →
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${campaign.campaignName}"?`)) onDelete();
            }}
            disabled={isDeletingCampaign}
            style={{
              padding:      '5px 8px',
              borderRadius: 6,
              border:       '1px solid var(--border)',
              background:   'transparent',
              color:        '#ef4444',
              fontSize:     11,
              cursor:       isDeletingCampaign ? 'not-allowed' : 'pointer',
              fontFamily:   'var(--font-ui)',
              opacity:      isDeletingCampaign ? 0.5 : 1,
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
};

// Empty state
const EmptyState = ({ selectedPage, onCreateCampaign }) => (
  <div style={{
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'center',
    padding:        '60px 24px',
    textAlign:      'center',
  }}>
    <div style={{
      width:          72,
      height:         72,
      borderRadius:   20,
      background:     'linear-gradient(135deg, var(--accent), var(--accent-hover))',
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      fontSize:       32,
      marginBottom:   20,
      boxShadow:      '0 4px 20px color-mix(in srgb, var(--accent) 30%, transparent)',
    }}>
      🚀
    </div>
    <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 700, color: 'var(--text-primary)' }}>
      No Campaigns Yet
    </h3>
    <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 300, lineHeight: 1.5 }}>
      Create your first campaign for{' '}
      <strong>{selectedPage?.pageName ?? 'this page'}</strong> to start reaching your audience.
    </p>
    <button
      onClick={onCreateCampaign}
      style={{
        padding:      '10px 24px',
        borderRadius: 10,
        border:       'none',
        background:   'linear-gradient(135deg, var(--accent), var(--accent-hover))',
        color:        '#fff',
        fontSize:     13,
        fontWeight:   700,
        cursor:       'pointer',
        fontFamily:   'var(--font-ui)',
        boxShadow:    '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
      }}
    >
      + Create Campaign
    </button>

    {/* How it works */}
    <div style={{ display: 'flex', gap: 20, marginTop: 36 }}>
      {[
        { icon: '🎯', label: 'Define Objective' },
        { icon: '💰', label: 'Set Budget' },
        { icon: '📊', label: 'Track Results' },
      ].map((s, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--bg-hover)', border: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>
            {s.icon}
          </div>
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</span>
        </div>
      ))}
    </div>
  </div>
);

// ── Main view ─────────────────────────────────────────────────────────────────

const PageCampaignsView = ({ onCreateCampaign }) => {
  const {
    selectedPage,
    campaigns,
    loadingCampaigns,
    campaignsError,
    selectCampaign,
    deleteCampaign,
    isDeletingCampaign,
  } = useAds();

  const [sortBy, setSortBy] = useState('createdAt');
  const [filterStatus, setFilterStatus] = useState('all');

  // Compute aggregate stats
  const totalBudget  = campaigns.reduce((s, c) => s + (c.budget ?? 0), 0);
  const totalSpent   = campaigns.reduce((s, c) => s + (c.totalSpent ?? 0), 0);
  const totalClicks  = campaigns.reduce((s, c) => s + (c.clickCount ?? 0), 0);
  const activeCnt    = campaigns.filter(c => c.status === 'active').length;

  // Filter + sort
  const filtered = campaigns
    .filter(c => filterStatus === 'all' || c.status === filterStatus)
    .sort((a, b) => {
      if (sortBy === 'budget')  return (b.budget ?? 0) - (a.budget ?? 0);
      if (sortBy === 'clicks')  return (b.clickCount ?? 0) - (a.clickCount ?? 0);
      if (sortBy === 'spent')   return (b.totalSpent ?? 0) - (a.totalSpent ?? 0);
      // default: newest first
      return new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0);
    });

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loadingCampaigns) {
    return (
      <div style={{ padding: 20 }}>
        {/* Stats skeleton */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{
              flex: 1, height: 76, borderRadius: 'var(--radius)',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }} />
          ))}
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
          {[1, 2, 3].map(i => <SkeletonRow key={i} />)}
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (campaignsError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', padding: '60px 24px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
        <p style={{ color: '#ef4444', marginBottom: 8, fontWeight: 600 }}>Failed to load campaigns</p>
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>{campaignsError?.message}</p>
      </div>
    );
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Aggregate Stats ── */}
      {campaigns.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <StatCard icon="🚀" label="Total Campaigns" value={campaigns.length} subValue={`${activeCnt} active`} />
          <StatCard icon="💰" label="Total Budget"    value={fmtINR(totalBudget)} />
          <StatCard icon="📊" label="Total Spent"     value={fmtINR(totalSpent)} />
          <StatCard icon="👆" label="Total Clicks"    value={totalClicks.toLocaleString()} />
        </div>
      )}

      {/* ── Table panel ── */}
      <div style={{
        background:   'var(--bg-card)',
        border:       '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow:     'hidden',
      }}>

        {/* Table header bar */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'space-between',
          padding:        '14px 20px',
          borderBottom:   '1px solid var(--border)',
          gap:            12,
          flexWrap:       'wrap',
        }}>
          <div>
            <h4 style={{ margin: '0 0 2px', fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
              Campaigns
              {filtered.length !== campaigns.length && (
                <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8 }}>
                  ({filtered.length} of {campaigns.length})
                </span>
              )}
            </h4>
            {selectedPage?.pageName && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                Page: {selectedPage.pageName}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Status filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                padding:      '6px 10px',
                borderRadius: 7,
                border:       '1px solid var(--border)',
                background:   'var(--bg-input)',
                color:        'var(--text-primary)',
                fontSize:     12,
                cursor:       'pointer',
                fontFamily:   'var(--font-ui)',
              }}
            >
              <option value="all">All Statuses</option>
              {Object.entries(STATUS_CFG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{
                padding:      '6px 10px',
                borderRadius: 7,
                border:       '1px solid var(--border)',
                background:   'var(--bg-input)',
                color:        'var(--text-primary)',
                fontSize:     12,
                cursor:       'pointer',
                fontFamily:   'var(--font-ui)',
              }}
            >
              <option value="createdAt">Newest</option>
              <option value="budget">Highest Budget</option>
              <option value="spent">Most Spent</option>
              <option value="clicks">Most Clicks</option>
            </select>

            {/* Create button */}
            <button
              onClick={onCreateCampaign}
              style={{
                padding:      '7px 16px',
                borderRadius: 7,
                border:       'none',
                background:   'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                color:        '#fff',
                fontSize:     12,
                fontWeight:   700,
                cursor:       'pointer',
                fontFamily:   'var(--font-ui)',
                boxShadow:    '0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent)',
                whiteSpace:   'nowrap',
              }}
            >
              + New Campaign
            </button>
          </div>
        </div>

        {/* Column headers */}
        {filtered.length > 0 && (
          <div style={{
            display:       'flex',
            alignItems:    'center',
            gap:           14,
            padding:       '8px 20px',
            background:    'var(--bg-hover)',
            borderBottom:  '1px solid var(--border)',
          }}>
            <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Campaign</div>
            <div style={{ width: 100, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</div>
            <div style={{ width: 90, textAlign: 'right', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Budget</div>
            <div style={{ width: 60, textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Clicks</div>
            <div style={{ width: 70, fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}></div>
          </div>
        )}

        {/* Campaign rows / empty */}
        {filtered.length === 0 ? (
          <EmptyState selectedPage={selectedPage} onCreateCampaign={onCreateCampaign} />
        ) : (
          filtered.map(campaign => (
            <CampaignRow
              key={campaign._id}
              campaign={campaign}
              onSelect={() => selectCampaign(campaign._id)}
              onDelete={() => deleteCampaign?.(campaign._id)}
              isDeletingCampaign={isDeletingCampaign}
            />
          ))
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default PageCampaignsView;