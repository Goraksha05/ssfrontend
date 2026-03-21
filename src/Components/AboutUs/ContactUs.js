import React, { useEffect, useState } from 'react';

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
    maxWidth: 620,
    margin: '0 auto',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 20,
    padding: '40px 44px',
    boxShadow: 'var(--shadow-card)',
    textAlign: 'center',
  },
  h1: {
    fontSize: 30,
    fontWeight: 800,
    marginBottom: 6,
    color: 'var(--text-heading)',
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
    fontSize: 14.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    marginBottom: 20,
  },
  contactBlock: {
    display: 'inline-flex',
    flexDirection: 'column',
    gap: 10,
    marginBottom: 24,
    alignItems: 'center',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    fontSize: 15,
    color: 'var(--text-secondary)',
  },
  label: {
    fontWeight: 700,
    color: 'var(--text-primary)',
    minWidth: 60,
    textAlign: 'right',
  },
  link: {
    color: 'var(--text-link)',
    textDecoration: 'none',
    fontWeight: 600,
    transition: 'opacity 0.15s',
  },
  hours: {
    display: 'inline-block',
    background: 'var(--bg-card-alt)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '10px 20px',
    fontSize: 13.5,
    color: 'var(--text-secondary)',
    marginBottom: 20,
  },
  hoursStrong: {
    color: 'var(--accent)',
    fontWeight: 700,
  },
};

const ContactUs = () => {
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
        <h1 style={s.h1}>Contact Us</h1>
        <div style={s.divider} />

        <p style={s.lead}>
          We'd love to hear from you! Whether you have a question, suggestion, or need help,
          our team is always ready to assist.
        </p>

        <div style={s.contactBlock}>
          <div style={s.row}>
            <span style={s.label}>Email:</span>
            <a href="mailto:admin@sosholife.com" style={s.link}>admin@sosholife.com</a>
          </div>
          {/* <div style={s.row}>
            <span style={s.label}>Phone:</span>
            <a href="tel:7249157446" style={s.link}>7249157446</a>
          </div> */}
        </div>

        <div style={s.hours}>
          Support hours: <span style={s.hoursStrong}>Mon – Sat, 10:00 AM – 6:00 PM IST</span>
        </div>

        <p style={{ ...s.lead, marginBottom: 0, fontSize: 13.5 }}>
          You can also connect with us via social media or directly within the SoShoLife app
          through the help center.
        </p>
      </div>
    </div>
  );
};

export default ContactUs;