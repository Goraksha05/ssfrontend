import React, { useEffect, useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   AboutUs.js — Redesigned to match SoShoLife's design language
   Consumes ThemeContext CSS custom properties for full dark/light
   support across all 6 palette variants.
═══════════════════════════════════════════════════════════════ */

/* ── Stat card data ──────────────────────────────────────────── */
const STATS = [
  { icon: '👥', value: '10K+', label: 'Active Members' },
  { icon: '🏆', value: '₹50L+', label: 'Rewards Paid' },
  { icon: '🤝', value: '1M+',  label: 'Referrals Made' },
  { icon: '📈', value: '99%',  label: 'Uptime' },
];

/* ── Feature list ────────────────────────────────────────────── */
const FEATURES = [
  {
    emoji: '💬',
    title: 'Connect & Communicate',
    desc: 'Send friend requests, chat in real time, and build your digital community — all in one place.',
  },
  {
    emoji: '🔥',
    title: 'Earn Through Activity',
    desc: 'Daily streaks, post milestones, and referral rewards turn your everyday actions into real income.',
  },
  {
    emoji: '🤝',
    title: 'Grow With Referrals',
    desc: 'Share your unique code, unlock milestone rewards, and earn cash directly into your bank account.',
  },
  {
    emoji: '🔐',
    title: 'Stay Secure',
    desc: 'OTP-based login, KYC verification, and encrypted token authentication protect every account.',
  },
  {
    emoji: '💳',
    title: 'Subscription Perks',
    desc: 'Premium plans unlock higher reward slabs, verified badges, and exclusive platform features.',
  },
  {
    emoji: '🎬',
    title: 'Reels & Stories',
    desc: 'Share short videos, post status updates, and express yourself with a full creator toolkit.',
  },
];

/* ── Platform highlights ─────────────────────────────────────── */
const HIGHLIGHTS = [
  { icon: '🔐', text: 'OTP + Token-based login' },
  { icon: '🏆', text: 'Streak, Post & Referral milestones' },
  { icon: '🤝', text: 'Friend requests & real-time chat' },
  { icon: '💳', text: 'Basic, Standard & Premium plans' },
  { icon: '📈', text: 'Scalable creator economy' },
  { icon: '🎬', text: 'Reels, Status & Media sharing' },
];

/* ── Styles object (all values via CSS vars) ─────────────────── */
const S = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    padding: '40px 16px 80px',
    fontFamily: "'DM Sans', 'Nunito', sans-serif",
    transition: 'background 0.3s, color 0.3s',
  },
  inner: {
    maxWidth: 880,
    margin: '0 auto',
  },
  /* ── Hero ── */
  hero: {
    textAlign: 'center',
    marginBottom: 48,
  },
  heroBadge: {
    display: 'inline-block',
    background: 'var(--accent-glow)',
    color: 'var(--accent)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 20,
    padding: '4px 16px',
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 'clamp(28px, 5vw, 44px)',
    fontWeight: 800,
    color: 'var(--text-heading)',
    margin: '0 0 8px',
    fontFamily: "'Syne', 'DM Sans', sans-serif",
    letterSpacing: '-0.5px',
    lineHeight: 1.15,
  },
  heroAccent: {
    color: 'var(--accent)',
  },
  heroSub: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
    maxWidth: 560,
    margin: '0 auto 24px',
  },
  divider: {
    width: 64,
    height: 4,
    borderRadius: 4,
    background: 'var(--accent-gradient)',
    margin: '0 auto',
  },
  /* ── Stat strip ── */
  statStrip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: 12,
    marginBottom: 48,
  },
  statCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    padding: '20px 16px',
    textAlign: 'center',
    boxShadow: 'var(--shadow-card)',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  statEmoji: {
    fontSize: 28,
    marginBottom: 6,
    lineHeight: 1,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 800,
    color: 'var(--accent)',
    lineHeight: 1.1,
    fontFamily: "'Syne', sans-serif",
  },
  statLabel: {
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: 4,
  },
  /* ── Section label ── */
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--accent)',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 'clamp(20px, 3vw, 28px)',
    fontWeight: 800,
    color: 'var(--text-heading)',
    margin: '0 0 12px',
    fontFamily: "'Syne', 'DM Sans', sans-serif",
    letterSpacing: '-0.3px',
  },
  sectionBody: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    marginBottom: 8,
  },
  /* ── Feature grid ── */
  featureGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 16,
    marginBottom: 56,
  },
  featureCard: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    padding: '22px 20px',
    boxShadow: 'var(--shadow-card)',
    transition: 'transform 0.2s, border-color 0.2s',
  },
  featureEmoji: {
    fontSize: 28,
    marginBottom: 12,
    lineHeight: 1,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 6px',
  },
  featureDesc: {
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.65,
    margin: 0,
  },
  /* ── Mission section ── */
  missionCard: {
    background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-card-alt) 100%)',
    border: '1px solid var(--border)',
    borderLeft: '4px solid var(--accent)',
    borderRadius: 16,
    padding: '28px 28px',
    marginBottom: 48,
    boxShadow: 'var(--shadow-card)',
  },
  /* ── Highlights grid ── */
  highlightGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 10,
    marginBottom: 48,
  },
  highlightItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--bg-input)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '12px 14px',
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    fontWeight: 500,
  },
  highlightIcon: {
    fontSize: 18,
    flexShrink: 0,
    lineHeight: 1,
  },
  /* ── CTA ── */
  cta: {
    background: 'var(--accent-gradient)',
    borderRadius: 20,
    padding: '40px 32px',
    textAlign: 'center',
    color: '#fff',
  },
  ctaTitle: {
    fontSize: 'clamp(20px, 3vw, 26px)',
    fontWeight: 800,
    margin: '0 0 10px',
    fontFamily: "'Syne', 'DM Sans', sans-serif",
    color: '#fff',
  },
  ctaSub: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    margin: 0,
    lineHeight: 1.6,
  },
};

