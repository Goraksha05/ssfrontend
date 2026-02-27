import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 overflow-y-auto px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Privacy Policy</h1>

        <div className="text-gray-800 space-y-5 text-sm sm:text-base leading-relaxed">
          <p><strong>Effective Date:</strong> 8 Aug. 2025</p>

          <p>
            Welcome to <strong>SoShoLife</strong>. This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you access or use our website, mobile applications, and associated services (collectively, the “Platform”).
          </p>

          <p>
            By using SoShoLife, you agree to the practices described in this Privacy Policy. If you do not agree, please do not use our services.
          </p>

          <h2 className="text-lg font-semibold mt-6">1. Information We Collect</h2>

          <h3 className="font-semibold mt-3">a. Personal Information</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Full name</li>
            <li>Email address</li>
            <li>Mobile number (for OTP verification)</li>
            <li>Referral code (if applicable)</li>
            <li>Profile picture or bio (optional)</li>
            <li>UPI ID or transaction reference number (for payments)</li>
            <li>KYC documents if required by law or payment partner</li>
          </ul>

          <h3 className="font-semibold mt-3">b. Activity Data</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Posts created</li>
            <li>Referrals sent and accepted</li>
            <li>Login streaks</li>
            <li>Subscription and reward milestones</li>
            <li>IP address, device type, browser info</li>
          </ul>

          <h3 className="font-semibold mt-3">c. Cookies and Tracking</h3>
          <p>We use cookies and local storage to:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Maintain login sessions</li>
            <li>Track user preferences</li>
            <li>Measure usage patterns</li>
          </ul>
          <p>You may disable cookies, but some features may not work properly.</p>

          <h2 className="text-lg font-semibold mt-6">2. Use of Information</h2>
          <p>We use the information to:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Create and manage user accounts</li>
            <li>Enable social features like friend requests and messaging</li>
            <li>Process payments and reward milestones</li>
            <li>Provide OTP-based secure login</li>
            <li>Send important updates, alerts, or offers</li>
            <li>Analyze usage to improve the platform</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">3. Sharing and Disclosure</h2>
          <p>We do not sell your personal data to third parties. We may share limited information with:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Payment partners like PayTM, banks, or UPI systems</li>
            <li>Regulatory authorities (e.g., RBI) if required by law</li>
            <li>Technical service providers for hosting, SMS, or analytics</li>
          </ul>
          <p>We ensure all third parties follow strict data confidentiality terms.</p>

          <h2 className="text-lg font-semibold mt-6">4. Data Retention & Deletion</h2>
          <p>We retain your data only as long as necessary for:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Account access and recovery</li>
            <li>Compliance with legal obligations</li>
            <li>Reward tracking</li>
          </ul>
          <p>You may request data deletion anytime by contacting our support. Upon verification, we will erase your profile and associated activity permanently from our systems.</p>

          <h2 className="text-lg font-semibold mt-6">5. Security Measures</h2>
          <p>We implement industry-standard security, including:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>OTP-based login and token authorization</li>
            <li>Encrypted data transmission using HTTPS</li>
            <li>Role-based internal access to sensitive information</li>
          </ul>
          <p>However, no method is 100% secure. Users are responsible for protecting their login credentials.</p>

          <h2 className="text-lg font-semibold mt-6">6. Third-Party Links</h2>
          <p>Our app may include links to third-party websites or services. We are not responsible for their privacy practices. Please review their policies before sharing information.</p>

          <h2 className="text-lg font-semibold mt-6">7. Children’s Privacy</h2>
          <p>SoShoLife is not intended for individuals under 13 years of age. We do not knowingly collect data from minors.</p>

          <h2 className="text-lg font-semibold mt-6">8. User Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Access or update your personal data</li>
            <li>Request data deletion</li>
            <li>Withdraw consent for marketing communications</li>
            <li>Raise complaints regarding misuse of data</li>
          </ul>
          <p>You can access or update most information from your account dashboard or by contacting us.</p>

          <h2 className="text-lg font-semibold mt-6">9. Changes to this Policy</h2>
          <p>We may update this Privacy Policy from time to time. Changes will be posted with the “Effective Date.” Continued use of the platform after such updates constitutes your acceptance.</p>

          <h2 className="text-lg font-semibold mt-6">10. Grievance Redressal</h2>
          <p>
            <strong>Grievance Officer Name:</strong> K Goraksha<br />
            <strong>Email:</strong> support@sosholife.com<br />
            {/* <strong>Phone:</strong> 7249157446<br /> */}
            <strong>Address:</strong><br />
            International Tech Park Bangalore<br />
            Whitefield Road,<br />
            Bangalore, Karnataka, India - 560066. 
          </p>

          <h2 className="text-lg font-semibold mt-6">11. Governing Law</h2>
          <p>This Privacy Policy is governed by the laws of India. All disputes are subject to the jurisdiction of courts in Bangalore.</p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
