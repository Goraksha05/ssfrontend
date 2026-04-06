// OpportunityModal.jsx — SoShoLife Opportunity Showcase
// Fully theme-aware: reads all colours from useTheme() tokens + CSS custom properties.
// Supports all 6 palettes (ocean, sunset, forest, royal, rose, midnight) × dark/light.

import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../Context/ThemeUI/ThemeContext';

/* ─────────────────────────── DATA ─────────────────────────── */
const PLANS = [
  {
    id: 'basic',
    name: 'Basic',
    price: '₹2,500',
    badge: '',
    referrals: [
      { refs: 3,  cash: '₹2,500', shares: 10, tokens: 300 },
      { refs: 6,  cash: '₹2,500', shares: 20, tokens: 300 },
      { refs: 10, cash: '₹3,000', shares: 40, tokens: 400 },
    ],
    afterTen: 200,
    streaks: [500, 500, 500, 500, 500, 500, 500, 1000, 1000, 1000, 1000, 1000],
    posts: [
      { count: 30,   cash: '₹500',   shares: 10 },
      { count: 70,   cash: '₹500',   shares: 10 },
      { count: 150,  cash: '₹500',   shares: 10 },
      { count: 300,  cash: '₹1,000', shares: 20 },
      { count: 600,  cash: '₹1,200', shares: 20 },
      { count: 1000, cash: '₹1,500', shares: 20 },
    ],
  },
  {
    id: 'standard',
    name: 'Standard',
    price: '₹3,500',
    badge: '⭐ Popular',
    referrals: [
      { refs: 3,  cash: '₹2,500', shares: 10, tokens: 420 },
      { refs: 6,  cash: '₹3,500', shares: 20, tokens: 420 },
      { refs: 10, cash: '₹4,000', shares: 40, tokens: 560 },
    ],
    afterTen: 280,
    streaks: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1500, 1500, 1500, 1500, 1500],
    posts: [
      { count: 30,   cash: '₹1,000', shares: 15 },
      { count: 70,   cash: '₹1,000', shares: 15 },
      { count: 150,  cash: '₹1,000', shares: 15 },
      { count: 300,  cash: '₹1,500', shares: 30 },
      { count: 600,  cash: '₹1,800', shares: 30 },
      { count: 1000, cash: '₹2,200', shares: 30 },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '₹4,500',
    badge: '👑 Best Value',
    referrals: [
      { refs: 3,  cash: '₹4,500', shares: 10, tokens: 540 },
      { refs: 6,  cash: '₹4,500', shares: 20, tokens: 540 },
      { refs: 10, cash: '₹5,500', shares: 40, tokens: 720 },
    ],
    afterTen: 360,
    streaks: [1500, 1500, 1500, 1500, 1500, 1500, 1500, 2000, 2000, 2000, 2000, 2000],
    posts: [
      { count: 30,   cash: '₹2,000', shares: 20 },
      { count: 70,   cash: '₹2,000', shares: 20 },
      { count: 150,  cash: '₹2,000', shares: 20 },
      { count: 300,  cash: '₹2,500', shares: 40 },
      { count: 600,  cash: '₹3,000', shares: 40 },
      { count: 1000, cash: '₹3,500', shares: 40 },
    ],
  },
];

const STREAK_DAYS = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360];

const COMMUNITY = [
  { members: 500,  reward: '₹50,000',  icon: '👥' },
  { members: 1000, reward: '₹1 Lakh',  icon: '👥' },
  { members: 2000, reward: '₹2 Lakh',  icon: '🏘️' },
  { members: 3000, reward: '₹3 Lakh',  icon: '🏘️' },
  { members: 5000, reward: '₹5 Lakh',  icon: '🌆' },
  { members: 8000, reward: '₹10 Lakh', icon: '🌆' },
];

const TABS = [
  { id: 'Referral',  label: '👥 Referral'  },
  { id: 'Streak',    label: '🔥 Streak'    },
  { id: 'Posts',     label: '📝 Posts'     },
  { id: 'Community', label: '🏘️ Community' },
];

