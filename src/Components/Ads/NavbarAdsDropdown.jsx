/**
 * Components/Ads/NavbarAdsDropdown.jsx
 *
 * FIXES in this version:
 *   ✅ "Switch to Home Feed" button — visible only when mode === 'ads'.
 *      Calls setMode('home') + navigate('/') so the user can always escape Ads Manager.
 *   ✅ Footer now has two contextual actions:
 *        • In ads mode   → "← Home Feed"  |  "Ads Manager →"  (side-by-side)
 *        • In home mode  → single "Open Ads Manager →" button (original behaviour)
 *   ✅ Trigger button badge / label unchanged; no visual regressions.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAds } from '../../Context/Ads/AdsContext';
import CreatePageModal from './modals/CreatePageModal';
import adsBtn from '../../Assets/Ads.png';

// ── Category icons ────────────────────────────────────────────────────────────
const CAT_ICON = {
  ecommerce:       '🛒',
  food_beverage:   '🍔',
  fashion:         '👗',
  tech:            '💻',
  education:       '📚',
  health_wellness: '💊',
  real_estate:     '🏠',
  finance:         '💰',
  entertainment:   '🎬',
  travel:          '✈️',
  services:        '🛠️',
  ngo:             '🤝',
  other:           '📦',
};

// ── Status dot ────────────────────────────────────────────────────────────────
const StatusDot = ({ status }) => {
  const color =
    status === 'active'    ? '#22c55e' :
    status === 'suspended' ? '#ef4444' :
    '#f59e0b';

  return (
    <span
      style={{
        display:      'inline-block',
        width:        7,
        height:       7,
        borderRadius: '50%',
        background:   color,
        flexShrink:   0,
      }}
      title={status}
    />
  );
};

// ── NavbarAdsDropdown ─────────────────────────────────────────────────────────

const NavbarAdsDropdown = ({ mode, setMode }) => {
  const navigate = useNavigate();
  const { allMyPages, loadingAllMyPages, selectPage, clearSelection, accounts } = useAds();

  const [open,           setOpen]           = useState(false);
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [search,         setSearch]         = useState('');
  const dropdownRef = useRef(null);

  // ── Close on outside click / Escape ──────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') { setOpen(false); return; }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown',   handler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown',   handler);
    };
  }, [open]);

  // ── Switch to Home Feed ───────────────────────────────────────────────────
  /**
   * Exits Ads Manager: clears any active ad selection, switches the app-level
   * mode back to 'home', and navigates to '/'.
   */
  const handleGoHome = useCallback(() => {
    setOpen(false);
    setSearch('');
    clearSelection?.();   // optional — clears selectedAccount/Page/Campaign/AdSet
    setMode('home');
    navigate('/');
  }, [clearSelection, setMode, navigate]);

  const handleOpenAds = useCallback(() => {
    setOpen(false);
    setSearch('');
    setMode?.('ads');
    navigate('/ads');
  }, [setMode, navigate]);

  // ── Select a Business Page → enter Ads mode ───────────────────────────────
  const handlePageClick = useCallback((page) => {
    setOpen(false);
    setSearch('');
    selectPage(page._id, String(page.adAccount));
    setMode('ads');
    navigate(`/business/${page._id}`);
  }, [selectPage, setMode, navigate]);

  // ── Filtered + grouped pages ──────────────────────────────────────────────
  const filtered = search.trim()
    ? allMyPages.filter(p =>
        p.pageName.toLowerCase().includes(search.toLowerCase()) ||
        (p.tagline || '').toLowerCase().includes(search.toLowerCase())
      )
    : allMyPages;

  const grouped = filtered.reduce((acc, page) => {
    const accId = String(page.adAccount?._id || page.adAccount);
    if (!acc[accId]) {
      acc[accId] = { accountName: page.adAccount?.accountName || 'Ad Account', pages: [] };
    }
    acc[accId].pages.push(page);
    return acc;
  }, {});

  const isAdsMode = mode === 'ads';

  return (
    <>
      <div
        ref={dropdownRef}
        style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      >
        {/* ── Trigger button ── */}
        <button
          className="navbar-mode-toggle-img"
          onClick={() => setOpen(p => !p)}
          aria-haspopup="listbox"
          aria-expanded={open}
          style={{
            position: 'relative',
            border:   open ? '1px solid var(--accent)' : undefined,
            outline:  'none',
          }}
          title="Business Pages"
        >
          <img src={adsBtn} alt="Ads" />
          <span className="btn-label">
            {isAdsMode ? 'Pages ▾' : 'Ads ▾'}
          </span>

          {/* Page-count badge */}
          {allMyPages.length > 0 && (
            <span
              style={{
                position:       'absolute',
                top:            -5,
                right:          -5,
                background:     'var(--accent)',
                color:          '#fff',
                fontSize:       9,
                fontWeight:     800,
                lineHeight:     '14px',
                width:          14,
                height:         14,
                borderRadius:   '50%',
                textAlign:      'center',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}
            >
              {allMyPages.length}
            </span>
          )}
        </button>

        {/* ── Dropdown ── */}
        {open && (
          <div
            style={{
              position:     'absolute',
              top:          'calc(100% + 8px)',
              right:        0,
              zIndex:       2000,
              width:        310,
              background:   'var(--bg-card)',
              border:       '1px solid var(--border)',
              borderRadius: 14,
              boxShadow:    'var(--shadow-xl)',
              overflow:     'hidden',
              animation:    'dropdown-in 0.15s ease',
            }}
            role="listbox"
            aria-label="Business Pages"
          >
            <style>{`
              @keyframes dropdown-in {
                from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            {/* ── Header ── */}
            <div
              style={{
                padding:      '12px 14px 8px',
                borderBottom: '1px solid var(--border)',
              }}
            >
              {/* ── "Back to Home Feed" pill — only in ads mode ── */}
              {isAdsMode && (
                <button
                  onClick={handleGoHome}
                  style={{
                    display:        'flex',
                    alignItems:     'center',
                    gap:            6,
                    width:          '100%',
                    padding:        '7px 10px',
                    marginBottom:   10,
                    borderRadius:   8,
                    border:         '1px solid var(--border)',
                    background:     'var(--bg-hover)',
                    color:          'var(--text-primary)',
                    fontSize:       12,
                    fontWeight:     700,
                    cursor:         'pointer',
                    textAlign:      'left',
                    transition:     'background 0.12s, border-color 0.12s',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background    = 'var(--accent-subtle, rgba(56,189,248,0.1))';
                    e.currentTarget.style.borderColor   = 'var(--accent)';
                    e.currentTarget.style.color         = 'var(--accent)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background    = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor   = 'var(--border)';
                    e.currentTarget.style.color         = 'var(--text-primary)';
                  }}
                  title="Exit Ads Manager and go back to your Home feed"
                >
                  {/* House icon (inline SVG — no extra dependency) */}
                  <svg
                    width="13" height="13" viewBox="0 0 24 24"
                    fill="none" stroke="currentColor"
                    strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                    <polyline points="9 22 9 12 15 12 15 22" />
                  </svg>
                  ← Switch to Home Feed
                </button>
              )}

              <div
                style={{
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'space-between',
                  marginBottom:   6,
                }}
              >
                <span
                  style={{
                    fontSize:      12,
                    fontWeight:    700,
                    color:         'var(--text-secondary)',
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                  }}
                >
                  Business Pages
                </span>
                <button
                  onClick={() => { setOpen(false); setShowCreatePage(true); }}
                  style={{
                    fontSize:     11,
                    fontWeight:   700,
                    color:        'var(--accent)',
                    background:   'transparent',
                    border:       '1px solid var(--accent)',
                    borderRadius: 6,
                    padding:      '2px 8px',
                    cursor:       'pointer',
                  }}
                >
                  + New Page
                </button>
              </div>

              {/* Search */}
              <input
                type="search"
                placeholder="Search pages…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{
                  width:        '100%',
                  boxSizing:    'border-box',
                  padding:      '6px 10px',
                  borderRadius: 8,
                  border:       '1px solid var(--border)',
                  background:   'var(--bg-input)',
                  color:        'var(--text-primary)',
                  fontSize:     12,
                  outline:      'none',
                }}
                autoFocus
              />
            </div>

            {/* ── Page list ── */}
            <div style={{ maxHeight: 320, overflowY: 'auto', padding: '6px 0' }}>
              {loadingAllMyPages ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '10px 14px', alignItems: 'center' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--bg-hover)', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 11, background: 'var(--bg-hover)', borderRadius: 4, marginBottom: 5, width: '60%' }} />
                      <div style={{ height: 9,  background: 'var(--bg-hover)', borderRadius: 4, width: '40%' }} />
                    </div>
                  </div>
                ))
              ) : filtered.length === 0 ? (
                <div style={{ padding: '24px 14px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
                  {search ? 'No pages found.' : 'No pages yet.'}
                  <br />
                  <button
                    onClick={() => { setOpen(false); setShowCreatePage(true); }}
                    style={{
                      marginTop:      8,
                      fontSize:       12,
                      fontWeight:     700,
                      color:          'var(--accent)',
                      background:     'transparent',
                      border:         'none',
                      cursor:         'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Create your first Business Page
                  </button>
                </div>
              ) : (
                Object.entries(grouped).map(([accId, group]) => (
                  <div key={accId}>
                    {Object.keys(grouped).length > 1 && (
                      <div
                        style={{
                          padding:       '4px 14px 2px',
                          fontSize:      10,
                          fontWeight:    700,
                          color:         'var(--text-muted)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                        }}
                      >
                        {group.accountName}
                      </div>
                    )}

                    {group.pages.map(page => (
                      <button
                        key={page._id}
                        onClick={() => handlePageClick(page)}
                        style={{
                          display:    'flex',
                          alignItems: 'center',
                          gap:        10,
                          width:      '100%',
                          padding:    '9px 14px',
                          background: 'transparent',
                          border:     'none',
                          cursor:     'pointer',
                          textAlign:  'left',
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                        role="option"
                        aria-selected={false}
                        aria-label={page.pageName}
                      >
                        <div
                          style={{
                            width:          36,
                            height:         36,
                            borderRadius:   8,
                            background:     page.logoUrl ? 'transparent' : 'var(--accent-gradient)',
                            flexShrink:     0,
                            overflow:       'hidden',
                            display:        'flex',
                            alignItems:     'center',
                            justifyContent: 'center',
                            fontSize:       page.logoUrl ? undefined : 18,
                          }}
                        >
                          {page.logoUrl
                            ? <img src={page.logoUrl} alt={page.pageName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : (CAT_ICON[page.category] || '📦')
                          }
                        </div>

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display:      'flex',
                              alignItems:   'center',
                              gap:          5,
                              fontSize:     13,
                              fontWeight:   600,
                              color:        'var(--text-primary)',
                              whiteSpace:   'nowrap',
                              overflow:     'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            <StatusDot status={page.status} />
                            {page.pageName}
                          </div>
                          {page.tagline && (
                            <div
                              style={{
                                fontSize:     11,
                                color:        'var(--text-muted)',
                                marginTop:    1,
                                whiteSpace:   'nowrap',
                                overflow:     'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {page.tagline}
                            </div>
                          )}
                        </div>

                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* ── Footer ── */}
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
              {isAdsMode ? (
                /* Ads mode: two buttons side-by-side */
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setOpen(false); setMode('ads'); navigate('/'); }}
                    style={{
                      flex:         1,
                      padding:      '7px 0',
                      borderRadius: 8,
                      border:       '1px solid var(--border)',
                      background:   'var(--bg-hover)',
                      color:        'var(--text-secondary)',
                      fontSize:     12,
                      fontWeight:   600,
                      cursor:       'pointer',
                    }}
                  >
                    ← Home Feed
                  </button>
                  <button
                    onClick={handleOpenAds}
                    // onClick={() => { setOpen(false); setMode('ads'); navigate('/'); }}
                    style={{
                      flex:         1,
                      padding:      '7px 0',
                      borderRadius: 8,
                      border:       '1px solid var(--accent)',
                      background:   'var(--accent)',
                      color:        '#fff',
                      fontSize:     12,
                      fontWeight:   600,
                      cursor:       'pointer',
                    }}
                  >
                    Ads Manager →
                  </button>
                </div>
              ) : (
                /* Home / default mode: single button */
                <button
                  onClick={handleOpenAds}
                  style={{
                    width:        '100%',
                    padding:      '7px 0',
                    borderRadius: 8,
                    border:       '1px solid var(--border)',
                    background:   'var(--bg-hover)',
                    color:        'var(--text-secondary)',
                    fontSize:     12,
                    fontWeight:   600,
                    cursor:       'pointer',
                  }}
                >
                  Open Ads Manager →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Page modal */}
      {showCreatePage && (
        <CreatePageModal
          show={showCreatePage}
          onClose={() => setShowCreatePage(false)}
          accountId={accounts[0]?._id}
          accounts={accounts}
        />
      )}
    </>
  );
};

export default NavbarAdsDropdown;