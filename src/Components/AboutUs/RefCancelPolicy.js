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
  h3: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-heading)',
    marginTop: 12,
    marginBottom: 4,
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

const RefCancelPolicy = () => {
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
        <h1 style={s.h1}>Refund &amp; Cancellation Policy</h1>
        <div style={s.divider} />
        <p style={s.meta}>Effective Date: 25 July 2025</p>

        <p style={s.p}>
          At <strong style={s.strong}>SoShoLife</strong>, we offer users the ability to subscribe to exclusive reward plans that unlock premium features, milestone benefits, and enhanced earning opportunities. This Refund and Cancellation Policy outlines the terms under which users can cancel subscriptions and request refunds.
        </p>

        <Section title="1. Subscription Plans">
          <p style={s.p}>All subscription plans offered by SoShoLife are clearly detailed within the app or website, including:</p>
          <ul style={s.ul}>
            <li>Plan duration (monthly, quarterly, annually)</li>
            <li>Benefits included</li>
            <li>Pricing and tax, if applicable</li>
          </ul>
          <p style={s.p}>Once a subscription is successfully purchased, it is considered active and non-transferable.</p>
        </Section>

        <Section title="2. Cancellation Policy">
          <p style={s.p}>
            Users may cancel their subscription at any time through their account settings in the SoShoLife app or by contacting our support team.
          </p>
          <ul style={s.ul}>
            <li>Cancellation will stop any auto-renewal (if enabled), but the user will continue to enjoy subscription benefits until the current cycle ends.</li>
            <li>No partial refunds will be issued for unused periods after cancellation unless otherwise specified in writing.</li>
          </ul>
        </Section>

        <Section title="3. Refund Policy">
          <p style={s.p}>We strive for transparency and customer satisfaction. However, refunds will only be processed under the following conditions:</p>

          <h3 style={s.h3}>Eligible Refund Scenarios:</h3>
          <ul style={s.ul}>
            <li>Duplicate payment due to technical issues</li>
            <li>Payment failure where the amount was debited but the subscription was not activated</li>
            <li>Unauthorized transaction, reported within 48 hours of the transaction</li>
            <li>Technical failure preventing access to subscription features within 72 hours of activation</li>
          </ul>

          <p style={s.p}>
            To request a refund, users must contact us at{' '}
            <a href="mailto:support@sosholife.com" style={s.link}>support@sosholife.com</a> with:
          </p>
          <ul style={s.ul}>
            <li>Registered mobile/email</li>
            <li>Transaction reference number</li>
            <li>Brief reason for the refund request</li>
          </ul>
          <p style={s.p}>
            All eligible refund requests will be verified and processed within 7–10 business days to the original payment method.
          </p>
        </Section>

        <Section title="4. Non-Refundable Situations">
          <p style={s.p}>We do not offer refunds in the following cases:</p>
          <ul style={s.ul}>
            <li>User simply changes mind after activation</li>
            <li>Reward features were accessed and used</li>
            <li>Subscription benefits are partially used</li>
            <li>Delayed cancellation by user post renewal</li>
            <li>Claims made after the plan validity has expired</li>
          </ul>
        </Section>

        <Section title="5. Grievance &amp; Escalation">
          <p style={s.p}>
            If you're not satisfied with the resolution of a refund or cancellation issue, you can escalate the matter to our Grievance Officer:
          </p>
          <p style={s.p}>
            <strong style={s.strong}>Grievance Officer:</strong> K Goraksha<br />
            <strong style={s.strong}>Email:</strong>{' '}
            <a href="mailto:grievance@sosholife.com" style={s.link}>grievance@sosholife.com</a><br />
            <strong style={s.strong}>Address:</strong><br />
            International Tech Park Bangalore, Whitefield Road,<br />
            Bangalore, Karnataka, India – 560066.
          </p>
        </Section>

        <Section title="6. Policy Changes">
          <p style={s.p}>
            SoShoLife reserves the right to modify this Refund and Cancellation Policy at any time. Updated policies will be posted with the effective date. Continued use of the platform after updates implies acceptance.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default RefCancelPolicy;