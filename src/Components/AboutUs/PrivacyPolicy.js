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
    marginTop: 14,
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

const PrivacyPolicy = () => {
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
        <h1 style={s.h1}>Privacy Policy</h1>
        <div style={s.divider} />
        <p style={s.meta}>Effective Date: 8 Aug. 2025</p>

        <p style={s.p}>
          Welcome to <strong style={s.strong}>SoShoLife</strong>. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you access or use our website, mobile applications, and associated services (collectively, the "Platform").
        </p>
        <p style={s.p}>
          By using SoShoLife, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use our services.
        </p>

        <Section title="1. Information We Collect">
          <h3 style={s.h3}>a. Personal Information</h3>
          <ul style={s.ul}>
            <li>Full name</li>
            <li>Email address</li>
            <li>Mobile number (for OTP verification)</li>
            <li>Referral code (if applicable)</li>
            <li>Profile picture or bio (optional)</li>
            <li>UPI ID or transaction reference number (for payments)</li>
            <li>KYC documents if required by law or payment partner</li>
          </ul>

          <h3 style={s.h3}>b. Activity Data</h3>
          <ul style={s.ul}>
            <li>Posts created</li>
            <li>Referrals sent and accepted</li>
            <li>Login streaks</li>
            <li>Subscription and reward milestones</li>
            <li>IP address, device type, browser info</li>
          </ul>

          <h3 style={s.h3}>c. Cookies and Tracking</h3>
          <p style={s.p}>We use cookies and local storage to:</p>
          <ul style={s.ul}>
            <li>Maintain login sessions</li>
            <li>Track user preferences</li>
            <li>Measure usage patterns</li>
          </ul>
          <p style={s.p}>You may disable cookies, but some features may not work properly.</p>
        </Section>

        <Section title="2. Use of Information">
          <p style={s.p}>We use the information to:</p>
          <ul style={s.ul}>
            <li>Create and manage user accounts</li>
            <li>Enable social features like friend requests and messaging</li>
            <li>Process payments and reward milestones</li>
            <li>Provide OTP-based secure login</li>
            <li>Send important updates, alerts, or offers</li>
            <li>Analyze usage to improve the platform</li>
          </ul>
        </Section>

        <Section title="3. Sharing and Disclosure">
          <p style={s.p}>We do not sell your personal data to third parties. We may share limited information with:</p>
          <ul style={s.ul}>
            <li>Payment partners like PayTM, banks, or UPI systems</li>
            <li>Regulatory authorities (e.g., RBI) if required by law</li>
            <li>Technical service providers for hosting, SMS, or analytics</li>
          </ul>
          <p style={s.p}>We ensure all third parties follow strict data confidentiality terms.</p>
        </Section>

        <Section title="4. Data Retention &amp; Deletion">
          <p style={s.p}>We retain your data only as long as necessary for:</p>
          <ul style={s.ul}>
            <li>Account access and recovery</li>
            <li>Compliance with legal obligations</li>
            <li>Reward tracking</li>
          </ul>
          <p style={s.p}>
            You may request data deletion anytime by contacting our support. Upon verification, we will erase your profile and associated activity permanently from our systems.
          </p>
        </Section>

        <Section title="5. Security Measures">
          <p style={s.p}>We implement industry-standard security, including:</p>
          <ul style={s.ul}>
            <li>OTP-based login and token authorization</li>
            <li>Encrypted data transmission using HTTPS</li>
            <li>Role-based internal access to sensitive information</li>
          </ul>
          <p style={s.p}>
            However, no method is 100% secure. Users are responsible for protecting their login credentials.
          </p>
        </Section>

        <Section title="6. Third-Party Links">
          <p style={s.p}>
            Our app may include links to third-party websites or services. We are not responsible for their privacy practices. Please review their policies before sharing information.
          </p>
        </Section>

        <Section title="7. Children's Privacy">
          <p style={s.p}>
            SoShoLife is not intended for individuals under 13 years of age. We do not knowingly collect data from minors.
          </p>
        </Section>

        <Section title="8. User Rights">
          <p style={s.p}>You have the right to:</p>
          <ul style={s.ul}>
            <li>Access or update your personal data</li>
            <li>Request data deletion</li>
            <li>Withdraw consent for marketing communications</li>
            <li>Raise complaints regarding misuse of data</li>
          </ul>
          <p style={s.p}>
            You can access or update most information from your account dashboard or by contacting us.
          </p>
        </Section>

        <Section title="9. Changes to this Policy">
          <p style={s.p}>
            We may update this Privacy Policy from time to time. Changes will be posted with the "Effective Date." Continued use of the platform after such updates constitutes your acceptance.
          </p>
        </Section>

        <Section title="10. Grievance Redressal">
          <p style={s.p}>
            <strong style={s.strong}>Grievance Officer Name:</strong> K Goraksha<br />
            <strong style={s.strong}>Email:</strong>{' '}
            <a href="mailto:support@sosholife.com" style={s.link}>support@sosholife.com</a><br />
            <strong style={s.strong}>Address:</strong><br />
            International Tech Park Bangalore, Whitefield Road,<br />
            Bangalore, Karnataka, India – 560066.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p style={s.p}>
            This Privacy Policy is governed by the laws of India. All disputes are subject to the jurisdiction of courts in Bangalore.
          </p>
        </Section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;