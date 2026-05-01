/**
 * Pages/Ads/AdsDashboard.jsx  — Production-grade, mobile-first
 *
 * Mobile UX:
 *   < 768px  →  bottom sheet sidebar (drawer), full-screen content
 *   ≥ 768px  →  fixed left sidebar + scrollable right panel (desktop)
 *
 * Navigation levels:
 *   0. Pages list  (default when no page selected)
 *   1. Page context  →  campaigns for that page
 *   2. Campaign detail  →  ad sets
 *   3. Ad Set detail  →  ads/creatives
 *   4. Page Feed  →  posts "as Page" (parallel tab)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAds } from '../../Context/Ads/AdsContext';

// Views
import PagesView          from './views/PagesView';
import PageCampaignsView  from './views/PageCampaignsView';
import CampaignDetailView from './views/CampaignDetailView';
import AdSetDetailView    from './views/AdSetDetailView';
import PageFeedView       from './views/PageFeedView';
import AccountsView       from './views/AccountsView';

// Modals
import CreatePageModal     from './modals/CreatePageModal';
import CreateCampaignModal from './modals/CreateCampaignModal';
import CreateAdSetModal    from './modals/CreateAdSetModal';
import CreateAdModal       from './modals/CreateAdModal';
import CreateAccountModal  from './modals/CreateAccountModal';

// Sub-components
import AdsDashboardSidebar from './AdsDashboardSidebar';
import AdsPageHeader       from './AdsPageHeader';

// ─── CSS injected once ────────────────────────────────────────────────────────
const INJECTED_CSS = `
@keyframes ads-spin    { to { transform: rotate(360deg) } }
@keyframes ads-fade-in { from { opacity:0;transform:translateY(8px) } to { opacity:1;transform:translateY(0) } }
@keyframes ads-drawer-in   { from { transform:translateY(100%) } to { transform:translateY(0) } }
@keyframes ads-drawer-out  { from { transform:translateY(0) }    to { transform:translateY(100%) } }
@keyframes ads-overlay-in  { from { opacity:0 } to { opacity:1 } }

/* ── Shell ── */
.ads-shell {
  display: flex;
  flex-direction: row;
  height: calc(100dvh - 60px);
  overflow: hidden;
  background: var(--bg-page);
  position: relative;
}

/* ── Desktop sidebar ── */
.ads-sidebar-desktop {
  width: 220px;
  min-width: 220px;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--bg-sidebar, var(--bg-card));
  border-right: 1px solid var(--border);
  overflow-y: auto;
  flex-shrink: 0;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

/* ── Mobile: hide desktop sidebar ── */
@media (max-width: 767px) {
  .ads-sidebar-desktop { display: none; }
}

/* ── Mobile drawer overlay ── */
.ads-drawer-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(0,0,0,0.65);
  backdrop-filter: blur(2px);
  animation: ads-overlay-in 0.2s ease;
  display: none;
}
.ads-drawer-overlay.open { display: block; }

/* ── Mobile bottom-sheet drawer ── */
.ads-drawer-sheet {
  position: fixed;
  bottom: 0; left: 0; right: 0;
  z-index: 201;
  background: var(--bg-sidebar, var(--bg-card));
  border-radius: 20px 20px 0 0;
  border-top: 1px solid var(--border);
  max-height: 85dvh;
  overflow-y: auto;
  box-shadow: 0 -16px 48px rgba(0,0,0,0.6);
  animation: ads-drawer-in 0.28s cubic-bezier(0.34,1.56,0.64,1);
  scrollbar-width: thin;
}

.ads-drawer-handle {
  width: 36px; height: 4px;
  border-radius: 99px;
  background: var(--text-muted);
  opacity: 0.4;
  margin: 10px auto 6px;
  flex-shrink: 0;
}

/* ── Main panel ── */
.ads-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

/* ── Content scroll area ── */
.ads-content {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  background: var(--bg-page);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: var(--scrollbar-thumb) transparent;
}

/* ── Mobile FAB (open drawer) ── */
.ads-fab {
  display: none;
  position: fixed;
  bottom: 80px; /* above mobile nav bar */
  right: 18px;
  z-index: 100;
  width: 52px; height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-alt, #06b6d4));
  border: none;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--accent) 50%, transparent);
  color: #fff;
  font-size: 22px;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  -webkit-tap-highlight-color: transparent;
}
@media (max-width: 767px) {
  .ads-fab { display: flex; }
}
.ads-fab:active { transform: scale(0.92); }

/* ── Loading ── */
.ads-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 14px;
}
.ads-loader-spinner {
  width: 36px; height: 36px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: ads-spin 0.8s linear infinite;
}

/* ── Fade-in wrapper ── */
.ads-content-inner {
  animation: ads-fade-in 0.18s ease;
  min-height: 100%;
}

