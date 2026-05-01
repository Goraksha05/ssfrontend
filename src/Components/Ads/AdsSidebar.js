/**
 * AdsSidebar.js
 *
 * Self-contained sidebar nav for the Ads Manager.
 * Uses inline styles for structural properties so it renders correctly
 * regardless of external class availability.
 * Utility classes (text-muted, text-xs, etc.) still come from globals.css.
 */

import React from 'react';

const menu = [
  { id: 'accounts',   label: 'Accounts',   icon: '🏢' },
  { id: 'campaigns',  label: 'Campaigns',  icon: '📊' },
  { id: 'adsets',     label: 'Ad Sets',    icon: '📁' },
  { id: 'ads',        label: 'Ads',        icon: '🎯' },
  { id: 'settings',   label: 'Settings',   icon: '⚙️' },
];

const AdsSidebar = ({ active = 'accounts', onChange }) => {
  return (
  <aside className="flex flex-col h-full px-3 py-5">
      {/* Header */}
      <div className="mb-6 p-2">
        <h2
          style={{
            fontFamily:  'var(--font-display)',
            fontSize:    'var(--text-xl)',
            fontWeight:  'var(--weight-bold)',
            color:       'var(--text-heading)',
            lineHeight:  'var(--leading-tight)',
            margin:      0,
          }}
        >
          Ads Manager
        </h2>
        <p
          style={{
            fontSize:  'var(--text-xs)',
            color:     'var(--text-muted)',
            marginTop:  4,
          }}
        >
          Manage campaigns &amp; insights
        </p>
      </div>

      {/* Nav items */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
        {menu.map((item) => {
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange?.(item.id)}
              style={{
                display:         'flex',
                alignItems:      'center',
                gap:             10,
                padding:         '9px 12px',
                borderRadius:    'var(--radius-sm)',
                border:          isActive ? '1px solid var(--accent)' : '1px solid transparent',
                background:      isActive ? 'var(--bg-hover)' : 'transparent',
                color:           isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontSize:        'var(--text-sm)',
                fontFamily:      'var(--font-ui)',
                fontWeight:      isActive ? 'var(--weight-semibold)' : 'var(--weight-regular)',
                cursor:          'pointer',
                textAlign:       'left',
                transition:      'var(--transition-base)',
                boxShadow:       isActive ? 'var(--shadow-xs)' : 'none',
                width:           '100%',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--bg-hover)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0 }}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        style={{
          paddingTop:  16,
          borderTop:   '1px solid var(--border)',
          fontSize:    'var(--text-xs)',
          color:       'var(--text-muted)',
        }}
      >
        © Ads System
      </div>
    </aside>
  );
};

export default AdsSidebar;