/* ═══════════════════════════════════════════════════════════════
   Component
═══════════════════════════════════════════════════════════════ */
const AboutUs = () => {
  const [visible, setVisible] = useState(false);
  const [hoveredStat, setHoveredStat] = useState(null);
  const [hoveredFeature, setHoveredFeature] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80);
    return () => clearTimeout(t);
  }, []);

  const fadeIn = (delay = 0) => ({
    opacity: visible ? 1 : 0,
    transform: visible ? 'translateY(0)' : 'translateY(20px)',
    transition: `opacity 0.5s ease ${delay}ms, transform 0.5s ease ${delay}ms`,
  });

  return (
    <div style={S.page}>
      <div style={S.inner}>

        {/* ── Hero ── */}
        <div style={{ ...S.hero, ...fadeIn(0) }}>
          <div style={S.heroBadge}>🇮🇳 Made in India</div>
          <h1 style={S.heroTitle}>
            Social that <span style={S.heroAccent}>gives back</span>
          </h1>
          <p style={S.heroSub}>
            SoShoLife is a reward-driven digital lifestyle platform where connecting, posting, and referring friends translates into real earnings.
          </p>
          <div style={S.divider} />
        </div>

        {/* ── Stat strip ── */}
        <div style={{ ...S.statStrip, ...fadeIn(80) }}>
          {STATS.map((stat, i) => (
            <div
              key={stat.label}
              style={{
                ...S.statCard,
                transform: hoveredStat === i ? 'translateY(-3px)' : 'none',
                boxShadow: hoveredStat === i
                  ? '0 8px 28px rgba(0,0,0,0.15)'
                  : 'var(--shadow-card)',
              }}
              onMouseEnter={() => setHoveredStat(i)}
              onMouseLeave={() => setHoveredStat(null)}
            >
              <div style={S.statEmoji}>{stat.icon}</div>
              <div style={S.statValue}>{stat.value}</div>
              <div style={S.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── What is SoShoLife ── */}
        <div style={{ marginBottom: 48, ...fadeIn(120) }}>
          <p style={S.sectionLabel}>Who we are</p>
          <h2 style={S.sectionTitle}>More than just a social platform</h2>
          <p style={S.sectionBody}>
            SoShoLife empowers individuals to stay connected, express themselves freely, and earn exciting rewards for everyday activities. Whether you're sharing moments or growing your network, every action on SoShoLife adds value to your life.
          </p>
          <p style={S.sectionBody}>
            Join the movement — because your social life should give back.
          </p>
        </div>

        {/* ── Feature grid ── */}
        <div style={fadeIn(160)}>
          <p style={S.sectionLabel}>What you can do</p>
          <h2 style={{ ...S.sectionTitle, marginBottom: 20 }}>Everything in one place</h2>
        </div>

        <div style={{ ...S.featureGrid, ...fadeIn(200) }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              style={{
                ...S.featureCard,
                transform: hoveredFeature === i ? 'translateY(-3px)' : 'none',
                borderColor: hoveredFeature === i ? 'var(--accent)' : 'var(--border)',
              }}
              onMouseEnter={() => setHoveredFeature(i)}
              onMouseLeave={() => setHoveredFeature(null)}
            >
              <div style={S.featureEmoji}>{f.emoji}</div>
              <h3 style={S.featureTitle}>{f.title}</h3>
              <p style={S.featureDesc}>{f.desc}</p>
            </div>
          ))}
        </div>

        {/* ── Mission ── */}
        <div style={{ ...S.missionCard, ...fadeIn(240) }}>
          <p style={{ ...S.sectionLabel, marginBottom: 6 }}>Our mission</p>
          <h2 style={{ ...S.sectionTitle, fontSize: 22, marginBottom: 14 }}>
            Turning social activity into tangible value
          </h2>
          <p style={{ ...S.sectionBody, marginBottom: 10 }}>
            SoShoLife is a next-generation social engagement platform that blends community, creativity, and rewards. Built with a mission to turn everyday social activity into tangible value, we enable users to connect, post, refer, and earn — all within a secure, intuitive ecosystem.
          </p>
          <p style={{ ...S.sectionBody, margin: 0 }}>
            With robust referral systems, milestone-based rewards, and flexible subscription plans, SoShoLife redefines what it means to be social in the digital era — designed for India's next billion users.
          </p>
        </div>

        {/* ── Platform highlights ── */}
        <div style={fadeIn(280)}>
          <p style={S.sectionLabel}>Platform highlights</p>
          <h2 style={{ ...S.sectionTitle, marginBottom: 16 }}>Built with care</h2>
          <div style={S.highlightGrid}>
            {HIGHLIGHTS.map((h) => (
              <div key={h.text} style={S.highlightItem}>
                <span style={S.highlightIcon}>{h.icon}</span>
                <span>{h.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── CTA ── */}
        <div style={{ ...S.cta, ...fadeIn(320) }}>
          <p style={S.ctaTitle}>SoShoLife isn't just social media.</p>
          <p style={S.ctaSub}>
            It's a reward-driven digital lifestyle platform designed for the next billion users.
            <br />Join today and start earning from your social life.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AboutUs;