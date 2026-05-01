/**
 * views/CampaignDetailView.jsx
 *
 * Third-level view: shows all Ad Sets for the currently selected Campaign.
 * Displays campaign analytics summary, ad set cards, and hierarchy tree.
 * Clicking an ad set drills into AdSetDetailView.
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
  } catch { return iso; }
};

const fmtINR = (n) =>
  n == null ? '—' : `₹${Number(n).toLocaleString('en-IN')}`;

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active:   { label: 'Active',   dot: '#22c55e', bg: 'rgba(34,197,94,0.1)',   text: '#16a34a' },
  paused:   { label: 'Paused',   dot: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  text: '#d97706' },
  rejected: { label: 'Rejected', dot: '#ef4444', bg: 'rgba(239,68,68,0.1)',   text: '#dc2626' },
  draft:    { label: 'Draft',    dot: '#a1a1aa', bg: 'rgba(161,161,170,0.1)', text: '#52525b' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] ?? { label: status, dot: '#a1a1aa', bg: 'rgba(161,161,170,0.1)', text: '#52525b' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 9px', borderRadius: 20, background: cfg.bg,
      fontSize: 11, fontWeight: 600, color: cfg.text, fontFamily: 'var(--font-ui)',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ icon, label, value, sub }) => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '14px 16px', flex: 1, minWidth: 0,
  }}>
    <div style={{ fontSize: 18, marginBottom: 6 }}>{icon}</div>
    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 500 }}>{label}</div>
  </div>
);

// ── Skeleton ──────────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div style={{
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '18px 20px',
    animation: 'adset-pulse 1.5s ease-in-out infinite',
  }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ height: 14, background: 'var(--bg-hover)', borderRadius: 4, width: '40%' }} />
      <div style={{ height: 22, background: 'var(--bg-hover)', borderRadius: 12, width: 80 }} />
    </div>
    <div style={{ height: 10, background: 'var(--bg-hover)', borderRadius: 4, width: '60%', marginBottom: 16 }} />
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3].map(i => (
        <div key={i} style={{ flex: 1, height: 50, background: 'var(--bg-hover)', borderRadius: 8 }} />
      ))}
    </div>
  </div>
);

// ── AdSet card ────────────────────────────────────────────────────────────────

const AdSetCard = ({ adSet, onSelect, onDelete, isDeletingAdSet }) => {
  const [hovered, setHovered] = useState(false);

  const adCount     = adSet.adCount ?? adSet.ads?.length ?? 0;
  const impressions = adSet.impressions ?? 0;
  const clicks      = adSet.clicks ?? 0;
  const ctr         = impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : '—';

  return (
    <div
      style={{
        background:    'var(--bg-card)',
        border:        `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius:  'var(--radius)',
        padding:       '18px 20px',
        transition:    'all 0.16s ease',
        transform:     hovered ? 'translateY(-1px)' : 'none',
        boxShadow:     hovered
          ? '0 6px 20px color-mix(in srgb, var(--accent) 10%, rgba(0,0,0,0.06))'
          : 'var(--shadow-card)',
        position:      'relative',
        overflow:      'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
        opacity: hovered ? 1 : 0, transition: 'opacity 0.16s ease',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            margin: 0, fontWeight: 700, fontSize: 14, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {adSet.name}
          </p>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            📅 {fmt(adSet.startDate)} – {fmt(adSet.endDate)}
          </p>
        </div>
        <StatusBadge status={adSet.status ?? 'active'} />
      </div>

      {/* Placements */}
      {adSet.placements?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 12, flexWrap: 'wrap' }}>
          {adSet.placements.map(p => (
            <span key={p} style={{
              padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 600,
              background: 'var(--bg-hover)', color: 'var(--text-muted)',
              border: '1px solid var(--border)', textTransform: 'capitalize',
            }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Ads',          value: adCount },
          { label: 'Impressions',  value: impressions.toLocaleString() },
          { label: 'CTR',          value: ctr === '—' ? '—' : `${ctr}%` },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 10px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {stat.value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* Daily budget cap */}
      {adSet.dailyBudgetCap != null && (
        <p style={{ margin: '0 0 12px', fontSize: 11, color: 'var(--text-muted)' }}>
          Daily cap: {fmtINR(adSet.dailyBudgetCap)}
        </p>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          onClick={onSelect}
          style={{
            flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', fontFamily: 'var(--font-ui)', transition: 'opacity 0.14s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          View Ads →
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            if (window.confirm(`Delete "${adSet.name}"?`)) onDelete();
          }}
          disabled={isDeletingAdSet}
          style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border)', background: 'transparent',
            color: '#ef4444', fontSize: 12, cursor: isDeletingAdSet ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-ui)', opacity: isDeletingAdSet ? 0.5 : 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyAdSets = ({ campaignName, onCreateAdSet }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '50px 24px', textAlign: 'center',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
  }}>
    <div style={{
      width: 64, height: 64, borderRadius: 18,
      background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 28, marginBottom: 16,
      boxShadow: '0 4px 20px color-mix(in srgb, var(--accent) 30%, transparent)',
    }}>
      🎯
    </div>
    <h3 style={{ margin: '0 0 8px' }}>No Ad Sets Yet</h3>
    <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)', maxWidth: 280, lineHeight: 1.5 }}>
      Create an Ad Set under <strong>{campaignName}</strong> to define targeting, placements, and schedule.
    </p>
    <button
      onClick={onCreateAdSet}
      style={{
        padding: '10px 24px', borderRadius: 10, border: 'none',
        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
        fontFamily: 'var(--font-ui)', boxShadow: '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
      }}
    >
      + Create Ad Set
    </button>
  </div>
);

