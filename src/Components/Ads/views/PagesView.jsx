/**
 * views/PagesView.jsx
 *
 * Top-level view when no page is selected.
 * Shows all Business Pages across all Ad Accounts in a card grid.
 * Clicking a card calls selectPage(id, accountId).
 */

import { useState } from 'react';
import { useAds } from '../../../Context/Ads/AdsContext';

// ── Category icons & labels ───────────────────────────────────────────────────
const CAT = {
  ecommerce:       { icon: '🛒', label: 'E-Commerce'       },
  food_beverage:   { icon: '🍔', label: 'Food & Beverage'  },
  fashion:         { icon: '👗', label: 'Fashion'           },
  tech:            { icon: '💻', label: 'Technology'        },
  education:       { icon: '📚', label: 'Education'         },
  health_wellness: { icon: '💊', label: 'Health & Wellness' },
  real_estate:     { icon: '🏠', label: 'Real Estate'       },
  finance:         { icon: '💰', label: 'Finance'           },
  entertainment:   { icon: '🎬', label: 'Entertainment'     },
  travel:          { icon: '✈️', label: 'Travel'            },
  automotive:      { icon: '🚗', label: 'Automotive'        },
  services:        { icon: '🔧', label: 'Services'          },
  ngo:             { icon: '❤️', label: 'NGO'               },
  other:           { icon: '📣', label: 'Other'             },
};

// ── Status badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = {
    active:    { label: 'Active',     cls: 'bg-green-100 text-green-700 border-green-200' },
    draft:     { label: 'Draft',      cls: 'bg-gray-100 text-gray-500 border-gray-200'   },
    suspended: { label: 'Suspended',  cls: 'bg-red-100 text-red-600 border-red-200'      },
  }[status] ?? { label: status, cls: 'bg-gray-100 text-gray-500 border-gray-200' };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
};

// ── Page avatar ───────────────────────────────────────────────────────────────
const PageAvatar = ({ page, size = 48 }) => {
  // const { icon } = CAT[page.category] || { icon: '📣' };
  const initials  = page.pageName
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'PG';

  if (page.logoUrl) {
    return (
      <img src={page.logoUrl} alt={page.pageName}
        style={{ width: size, height: size, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size,
      borderRadius: 10,
      background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 40 ? 18 : 13,
      fontWeight: 700, color: '#fff', flexShrink: 0,
      boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 25%, transparent)',
    }}>
      {initials}
    </div>
  );
};

// ── Skeleton card ─────────────────────────────────────────────────────────────
const SkeletonCard = () => (
  <div className="bg-card border rounded-xl p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--bg-hover)' }} />
      <div className="flex-1">
        <div style={{ height: 14, background: 'var(--bg-hover)', borderRadius: 4, width: '65%', marginBottom: 6 }} />
        <div style={{ height: 11, background: 'var(--bg-hover)', borderRadius: 4, width: '45%' }} />
      </div>
    </div>
    <div style={{ height: 11, background: 'var(--bg-hover)', borderRadius: 4, width: '80%', marginBottom: 4 }} />
    <div style={{ height: 11, background: 'var(--bg-hover)', borderRadius: 4, width: '55%' }} />
  </div>
);

