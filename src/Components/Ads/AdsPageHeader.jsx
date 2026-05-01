/**
 * Components/Ads/AdsPageHeader.jsx — Mobile-first production upgrade
 *
 * Mobile (< 768px):
 *   - Compact single-row layout: [Hamburger] [Page identity] [CTA]
 *   - Long text truncated
 *   - Switch/New Page buttons hidden (accessible via sidebar drawer)
 *
 * Desktop (≥ 768px):
 *   - Full two-column layout with breadcrumb, tagline, both action buttons
 */
import { useState } from 'react';
import { useAds } from '../../Context/Ads/AdsContext';

const CAT_ICON = {
  ecommerce: '🛒', food_beverage: '🍔', fashion: '👗', tech: '💻',
  education: '📚', health_wellness: '💊', real_estate: '🏠',
  finance: '💰', entertainment: '🎬', travel: '✈️',
  automotive: '🚗', services: '🔧', ngo: '❤️', other: '📣',
};

// ── Status pill ───────────────────────────────────────────────────────────────
const StatusPill = ({ status }) => {
  const cfg = {
    active:    { label: 'Active',     bg: 'color-mix(in srgb, #22c55e 15%, transparent)', color: '#16a34a', dot: '#22c55e' },
    draft:     { label: 'Draft',      bg: 'var(--bg-hover)', color: 'var(--text-muted)',   dot: 'var(--text-muted)' },
    suspended: { label: 'Suspended',  bg: 'color-mix(in srgb, #ef4444 12%, transparent)', color: '#dc2626', dot: '#ef4444' },
  }[status] ?? { label: status, bg: 'var(--bg-hover)', color: 'var(--text-muted)', dot: 'var(--text-muted)' };

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 20, background: cfg.bg,
      fontSize: 10, fontWeight: 600, color: cfg.color, fontFamily: 'var(--font-ui)',
      flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
};

// ── Page avatar ───────────────────────────────────────────────────────────────
const PageAvatar = ({ page, size = 36 }) => {
  const initials = page?.pageName
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'PG';

  if (page?.logoUrl) {
    return (
      <img src={page.logoUrl} alt={page.pageName}
        style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 8,
      background: 'linear-gradient(135deg, var(--accent), var(--accent-alt, #06b6d4))',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size > 40 ? 16 : 13, fontWeight: 700, color: '#fff',
      flexShrink: 0,
      boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 28%, transparent)',
    }}>
      {initials}
    </div>
  );
};

// ── Breadcrumb ────────────────────────────────────────────────────────────────
const Breadcrumb = ({ items }) => (
  <div className="ads-header-breadcrumb" style={{
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-ui)', marginBottom: 2,
  }}>
    {items.map((item, i) => (
      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {i > 0 && <span style={{ opacity: 0.45 }}>›</span>}
        <span style={{
          color:      item.active ? 'var(--text-primary)' : 'var(--text-muted)',
          fontWeight: item.active ? 600 : 400,
          cursor:     item.onClick ? 'pointer' : 'default',
        }} onClick={item.onClick}>
          {item.label}
        </span>
      </span>
    ))}
  </div>
);

// ── Secondary button ──────────────────────────────────────────────────────────
const GhostBtn = ({ onClick, children, extraClass = '' }) => {
  const [hover, setHover] = useState(false);

  return (
    <button
      onClick={onClick}
      className={extraClass}
      style={{
        padding:      '7px 14px',
        borderRadius: 'var(--radius-sm, 8px)',
        border:       `1px solid ${hover ? 'var(--accent)' : 'var(--border)'}`,
        background:   'transparent',
        color:        hover ? 'var(--accent)' : 'var(--text-muted)',
        fontSize:     12,
        fontWeight:   500,
        cursor:       'pointer',
        fontFamily:   'var(--font-ui)',
        display:      'flex',
        alignItems:   'center',
        gap:          5,
        transition:   'all 0.14s ease',
        whiteSpace:   'nowrap',
        WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {children}
    </button>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdsPageHeader = ({ primaryCta, onCreatePage, onOpenNav }) => {

  const {
    selectedPage, selectedPageId,
    selectedCampaign, selectedAdSet,
    clearSelectedPage, clearSelectedCampaign, clearSelectedAdSet,
    allMyPages,
  } = useAds();

  const crumbs = [
    { label: 'Pages', onClick: () => { clearSelectedPage(); } },
    ...(selectedPageId && selectedPage
      ? [{ label: selectedPage.pageName, onClick: () => { clearSelectedAdSet?.(); clearSelectedCampaign?.(); }, active: !selectedCampaign }]
      : []),
    ...(selectedCampaign
      ? [{ label: selectedCampaign.campaignName, onClick: () => clearSelectedAdSet?.(), active: !selectedAdSet }]
      : []),
    ...(selectedAdSet ? [{ label: selectedAdSet.name, active: true }] : []),
  ];

  const title = selectedAdSet?.name ?? selectedCampaign?.campaignName ?? selectedPage?.pageName;

  return (
    <header className="ads-header">
      {/* Left: hamburger (mobile) + identity */}
      <div className="ads-header-left" style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>

        {/* Mobile hamburger */}
        <button className="ads-header-ham" onClick={onOpenNav} aria-label="Open menu">
          ☰
        </button>

        {selectedPageId && selectedPage ? (
          <>
            <PageAvatar page={selectedPage} size={36} />
            <div style={{ minWidth: 0 }}>
              <Breadcrumb items={crumbs} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', minWidth: 0 }}>
                <h4 style={{
                  margin: 0, fontSize: 15, fontWeight: 700,
                  color: 'var(--text-primary)', lineHeight: 1.3,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {title}
                </h4>
                <StatusPill status={selectedPage.status ?? 'active'} />
              </div>
              {selectedPage.tagline && !selectedCampaign && (
                <p className="ads-header-tagline" style={{
                  margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)',
                  fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {CAT_ICON[selectedPage.category] || '📣'} {selectedPage.tagline}
                </p>
              )}
            </div>
          </>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>📣</span>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                Ads Manager
              </h4>
            </div>
            <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
              {allMyPages?.length
                ? `${allMyPages.length} page${allMyPages.length !== 1 ? 's' : ''} — select one to begin`
                : 'Create a Business Page to start advertising'}
            </p>
          </div>
        )}
      </div>

      {/* Right: action buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {selectedPageId
          ? <GhostBtn onClick={clearSelectedPage} extraClass="ads-header-switch">⇄ Switch Page</GhostBtn>
          : <GhostBtn onClick={onCreatePage}      extraClass="ads-header-newpage">+ New Page</GhostBtn>
        }

        {/* Primary CTA */}
        <button
          onClick={primaryCta.action}
          className="ads-header-cta"
          style={{
            padding:      '8px 18px',
            borderRadius: 'var(--radius-sm, 8px)',
            background:   'linear-gradient(135deg, var(--accent), var(--accent-alt, #06b6d4))',
            border:       'none',
            color:        '#fff',
            fontSize:     13, fontWeight: 700,
            cursor:       'pointer',
            fontFamily:   'var(--font-ui)',
            boxShadow:    '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
            whiteSpace:   'nowrap',
            transition:   'opacity 0.14s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          {primaryCta.label}
        </button>
      </div>
    </header>
  );
};

export default AdsPageHeader;