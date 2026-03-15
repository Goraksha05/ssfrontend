// src/Components/AboutUs/TandC.js
// Terms & Conditions page for SoShoLife

import React from 'react';

const LAST_UPDATED = 'March 2026';
const COMPANY     = 'SoShoLife';
const EMAIL       = 'support@sosholife.com';

export default function TandC() {
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.h1}>Terms &amp; Conditions</h1>
        <p style={styles.meta}>Last updated: {LAST_UPDATED}</p>

        <Section title="1. Acceptance of Terms">
          <p>
            By accessing or using {COMPANY} ("the Platform", "we", "us"), you agree to
            be bound by these Terms &amp; Conditions and our Privacy Policy. If you do not
            agree, please stop using the Platform immediately.
          </p>
        </Section>

        <Section title="2. Eligibility">
          <p>
            You must be at least 13 years old to use the Platform. By creating an account,
            you represent that you meet this requirement and that all information you provide
            is accurate and complete.
          </p>
        </Section>

        <Section title="3. User Accounts">
          <ul style={styles.ul}>
            <li>You are responsible for maintaining the confidentiality of your credentials.</li>
            <li>You may not share your account with others or create multiple accounts for
              abusive purposes.</li>
            <li>Notify us immediately at <a href={`mailto:${EMAIL}`} style={styles.link}>{EMAIL}</a> if
              you suspect unauthorised access.</li>
          </ul>
        </Section>

        <Section title="4. Acceptable Use">
          <p>You agree <strong>not</strong> to:</p>
          <ul style={styles.ul}>
            <li>Post content that is illegal, defamatory, harassing, or hateful.</li>
            <li>Upload malware, spam, or unsolicited commercial messages.</li>
            <li>Impersonate another person or entity.</li>
            <li>Scrape, reverse-engineer, or exploit the Platform's systems.</li>
            <li>Attempt to gain unauthorised access to other users' accounts or data.</li>
          </ul>
        </Section>

        <Section title="5. Content Ownership &amp; Licence">
          <p>
            You retain ownership of content you post. By posting, you grant {COMPANY} a
            non-exclusive, royalty-free, worldwide licence to display, distribute, and
            promote that content within the Platform. We will not sell your content to
            third parties.
          </p>
        </Section>

        <Section title="6. Intellectual Property">
          <p>
            All Platform code, design, logos, and trademarks are owned by {COMPANY} or its
            licensors. You may not copy or reproduce them without written permission.
          </p>
        </Section>

        <Section title="7. Subscriptions &amp; Payments">
          <ul style={styles.ul}>
            <li>Premium features are available through paid subscription plans.</li>
            <li>Subscriptions auto-renew unless cancelled before the renewal date.</li>
            <li>Refunds are governed by our Refund &amp; Cancellation Policy.</li>
            <li>Prices may change with 30 days' notice.</li>
          </ul>
        </Section>

        <Section title="8. Referral Programme">
          <p>
            Referral rewards are credited once the referred user completes a qualifying
            action (e.g. account activation or subscription). {COMPANY} reserves the right
            to modify or discontinue the referral programme at any time.
          </p>
        </Section>

        <Section title="9. Privacy">
          <p>
            Your use of the Platform is also governed by our{' '}
            <a href="/privacypolicy" style={styles.link}>Privacy Policy</a>, which is
            incorporated into these Terms by reference.
          </p>
        </Section>

        <Section title="10. Disclaimers">
          <p>
            The Platform is provided "as is" without warranties of any kind. We do not
            guarantee uninterrupted, error-free service. {COMPANY} is not responsible for
            user-generated content.
          </p>
        </Section>

        <Section title="11. Limitation of Liability">
          <p>
            To the fullest extent permitted by law, {COMPANY} shall not be liable for any
            indirect, incidental, or consequential damages arising from your use of the
            Platform.
          </p>
        </Section>

        <Section title="12. Termination">
          <p>
            We may suspend or terminate your account at our discretion if you violate these
            Terms. You may delete your account at any time from your Profile settings.
          </p>
        </Section>

        <Section title="13. Changes to These Terms">
          <p>
            We may update these Terms from time to time. Continued use of the Platform after
            changes are posted constitutes acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="14. Governing Law">
          <p>
            These Terms are governed by the laws of India. Disputes shall be subject to the
            exclusive jurisdiction of courts in Mumbai, Maharashtra.
          </p>
        </Section>

        <Section title="15. Contact Us">
          <p>
            For questions about these Terms, contact us at{' '}
            <a href={`mailto:${EMAIL}`} style={styles.link}>{EMAIL}</a>.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section style={styles.section}>
      <h2 style={styles.h2}>{title}</h2>
      {children}
    </section>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-page, #0d1117)',
    padding: '40px 16px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    maxWidth: 780,
    margin: '0 auto',
    background: 'var(--bg-card, #1a2035)',
    border: '1px solid var(--border, #252d45)',
    borderRadius: 16,
    padding: '36px 40px',
    color: 'var(--text-primary, #e2f3ff)',
    lineHeight: 1.7,
  },
  h1: {
    fontSize: 28,
    fontWeight: 700,
    marginBottom: 4,
    color: 'var(--accent, #0ea5e9)',
  },
  meta: {
    fontSize: 13,
    color: 'var(--text-muted, #64748b)',
    marginBottom: 32,
  },
  section: {
    marginBottom: 28,
  },
  h2: {
    fontSize: 17,
    fontWeight: 600,
    marginBottom: 8,
    color: 'var(--text-primary, #e2f3ff)',
    borderBottom: '1px solid var(--border, #252d45)',
    paddingBottom: 6,
  },
  ul: {
    paddingLeft: 20,
    margin: '8px 0',
  },
  link: {
    color: 'var(--accent, #0ea5e9)',
    textDecoration: 'underline',
  },
};