// ── Empty state ───────────────────────────────────────────────────────────────
const EmptyState = ({ onCreatePage, hasAccounts }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center px-6">
    <div style={{ position: 'relative', width: 80, height: 80, marginBottom: 20 }}>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
        opacity: 0.12, transform: 'rotate(6deg)',
      }} />
      <div style={{
        position: 'absolute', inset: 0, borderRadius: 18,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
        opacity: 0.08, transform: 'rotate(-3deg)',
      }} />
      <div style={{
        position: 'relative', width: '100%', height: '100%', borderRadius: 18,
        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, boxShadow: '0 4px 20px color-mix(in srgb, var(--accent) 30%, transparent)',
      }}>
        📄
      </div>
    </div>

    <h3 className="mb-2">No Business Pages Yet</h3>
    <p className="text-sm text-muted mb-6 max-w-xs leading-relaxed">
      {hasAccounts
        ? 'Create a Business Page to represent your brand in ads. Pages are the face of your campaigns.'
        : 'First create an Ad Account, then add Business Pages to start advertising.'}
    </p>

    <button
      onClick={onCreatePage}
      className="px-6 py-3 bg-gradient text-white rounded-xl shadow-md hover-lift font-medium"
    >
      + Create Business Page
    </button>

    {/* How it works */}
    <div className="mt-10 grid grid-cols-3 gap-5 max-w-sm">
      {[
        { icon: '🏢', title: 'Create Account', desc: 'Set up your Ad Account first' },
        { icon: '📄', title: 'Add a Page',     desc: 'Define your brand identity'   },
        { icon: '🚀', title: 'Run Campaigns',  desc: 'Reach thousands of users'     },
      ].map((s, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'var(--bg-hover)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            fontSize: 18, border: '1px solid var(--border)',
          }}>
            {s.icon}
          </div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{s.title}</p>
          <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, margin: 0 }}>{s.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

// ── Page card ─────────────────────────────────────────────────────────────────
const PageCard = ({ page, accountName, onSelect, onDelete, isDeletingPage }) => {
  const [hovered, setHovered] = useState(false);
  const { icon, label } = CAT[page.category] || { icon: '📣', label: 'Other' };

  return (
    <div
      style={{
        background:   'var(--bg-card)',
        border:       `1px solid ${hovered ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 'var(--radius)',
        padding:      '20px',
        display:      'flex',
        flexDirection:'column',
        gap:          14,
        transition:   'all 0.18s ease',
        transform:    hovered ? 'translateY(-2px)' : 'none',
        boxShadow:    hovered
          ? '0 8px 24px color-mix(in srgb, var(--accent) 12%, rgba(0,0,0,0.08))'
          : 'var(--shadow-card)',
        cursor:       'pointer',
        position:     'relative',
        overflow:     'hidden',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Accent strip on hover */}
      <div style={{
        position:   'absolute',
        top:        0, left: 0, right: 0,
        height:     3,
        background: 'linear-gradient(90deg, var(--accent), var(--accent-hover))',
        opacity:    hovered ? 1 : 0,
        transition: 'opacity 0.18s ease',
      }} />

      {/* Top row: avatar + status */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PageAvatar page={page} size={48} />
          <div style={{ minWidth: 0 }}>
            <p style={{
              margin: 0, fontWeight: 700, fontSize: 14,
              color: 'var(--text-primary)', lineHeight: 1.3,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {page.pageName}
            </p>
            <p style={{ margin: '3px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {icon} {label}
            </p>
          </div>
        </div>
        <StatusBadge status={page.status} />
      </div>

      {/* Tagline */}
      {page.tagline && (
        <p style={{
          margin: 0, fontSize: 12, color: 'var(--text-muted)',
          fontStyle: 'italic', lineHeight: 1.45,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          "{page.tagline}"
        </p>
      )}

      {/* Account label */}
      <div style={{
        fontSize: 10, color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span>🏢</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {accountName}
        </span>
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button
          onClick={() => onSelect()}
          style={{
            flex:         1,
            padding:      '8px 0',
            borderRadius: 'var(--radius-sm)',
            background:   'linear-gradient(135deg, var(--accent), var(--accent-hover))',
            border:       'none',
            color:        '#fff',
            fontSize:     12,
            fontWeight:   700,
            cursor:       'pointer',
            fontFamily:   'var(--font-ui)',
            transition:   'opacity 0.14s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          Manage →
        </button>
        <button
          onClick={e => {
            e.stopPropagation();
            if (window.confirm(`Delete "${page.pageName}"? This cannot be undone.`)) onDelete();
          }}
          disabled={isDeletingPage}
          style={{
            padding:      '8px 12px',
            borderRadius: 'var(--radius-sm)',
            border:       '1px solid var(--border)',
            background:   'transparent',
            color:        'var(--color-danger, #ef4444)',
            fontSize:     12,
            cursor:       isDeletingPage ? 'not-allowed' : 'pointer',
            fontFamily:   'var(--font-ui)',
            opacity:      isDeletingPage ? 0.5 : 1,
            transition:   'all 0.14s ease',
          }}
          onMouseEnter={e => {
            if (!isDeletingPage) e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 10%, transparent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
};

// ── Main view ─────────────────────────────────────────────────────────────────
const PagesView = ({ onCreatePage }) => {
  const {
    allMyPages,
    accounts,
    loadingAllMyPages,
    selectPage,
    deletePage,
    isDeletingPage,
    // selectedAccountId,
  } = useAds();

  // Build accountId → accountName map for display
  const accountMap = Object.fromEntries((accounts || []).map(a => [a._id, a.accountName]));

  if (loadingAllMyPages) {
    return (
      <div className="p-5">
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}>
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </div>
    );
  }

  if (!allMyPages?.length) {
    return (
      <EmptyState
        onCreatePage={onCreatePage}
        hasAccounts={!!accounts?.length}
      />
    );
  }

  return (
    <div className="p-5">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h3 style={{ margin: '0 0 4px' }}>Business Pages</h3>
          <p className="text-sm text-muted">
            {allMyPages.length} page{allMyPages.length !== 1 ? 's' : ''} across{' '}
            {accounts?.length ?? 0} account{accounts?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreatePage}
          className="px-4 py-2 bg-gradient text-white rounded-pill shadow-md hover-lift text-sm"
          style={{ whiteSpace: 'nowrap' }}
        >
          + New Page
        </button>
      </div>

      {/* Page grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
        gap: 16,
      }}>
        {allMyPages.map(page => (
          <PageCard
            key={page._id}
            page={page}
            accountName={accountMap[page.adAccount] || 'My Account'}
            onSelect={() => selectPage(page._id, page.adAccount)}
            onDelete={() => deletePage({ accountId: page.adAccount, pageId: page._id })}
            isDeletingPage={isDeletingPage}
          />
        ))}
      </div>
    </div>
  );
};

export default PagesView;