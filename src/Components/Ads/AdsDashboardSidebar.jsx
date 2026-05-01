/**
 * Components/Ads/AdsDashboardSidebar.jsx — Mobile-first production upgrade
 *
 * Works in two contexts:
 *   Desktop → rendered inside the fixed left column
 *   Mobile  → rendered inside the bottom-sheet drawer (prop `mobile`)
 */

import { useCallback } from 'react';
import { useAds } from '../../Context/Ads/AdsContext';

// ─── Category icons ───────────────────────────────────────────────────────────
const CAT_ICON = {
  ecommerce: '🛒', food_beverage: '🍔', fashion: '👗', tech: '💻',
  education: '📚', health_wellness: '💊', real_estate: '🏠',
  finance: '💰', entertainment: '🎬', travel: '✈️',
  automotive: '🚗', services: '🔧', ngo: '❤️', other: '📣',
};

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_NO_PAGE   = [
  { id: 'pages',    icon: '📄', label: 'Pages'    },
  { id: 'accounts', icon: '🏢', label: 'Accounts' },
];
const NAV_WITH_PAGE = [
  { id: 'campaigns', icon: '🚀', label: 'Campaigns' },
  { id: 'adsets',    icon: '🎯', label: 'Ad Sets'   },
  { id: 'ads',       icon: '🖼️', label: 'Ads'       },
  { id: 'feed',      icon: '📰', label: 'Page Feed' },
  { id: 'accounts',  icon: '🏢', label: 'Accounts'  },
];