// ── Campaign info bar ─────────────────────────────────────────────────────────

const CampaignInfoBar = ({ campaign }) => {
  const spent    = campaign.totalSpent ?? 0;
  const budget   = campaign.budget ?? 0;
  const spendPct = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', padding: '16px 20px', marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700, marginBottom: 4 }}>
            Campaign
          </p>
          <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {campaign.campaignName}
          </h4>
        </div>
        <StatusBadge status={campaign.status} />
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 12 }}>
        <Info label="Objective"  value={`🎯 ${campaign.objective ?? '—'}`} />
        <Info label="Start"      value={fmt(campaign.startDate)} />
        <Info label="End"        value={fmt(campaign.endDate)} />
        <Info label="Budget"     value={fmtINR(budget)} />
        <Info label="Spent"      value={fmtINR(spent)} />
        <Info label="Clicks"     value={(campaign.clickCount ?? 0).toLocaleString()} />
      </div>

      {/* Spend progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Budget Used</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{spendPct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${spendPct}%`,
            background: spendPct > 85 ? '#ef4444' : 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
            borderRadius: 3, transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    </div>
  );
};

const Info = ({ label, value }) => (
  <div>
    <p style={{ margin: 0, fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
      {label}
    </p>
    <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{value}</p>
  </div>
);

// ── Main view ─────────────────────────────────────────────────────────────────

const CampaignDetailView = ({ onCreateAdSet }) => {
  const {
    selectedCampaign,
    adSets,
    loadingAdSets,
    adSetsError,
    selectAdSet,
    deleteAdSet,
    isDeletingAdSet,
    // analytics,
  } = useAds();

  if (!selectedCampaign) return null;

  if (loadingAdSets) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ height: 130, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: 16, animation: 'adset-pulse 1.5s ease-in-out infinite' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (adSetsError) {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p style={{ color: '#ef4444' }}>Failed to load ad sets. {adSetsError?.message}</p>
      </div>
    );
  }

  // Total impressions / clicks from analytics or adSets
  const totalImpressions = adSets.reduce((s, a) => s + (a.impressions ?? 0), 0);
  const totalClicks      = adSets.reduce((s, a) => s + (a.clicks ?? 0), 0);
  const totalAds         = adSets.reduce((s, a) => s + (a.adCount ?? a.ads?.length ?? 0), 0);

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Campaign info bar */}
      <CampaignInfoBar campaign={selectedCampaign} />

      {/* Aggregate stats */}
      {adSets.length > 0 && (
        <div style={{ display: 'flex', gap: 12 }}>
          <StatCard icon="🎯" label="Ad Sets"      value={adSets.length}                    sub={`${totalAds} ads`} />
          <StatCard icon="👁️" label="Impressions"  value={totalImpressions.toLocaleString()} />
          <StatCard icon="👆" label="Total Clicks"  value={totalClicks.toLocaleString()}     />
          <StatCard icon="📈" label="Avg CTR"
            value={totalImpressions > 0 ? `${((totalClicks / totalImpressions) * 100).toFixed(1)}%` : '—'}
          />
        </div>
      )}

      {/* Header + create button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: '0 0 2px' }}>Ad Sets</h4>
          {adSets.length > 0 && (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
              {adSets.length} ad set{adSets.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button
          onClick={onCreateAdSet}
          style={{
            padding: '8px 18px', borderRadius: 'var(--radius-sm)', border: 'none',
            background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-ui)', boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 30%, transparent)',
          }}
        >
          + New Ad Set
        </button>
      </div>

      {/* Ad set grid / empty */}
      {adSets.length === 0 ? (
        <EmptyAdSets campaignName={selectedCampaign.campaignName} onCreateAdSet={onCreateAdSet} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {adSets.map(adSet => (
            <AdSetCard
              key={adSet._id}
              adSet={adSet}
              onSelect={() => selectAdSet(adSet._id)}
              onDelete={() => deleteAdSet(adSet._id)}
              isDeletingAdSet={isDeletingAdSet}
            />
          ))}
        </div>
      )}

      <style>{`
        @keyframes adset-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default CampaignDetailView;