/* ─────────────────────────── COMPONENT ─────────────────────────── */
const OpportunityModal = ({ show, onClose }) => {
  const { tokens, isDark } = useTheme();

  const [activePlan, setActivePlan] = useState('standard');
  const [activeTab,  setActiveTab]  = useState('Referral');
  const [mounted,    setMounted]    = useState(false);
  const overlayRef = useRef(null);

  useEffect(() => {
    if (show) {
      setTimeout(() => setMounted(true), 10);
      document.body.style.overflow = 'hidden';
    } else {
      setMounted(false);
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [show]);

  if (!show) return null;

  const plan = PLANS.find(p => p.id === activePlan);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  /* ── Token shorthands ─────────────────────────────────────── */
  const accent        = tokens.accent;
  const accentAlt     = tokens.accentAlt;
  const accentGlow    = tokens.accentGlow;
  const accentGrad    = tokens.accentGradient;
  const bgCard        = tokens.bgCard;
  const bgCardAlt     = tokens.bgCardAlt;
  const bgHover       = tokens.bgHover;
  const border        = tokens.border;
  const borderSubtle  = tokens.borderSubtle;
  const textPrimary   = tokens.textPrimary;
  const textSecondary = tokens.textSecondary;
  const textMuted     = tokens.textMuted;
  const textInverse   = tokens.textInverse;
  const textHeading   = tokens.textHeading;
  const shadowCard    = tokens.shadowCard;
  const shadowHover   = tokens.shadowHover;
  const navBg         = tokens.navBg;

  /* ── Style objects ────────────────────────────────────────── */
  const S = {
    overlay: {
      position: 'fixed', inset: 0, zIndex: 9999,
      background: isDark ? 'rgba(0,0,0,0.78)' : 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem',
      opacity: mounted ? 1 : 0,
      transition: 'opacity 0.3s ease',
    },
    modal: {
      background: bgCard,
      border: `1px solid ${border}`,
      borderRadius: 'var(--radius, 14px)',
      width: '100%', maxWidth: 820,
      maxHeight: '90vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      boxShadow: shadowHover,
      transform: mounted ? 'translateY(0) scale(1)' : 'translateY(40px) scale(0.96)',
      transition: 'transform 0.35s cubic-bezier(.22,1,.36,1)',
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      color: textPrimary,
    },

    /* Header */
    header: {
      padding: '1.25rem 1.5rem',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      borderBottom: `1px solid ${border}`,
      background: navBg,
      flexShrink: 0,
    },
    headerLeft: { display: 'flex', flexDirection: 'column', gap: 2 },
    title: {
      fontSize: '1.3rem', fontWeight: 800, letterSpacing: '-0.5px',
      background: accentGrad,
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      backgroundClip: 'text',
    },
    subtitle: { fontSize: '0.75rem', color: textMuted },
    closeBtn: {
      width: 34, height: 34, borderRadius: '50%',
      border: `1px solid ${border}`,
      background: bgHover,
      color: textSecondary,
      fontSize: '1.1rem', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.2s', flexShrink: 0,
    },

    /* Plan buttons */
    plansRow: {
      display: 'flex', gap: '0.6rem',
      padding: '1rem 1.5rem 0',
      flexShrink: 0,
      flexWrap: 'wrap',
    },
    planBtn: (isActive) => ({
      flex: '1 1 0', minWidth: 90,
      padding: '0.6rem 0.4rem',
      borderRadius: 'var(--radius-sm, 8px)',
      border: `2px solid ${isActive ? accent : border}`,
      background: isActive ? bgHover : bgCardAlt,
      color: isActive ? textPrimary : textMuted,
      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
      textAlign: 'center',
      boxShadow: isActive ? `0 0 18px ${accentGlow}` : 'none',
      transition: 'all 0.25s',
    }),
    planName:  { fontSize: '0.95rem', display: 'block' },
    planPrice: { fontSize: '0.75rem', opacity: 0.7 },
    planBadge: { fontSize: '0.62rem', display: 'block', marginTop: 2, color: accentAlt },

    /* Tabs */
    tabsRow: {
      display: 'flex', gap: '0.4rem',
      padding: '0.75rem 1.5rem',
      flexShrink: 0, overflowX: 'auto',
      msOverflowStyle: 'none', scrollbarWidth: 'none',
    },
    tab: (isActive) => ({
      padding: '0.38rem 0.85rem',
      borderRadius: 'var(--radius-sm, 8px)',
      border: `1px solid ${isActive ? accent : border}`,
      background: isActive ? bgHover : 'transparent',
      color: isActive ? accent : textMuted,
      fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
      whiteSpace: 'nowrap', transition: 'all 0.2s',
    }),

    /* Body */
    body: { flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem' },

    sectionTitle: {
      fontSize: '0.72rem', fontWeight: 700, letterSpacing: '1.5px',
      textTransform: 'uppercase', color: textMuted,
      margin: '1.25rem 0 0.6rem',
    },

    /* Referral cards */
    refGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
      gap: '0.6rem',
    },
    refCard: {
      borderRadius: 'var(--radius, 14px)', padding: '1rem',
      border: `1px solid ${borderSubtle}`,
      background: bgCardAlt,
      position: 'relative', overflow: 'hidden',
      boxShadow: shadowCard,
      transition: 'transform 0.2s, box-shadow 0.2s',
    },
    accentBar: {
      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
      borderRadius: '14px 14px 0 0',
      background: accentGrad,
    },
    refRefs: {
      fontSize: '0.72rem', color: textMuted,
      fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px',
    },
    refCash: {
      fontSize: '1.6rem', fontWeight: 900,
      margin: '0.2rem 0', letterSpacing: '-1px',
      color: accent,
    },
    refPills: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: '0.5rem' },
    pill: {
      fontSize: '0.68rem', fontWeight: 600, padding: '2px 8px',
      borderRadius: 20, background: bgHover,
      color: textSecondary, border: `1px solid ${border}`,
    },
    afterTen: {
      marginTop: '0.9rem', padding: '0.75rem 1rem',
      borderRadius: 'var(--radius-sm, 8px)',
      background: bgCardAlt,
      border: `1px dashed ${border}`,
      fontSize: '0.82rem', color: textSecondary,
      lineHeight: 1.5,
    },

    /* Streak */
    streakGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
      gap: '0.45rem',
    },
    streakRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.55rem 0.85rem',
      borderRadius: 'var(--radius-sm, 8px)',
      background: bgCardAlt, border: `1px solid ${border}`,
      fontSize: '0.82rem',
    },
    streakDay: { color: textMuted, fontWeight: 600 },
    streakVal: { fontWeight: 800, color: accent },
    streakNote: {
      marginTop: '0.75rem', fontSize: '0.78rem', color: textSecondary,
      background: bgCardAlt,
      borderRadius: 'var(--radius-sm, 8px)',
      padding: '0.65rem 0.85rem',
      border: `1px solid ${border}`,
      lineHeight: 1.5,
    },

    /* Posts table */
    postTable: { width: '100%', borderCollapse: 'separate', borderSpacing: '0 5px' },
    postTh: {
      fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: 1, color: textMuted,
      padding: '0 0.75rem 0.3rem', textAlign: 'left',
    },
    postTdBase: {
      padding: '0.6rem 0.75rem', fontSize: '0.85rem',
      background: bgCardAlt,
      borderTop: `1px solid ${border}`,
      borderBottom: `1px solid ${border}`,
    },
    postTdFirst: {
      borderLeft: `1px solid ${border}`,
      borderRadius: '10px 0 0 10px',
      color: textSecondary,
    },
    postTdLast: {
      borderRight: `1px solid ${border}`,
      borderRadius: '0 10px 10px 0',
    },
    postCash: { fontWeight: 800, color: accent },

    /* Community */
    communityList: { display: 'flex', flexDirection: 'column', gap: '0.45rem' },
    communityRow: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0.7rem 1rem',
      borderRadius: 'var(--radius, 14px)',
      background: bgCardAlt, border: `1px solid ${border}`,
    },
    communityMembers: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
    communityCount:   { fontSize: '0.9rem', fontWeight: 700, color: textPrimary },
    communityReward:  { fontSize: '1.05rem', fontWeight: 900, color: accent },

    /* CTA */
    cta: {
      marginTop: '1.25rem', padding: '1rem',
      borderRadius: 'var(--radius, 14px)', textAlign: 'center',
      background: isDark
        ? `linear-gradient(135deg, ${accentGlow}, transparent)`
        : `linear-gradient(135deg, ${accentGlow}, ${bgHover})`,
      border: `1px solid ${borderSubtle}`,
    },
    ctaText: { fontSize: '0.85rem', color: textSecondary, marginBottom: '0.6rem' },
    ctaBtn: {
      display: 'inline-block', padding: '0.6rem 1.75rem',
      borderRadius: 50, fontSize: '0.88rem', fontWeight: 800,
      color: textInverse, textDecoration: 'none', cursor: 'pointer',
      background: accentGrad,
      border: 'none',
      boxShadow: `0 4px 20px ${accentGlow}`,
      transition: 'opacity 0.2s, transform 0.2s',
    },
  };

  return (
    <div ref={overlayRef} style={S.overlay} onClick={handleOverlayClick}>
      <div style={S.modal}>

        {/* ── Header ── */}
        <div style={S.header}>
          <div style={S.headerLeft}>
            <span style={S.title}>💰 SoShoLife Opportunity</span>
            <span style={S.subtitle}>Your complete income breakdown — earn while you engage</span>
          </div>
          <button
            style={S.closeBtn}
            onClick={onClose}
            onMouseEnter={e => {
              e.currentTarget.style.background = isDark ? 'rgba(255,80,80,0.18)' : 'rgba(220,30,30,0.1)';
              e.currentTarget.style.color = textPrimary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = bgHover;
              e.currentTarget.style.color = textSecondary;
            }}
          >✕</button>
        </div>

        {/* ── Plan selector ── */}
        <div style={S.plansRow}>
          {PLANS.map(p => (
            <button
              key={p.id}
              style={S.planBtn(activePlan === p.id)}
              onClick={() => setActivePlan(p.id)}
            >
              <span style={S.planName}>{p.name}</span>
              <span style={S.planPrice}>{p.price}</span>
              {p.badge && <span style={S.planBadge}>{p.badge}</span>}
            </button>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div style={S.tabsRow}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              style={S.tab(activeTab === tab.id)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label} Income
            </button>
          ))}
        </div>

        {/* ── Scrollable body ── */}
        <div style={S.body}>

          {/* REFERRAL */}
          {activeTab === 'Referral' && (
            <>
              <p style={S.sectionTitle}>Referral Income — {plan.name} Plan</p>
              <div style={S.refGrid}>
                {plan.referrals.map((r, i) => (
                  <div key={i} style={S.refCard}>
                    <div style={S.accentBar} />
                    <div style={S.refRefs}>{r.refs} Referrals</div>
                    <div style={S.refCash}>{r.cash}</div>
                    <div style={S.refPills}>
                      <span style={S.pill}>+{r.shares} Shares</span>
                      <span style={S.pill}>+{r.tokens} Tokens</span>
                    </div>
                  </div>
                ))}
              </div>
              <div style={S.afterTen}>
                After your first 10 referrals, every additional referral earns{' '}
                <strong style={{ color: accent }}>{plan.afterTen} Tokens</strong> — tokens convert
                to <strong style={{ color: accent }}>₹{plan.afterTen}/month</strong> after 6 months. Great for long-term passive income as your network grows.
                Max monthly income: <strong style={{ color: accentAlt }}>₹30,000</strong>.
              </div>
            </>
          )}

          {/* STREAK */}
          {activeTab === 'Streak' && (
            <>
              <p style={S.sectionTitle}>Daily Streak → D-Mart Grocery Coupons — {plan.name}</p>
              <div style={S.streakGrid}>
                {STREAK_DAYS.map((day, i) => (
                  <div key={day} style={S.streakRow}>
                    <span style={S.streakDay}>🔥 {day}-day streak</span>
                    <span style={S.streakVal}>₹{plan.streaks[i].toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div style={S.streakNote}>
                <strong style={{ color: accentAlt }}>Bonus Upgrade:</strong>{' '}
                After 6 referrals your streak plan will upgrade as "Every future D-Mart coupon
                increases by <strong style={{ color: accent }}>+₹2,000</strong> at each milestone".
              </div>
            </>
          )}

          {/* POSTS */}
          {activeTab === 'Posts' && (
            <>
              <p style={S.sectionTitle}>Post Creation Rewards — {plan.name}</p>
              <table style={S.postTable}>
                <thead>
                  <tr>
                    <th style={S.postTh}>Posts</th>
                    <th style={S.postTh}>Cash Reward</th>
                    <th style={S.postTh}>Company Shares</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.posts.map((p, i) => (
                    <tr key={i}>
                      <td style={{ ...S.postTdBase, ...S.postTdFirst }}>{p.count} posts</td>
                      <td style={{ ...S.postTdBase, ...S.postCash }}>{p.cash}</td>
                      <td style={{ ...S.postTdBase, ...S.postTdLast }}>
                        <span style={S.pill}>+{p.shares} shares</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* COMMUNITY */}
          {activeTab === 'Community' && (
            <>
              <p style={S.sectionTitle}>Community Gift — All Plans</p>
              <div style={S.communityList}>
                {COMMUNITY.map((c, i) => (
                  <div key={i} style={S.communityRow}>
                    <div style={S.communityMembers}>
                      <span style={{ fontSize: '1.1rem' }}>{c.icon}</span>
                      <span style={S.communityCount}>{c.members.toLocaleString()} Members</span>
                    </div>
                    <span style={S.communityReward}>{c.reward}</span>
                  </div>
                ))}
              </div>
              <div style={{ ...S.afterTen, marginTop: '0.9rem' }}>
                Build a network of{' '}
                <strong style={{ color: accentAlt }}>8,000 members</strong> and earn a
                community gift of <strong style={{ color: accent }}>₹10 Lakh</strong>.
                Your community = your referrals + their referrals, compounded.
              </div>
            </>
          )}

          {/* CTA */}
          <div style={S.cta}>
            <p style={S.ctaText}>
              Start your journey with the{' '}
              <strong style={{ color: textHeading }}>{plan.name}</strong> plan at {plan.price}
            </p>
            <a
              style={S.ctaBtn}
              href="https://sosholife.com"
              target="_blank"
              rel="noopener noreferrer"
              onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Join SoShoLife Now 🚀
            </a>
          </div>

        </div>{/* /body */}
      </div>{/* /modal */}
    </div>
  );
};

export default OpportunityModal;