// ─── PageMiniCard ─────────────────────────────────────────────────────────────
const PageMiniCard = ({ page, onSwitch }) => {
  const icon     = CAT_ICON[page?.category] || '📣';
  const initials = page?.pageName
    ?.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || 'PG';

  return (
    <div style={{
      margin:       '12px 10px',
      padding:      '14px',
      borderRadius: 'var(--radius-lg, 16px)',
      background:   'color-mix(in srgb, var(--accent) 10%, transparent)',
      border:       '1px solid color-mix(in srgb, var(--accent) 25%, transparent)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent), var(--accent-alt, #06b6d4))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, color: '#fff', flexShrink: 0,
          boxShadow: '0 2px 10px color-mix(in srgb, var(--accent) 35%, transparent)',
        }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{
            fontSize: 13, fontWeight: 700,
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {page?.pageName || '—'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {icon} {page?.category || 'page'}
          </p>
        </div>
      </div>
      <button
        onClick={onSwitch}
        style={{
          width:        '100%',
          padding:      '7px 0',
          borderRadius: 'var(--radius-sm, 8px)',
          background:   'transparent',
          border:       '1px solid color-mix(in srgb, var(--accent) 40%, transparent)',
          color:        'var(--accent)',
          fontSize:     12, fontWeight: 600,
          cursor:       'pointer',
          fontFamily:   'var(--font-ui)',
          transition:   'all 0.15s ease',
          WebkitTapHighlightColor: 'transparent',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--accent) 12%, transparent)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        ⇄ Switch Page
      </button>
    </div>
  );
};

// ─── NavItem ──────────────────────────────────────────────────────────────────
const NavItem = ({ item, isActive, onClick, badge, mobile }) => (
  <button
    onClick={() => onClick(item.id)}
    style={{
      display:      'flex',
      alignItems:   'center',
      gap:          10,
      padding:      mobile ? '13px 16px' : '10px 14px',
      border:       'none',
      borderRadius: 'var(--radius-sm, 8px)',
      margin:       '2px 8px',
      width:        'calc(100% - 16px)',
      background:   isActive
        ? 'color-mix(in srgb, var(--accent) 12%, transparent)'
        : 'transparent',
      cursor:       'pointer',
      textAlign:    'left',
      transition:   'all 0.13s ease',
      position:     'relative',
      WebkitTapHighlightColor: 'transparent',
      touchAction:  'manipulation',
    }}
    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
  >
    {/* Active indicator */}
    {isActive && (
      <div style={{
        position: 'absolute', left: 0, top: '50%',
        transform: 'translateY(-50%)',
        width: 3, height: 18,
        borderRadius: '0 2px 2px 0',
        background: 'var(--accent)',
      }} />
    )}
    <span style={{ fontSize: mobile ? 18 : 15, flexShrink: 0 }}>{item.icon}</span>
    <span style={{
      fontSize:   mobile ? 14 : 13,
      fontWeight: isActive ? 700 : 500,
      color:      isActive ? 'var(--accent)' : 'var(--text-primary)',
      fontFamily: 'var(--font-ui)',
      flex: 1,
    }}>
      {item.label}
    </span>
    {badge > 0 && (
      <span style={{
        padding: '1px 7px', borderRadius: 10,
        background: 'var(--accent)', color: '#fff',
        fontSize: 10, fontWeight: 700, minWidth: 18, textAlign: 'center',
      }}>
        {badge > 99 ? '99+' : badge}
      </span>
    )}
  </button>
);

// ─── Divider ──────────────────────────────────────────────────────────────────
const Divider = ({ label }) => (
  <div style={{ padding: '12px 14px 4px' }}>
    <span style={{
      fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
      textTransform: 'uppercase', letterSpacing: '0.07em',
    }}>
      {label}
    </span>
  </div>
);

// ─── Main component ───────────────────────────────────────────────────────────
const AdsDashboardSidebar = ({ activeTab, onTabChange, onCreatePage, mobile = false }) => {
  const {
    selectedPage, selectedPageId, selectedCampaignId,
    campaigns, adSets, clearSelectedPage,
  } = useAds();

  const handleSwitch = useCallback(() => {
    clearSelectedPage();
    onTabChange('pages');
  }, [clearSelectedPage, onTabChange]);

  const navItems      = selectedPageId ? NAV_WITH_PAGE : NAV_NO_PAGE;
  const campaignBadge = selectedPageId && activeTab !== 'campaigns' ? (campaigns?.length || 0) : 0;
  const adSetBadge    = selectedCampaignId && activeTab !== 'adsets' ? (adSets?.length || 0) : 0;

  const getBadge = (id) => {
    if (id === 'campaigns') return campaignBadge;
    if (id === 'adsets')    return adSetBadge;
    return 0;
  };

  return (
    <div style={{
      display:       'flex',
      flexDirection: 'column',
      height:        mobile ? 'auto' : '100%',
      paddingTop:    mobile ? 4 : 10,
      paddingBottom: mobile ? 24 : 0,
    }}>
      {/* Brand label — desktop only */}
      {!mobile && (
        <div style={{ padding: '8px 14px 6px' }}>
          <p style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0,
          }}>
            Ads Manager
          </p>
        </div>
      )}

      {/* Mobile section title */}
      {mobile && (
        <div style={{ padding: '4px 14px 10px' }}>
          <p style={{
            fontSize: 13, fontWeight: 700, color: 'var(--text-muted)',
            margin: 0,
          }}>
            Navigation
          </p>
        </div>
      )}

      {/* Selected Page card */}
      {selectedPageId && selectedPage && (
        <PageMiniCard page={selectedPage} onSwitch={handleSwitch} />
      )}

      {selectedPageId && <Divider label="Navigate" />}

      <nav style={{ flex: mobile ? 'unset' : 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {navItems.map(item => (
          <NavItem
            key={item.id}
            item={item}
            isActive={activeTab === item.id}
            onClick={onTabChange}
            badge={getBadge(item.id)}
            mobile={mobile}
          />
        ))}
      </nav>

      {/* Footer: create page */}
      <div style={{
        padding:   '14px 10px',
        borderTop: mobile ? 'none' : '1px solid var(--border)',
        marginTop: 8,
      }}>
        <button
          onClick={onCreatePage}
          style={{
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            6,
            width:          '100%',
            padding:        '11px 12px',
            borderRadius:   'var(--radius-sm, 8px)',
            background:     'linear-gradient(135deg, var(--accent), var(--accent-alt, #06b6d4))',
            border:         'none',
            cursor:         'pointer',
            fontSize:       13,
            fontWeight:     700,
            color:          '#fff',
            fontFamily:     'var(--font-ui)',
            boxShadow:      '0 2px 12px color-mix(in srgb, var(--accent) 35%, transparent)',
            transition:     'opacity 0.15s ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <span style={{ fontSize: 16 }}>+</span>
          New Page
        </button>
      </div>
    </div>
  );
};

export default AdsDashboardSidebar;