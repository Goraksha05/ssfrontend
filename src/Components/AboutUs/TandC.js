// src/Components/AboutUs/TandC.js
// Terms & Conditions — fully theme-aware via CSS custom properties from ThemeContext

import React, { useEffect, useState } from 'react';

const LAST_UPDATED = 'March 2026';
const COMPANY      = 'SoShoLife';
const EMAIL        = 'support@sosholife.com';

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
    maxWidth: 780,
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
    margin: '0 auto 10px',
  },
  meta: {
    textAlign: 'center',
    fontSize: 12.5,
    color: 'var(--text-muted)',
    marginBottom: 28,
  },
  h2: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--accent)',
    marginTop: 26,
    marginBottom: 6,
    borderBottom: '1px solid var(--border)',
    paddingBottom: 5,
  },
  p: {
    fontSize: 14.5,
    color: 'var(--text-secondary)',
    lineHeight: 1.75,
    marginBottom: 8,
  },
  ul: {
    paddingLeft: 20,
    margin: '6px 0 10px',
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
    fontSize: 14.5,
  },
  link: {
    color: 'var(--text-link)',
    textDecoration: 'underline',
  },
  strong: {
    color: 'var(--text-primary)',
    fontWeight: 700,
  },
};

const Section = ({ title, children }) => (
  <section>
    <h2 style={s.h2}>{title}</h2>
    {children}
  </section>
);

export default function TandC() {
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
        <h1 style={s.h1}>Terms &amp; Conditions</h1>
        <div style={s.divider} />
        <p style={s.meta}>Last updated: {LAST_UPDATED}</p>

        <Section title="1. Acceptance of Terms">
          <p style={s.p}>
            By accessing or using {COMPANY} ("the Platform", "we", "us"), you agree to be bound by these Terms &amp; Conditions and our Privacy Policy. If you do not agree, please stop using the Platform immediately.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p style={s.p}>
            You must be at least 13 years old to use the Platform. By creating an account, you represent that you meet this requirement and that all information you provide is accurate and complete.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <ul style={s.ul}>
            <li>You are responsible for maintaining the confidentiality of your credentials.</li>
            <li>You may not share your account with others or create multiple accounts for abusive purposes.</li>
            <li>
              Notify us immediately at{' '}
              <a href={`mailto:${EMAIL}`} style={s.link}>{EMAIL}</a>{' '}
              if you suspect unauthorised access.
            </li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use">
          <p style={s.p}>You agree <strong style={s.strong}>not</strong> to:</p>
          <ul style={s.ul}>
            <li>Post content that is illegal, defamatory, harassing, or hateful.</li>
            <li>Upload malware, spam, or unsolicited commercial messages.</li>
            <li>Impersonate another person or entity.</li>
            <li>Scrape, reverse-engineer, or exploit the Platform's systems.</li>
            <li>Attempt to gain unauthorised access to other users' accounts or data.</li>
          </ul>
        </Section>

        <Section title="5. Content Ownership &amp; Licence">
          <p style={s.p}>
            You retain ownership of content you post. By posting, you grant {COMPANY} a non-exclusive, royalty-free, worldwide licence to display, distribute, and promote that content within the Platform. We will not sell your content to third parties.
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <p style={s.p}>
            All Platform code, design, logos, and trademarks are owned by {COMPANY} or its licensors. You may not copy or reproduce them without written permission.
          </p>
        </Section>

        <Section title="7. Subscriptions &amp; Payments">
          <ul style={s.ul}>
            <li>Premium features are available through paid subscription plans.</li>
            <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
            <li>Refunds are governed by our Refund &amp; Cancellation Policy.</li>
            <li>Prices may change with 30 days' notice.</li>
          </ul>
        </Section>

        <Section title="8. Referral Programme">
          <p style={s.p}>
            Referral rewards are credited once the referred user completes a qualifying action (e.g. account activation or subscription). {COMPANY} reserves the right to modify or discontinue the referral programme at any time.
          </p>
        </Section>

        <Section title="9. Privacy">
          <p style={s.p}>
            Your use of the Platform is also governed by our{' '}
            <a href="/privacypolicy" style={s.link}>Privacy Policy</a>, which is incorporated into these Terms by reference.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p style={s.p}>
            The Platform is provided "as is" without warranties of any kind. We do not guarantee uninterrupted, error-free service. {COMPANY} is not responsible for user-generated content.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p style={s.p}>
            To the fullest extent permitted by law, {COMPANY} shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform.
          </p>
        </Section>

        <Section title="12. Termination">
          <p style={s.p}>
            We may suspend or terminate your account at our discretion if you violate these Terms. You may delete your account at any time from your Profile settings.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p style={s.p}>
            We may update these Terms from time to time. Continued use of the Platform after changes are posted constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="14. Governing Law">
          <p style={s.p}>
            These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of courts in Mumbai, Maharashtra.
          </p>
        </Section>

        <Section title="15. Contact Us">
          <p style={s.p}>
            For questions about these Terms, contact us at{' '}
            <a href={`mailto:${EMAIL}`} style={s.link}>{EMAIL}</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}