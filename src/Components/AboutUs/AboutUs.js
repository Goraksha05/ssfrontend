import React, { useEffect, useState } from 'react';

/* ── Inline styles all use CSS custom properties written by ThemeContext ── */
const s = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page)',
    color: 'var(--text-primary)',
    padding: '40px 16px 60px',
    fontFamily: "'Nunito', sans-serif",
    transition: 'var(--theme-transition, background 0.3s, color 0.3s)',
  },
  card: {
    maxWidth: 860,
    margin: '0 auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '40px 44px',
    boxShadow: 'var(--shadow-card)',
  },
  h1: {
    fontSize: 30,
    fontWeight: 800,
    marginBottom: 6,
    color: 'var(--text-heading)',
    textAlign: 'center',
    letterSpacing: '-0.3px',
  },
  divider: {
    width: 56,
    height: 4,
    borderRadius: 4,
    background: 'var(--accent-gradient)',
    margin: '0 auto 28px',
  },
  lead: {
    fontSize: 15,
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--accent)',
    marginTop: 28,
    marginBottom: 8,
  },
  ul: {
    paddingLeft: 20,
    margin: '6px 0 12px',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    fontSize: 14.5,
  },
  highlight: {
    color: 'var(--text-primary)',
    fontWeight: 700,
  },
  badge: {
    display: 'inline-block',
    background: 'var(--accent-glow)',
    color: 'var(--accent)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 20,
    padding: '3px 12px',
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 16,
  },
  tagline: {
    textAlign: 'center',
    fontSize: 13,
    color: 'var(--text-muted)',
    marginBottom: 28,
    fontStyle: 'italic',
  },
};

const AboutUs = () => {
  const [visible, setVisible] = useState(false);
  useEffect(() => { const t = setTimeout(() => setVisible(true), 80); return () => clearTimeout(t); }, []);

  return (
    <div style={s.page}>
      <div
        style={{
          ...s.card,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(18px)',
          transition: 'opacity 0.45s ease, transform 0.45s ease',
        }}
      >
        <h1 style={s.h1}>About Us</h1>
        <div style={s.divider} />
        <p style={s.tagline}>Where Social Meets Smart Earning</p>

        <p style={s.lead}>
          <span style={s.highlight}>Welcome to SoShoLife</span> — a reward-driven digital lifestyle platform built in India. We believe social connection and personal growth should go hand in hand. SoShoLife empowers individuals to stay connected, express themselves freely, and earn exciting rewards for everyday activities.
        </p>

        <p style={s.lead}>
          <span style={s.highlight}>SoShoLife is more than just a social platform.</span> It's a space where users can:
        </p>

        <ul style={s.ul}>
          <li><strong style={s.highlight}>Connect &amp; Communicate:</strong> Send friend requests, chat, and build your digital community.</li>
          <li><strong style={s.highlight}>Earn Through Activity:</strong> Get rewarded for daily streaks, posting content, and inviting friends.</li>
          <li><strong style={s.highlight}>Grow With Referrals:</strong> Share your referral code and unlock milestones to earn cash and benefits.</li>
          <li><strong style={s.highlight}>Stay Secure:</strong> OTP-based login and encrypted authentication protect every account.</li>
          <li><strong style={s.highlight}>Access Subscriptions &amp; Perks:</strong> Enjoy exclusive features and rewards via our simple subscription plans.</li>
        </ul>

        <p style={s.lead}>
          We aim to make every social interaction meaningful, fun, and rewarding. Whether you're sharing moments or growing your network, SoShoLife ensures that your time online adds value to your life.
        </p>

        <p style={{ ...s.lead, fontWeight: 700, color: 'var(--accent)', textAlign: 'center', marginTop: 20 }}>
          Join the SoShoLife movement — Because your social life should give back.
        </p>

        <h2 style={s.sectionHeading}>Our Mission</h2>
        <p style={s.lead}>
          SoShoLife is a next-generation social engagement platform that blends community, creativity, and rewards. Built with a mission to turn everyday social activity into tangible value, SoShoLife enables users to connect, post, refer, and earn — all within a secure, intuitive ecosystem.
        </p>
        <p style={s.lead}>
          Whether it's inviting friends, maintaining daily streaks, or simply sharing a post, users are rewarded for staying active. With robust referral systems, milestone-based rewards, and subscription benefits, SoShoLife redefines what it means to be social in the digital era.
        </p>

        <h2 style={s.sectionHeading}>Platform Highlights</h2>
        <ul style={s.ul}>
          <li>🔐 <span style={s.highlight}>Secure Authentication:</span> OTP + Token-based login</li>
          <li>🏆 <span style={s.highlight}>Reward Milestones:</span> Streaks, Posts, Referrals</li>
          <li>🤝 <span style={s.highlight}>Friendship &amp; Networking Tools</span></li>
          <li>💳 <span style={s.highlight}>Subscription Access:</span> Premium perks and exclusive features</li>
          <li>📈 <span style={s.highlight}>Scalable Ecosystem:</span> Built for the growing creator economy</li>
        </ul>

        <p style={{ ...s.lead, textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--text-muted)' }}>
          SoShoLife isn't just social media.<br />
          It's a reward-driven digital lifestyle platform designed for the next billion users.
        </p>
      </div>
    </div>
  );
};

export default AboutUs;