/* ── Responsive grid helpers used inside views ── */
@media (max-width: 767px) {
  .ads-grid-3 { grid-template-columns: 1fr !important; }
  .ads-grid-2 { grid-template-columns: 1fr !important; }
  .ads-hide-mobile { display: none !important; }
  .ads-full-mobile { width: 100% !important; }
}
@media (min-width: 768px) and (max-width: 1023px) {
  .ads-grid-3 { grid-template-columns: repeat(2, 1fr) !important; }
}
`;

let cssInjected = false;
function injectCSS() {
  if (cssInjected || typeof document === 'undefined') return;
  const s = document.createElement('style');
  s.textContent = INJECTED_CSS;
  document.head.appendChild(s);
  cssInjected = true;
}

// ─── Main component ───────────────────────────────────────────────────────────
const AdsDashboard = () => {
  injectCSS();

  const {
    selectedPageId,
    selectedAccountId,
    selectedCampaignId,
    selectedAdSetId,
    loadingAccounts,
    loadingAllMyPages,
  } = useAds();

  const [activeTab,    setActiveTab]    = useState('pages');
  const [modal,        setModal]        = useState(null);
  const [drawerOpen,   setDrawerOpen]   = useState(false);
  const drawerRef = useRef(null);

  const openModal  = useCallback((name) => setModal(name),  []);
  const closeModal = useCallback(()     => setModal(null),  []);

  // Close drawer on backdrop tap
  const handleOverlayClick = useCallback((e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) {
      setDrawerOpen(false);
    }
  }, []);

  // Auto-advance tab on deep-selection
  useEffect(() => {
    if      (selectedAdSetId)    setActiveTab('ads');
    else if (selectedCampaignId) setActiveTab('adsets');
    else if (selectedPageId)     setActiveTab('campaigns');
    else                         setActiveTab('pages');
  }, [selectedPageId, selectedAccountId, selectedCampaignId, selectedAdSetId]);

  // Close drawer on nav change (mobile UX)
  useEffect(() => { setDrawerOpen(false); }, [activeTab]);

  const renderContent = () => {
    if (selectedAdSetId)    return <AdSetDetailView    onCreateAd={()       => openModal('ad')}       />;
    if (selectedCampaignId) return <CampaignDetailView onCreateAdSet={()   => openModal('adset')}    />;
    if (selectedPageId) {
      if (activeTab === 'feed')     return <PageFeedView />;
      if (activeTab === 'accounts') return <AccountsView onCreateAccount={() => openModal('account')} />;
      return <PageCampaignsView onCreateCampaign={() => openModal('campaign')} />;
    }
    if (activeTab === 'accounts') return <AccountsView onCreateAccount={() => openModal('account')} />;
    return <PagesView onCreatePage={() => openModal('page')} />;
  };

  const primaryCta = selectedAdSetId
    ? { label: '+ New Ad',       action: () => openModal('ad')      }
    : selectedCampaignId
    ? { label: '+ New Ad Set',   action: () => openModal('adset')   }
    : selectedPageId
    ? { label: '+ New Campaign', action: () => openModal('campaign') }
    : { label: '+ New Page',     action: () => openModal('page')    };

  const isLoading = (loadingAllMyPages || loadingAccounts) && !selectedPageId;

  return (
    <>
      <div className="ads-shell">
        {/* Desktop left sidebar */}
        <div className="ads-sidebar-desktop">
          <AdsDashboardSidebar
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onCreatePage={() => openModal('page')}
          />
        </div>

        {/* Main panel */}
        <div className="ads-main">
          <AdsPageHeader
            primaryCta={primaryCta}
            onCreatePage={() => openModal('page')}
            onOpenNav={() => setDrawerOpen(true)}
          />
          <div className="ads-content">
            {isLoading
              ? <DashboardLoader />
              : <div className="ads-content-inner">{renderContent()}</div>
            }
          </div>
        </div>

        {/* Mobile FAB — opens bottom sheet nav */}
        <button
          className="ads-fab"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
        >
          ☰
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="ads-drawer-overlay open" onClick={handleOverlayClick}>
          <div className="ads-drawer-sheet" ref={drawerRef}>
            <div className="ads-drawer-handle" />
            <AdsDashboardSidebar
              activeTab={activeTab}
              onTabChange={(tab) => { setActiveTab(tab); setDrawerOpen(false); }}
              onCreatePage={() => { openModal('page'); setDrawerOpen(false); }}
              mobile
            />
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePageModal     show={modal === 'page'}     onClose={closeModal} accountId={selectedAccountId} />
      <CreateAccountModal  show={modal === 'account'}  onClose={closeModal} />
      <CreateCampaignModal show={modal === 'campaign'} onClose={closeModal} accountId={selectedAccountId} />
      <CreateAdSetModal    show={modal === 'adset'}    onClose={closeModal} campaignId={selectedCampaignId} />
      <CreateAdModal       show={modal === 'ad'}       onClose={closeModal} adSetId={selectedAdSetId} />
    </>
  );
};

const DashboardLoader = () => (
  <div className="ads-loader">
    <div className="ads-loader-spinner" />
    <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>Loading your workspace…</p>
  </div>
);

export default AdsDashboard;