import React from 'react';

const TermsPopup = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex justify-center">
      <div className="bg-white shadow-xl border border-gray-300 rounded p-5 w-full max-w-[794px] min-h-[1123px] text-gray-800 overflow-y-auto print:max-w-full print:rounded-none print:shadow-none print:border-none print:p-8">
        <h1 className="text-lg font-bold text-center mb-4"><strong>Terms and Conditions</strong></h1>
        <p className="text-sm text-center mb-6 text-gray-500">Effective Date: 01 Aug. 2025 • Last Updated: 01 Aug. 2025</p>
        <p className="mb-4">
          Welcome to <strong>SoShoLife</strong>. These terms govern your use of our social media platform...
        </p>

        <p className="mb-2">By continuing, you agree to our terms regarding data usage, subscription, and behavior policy.</p>

        <h2 className="text-lg font-semibold mt-4">1. Eligibility</h2>
        <p>You must be at least 13 years old or the minimum legal age in your country to use <strong>SoShoLife...</strong></p>

        <h2 className="text-lg font-semibold mt-4">2. Account Registration and Security</h2>
        <ul className="list-disc ml-6 space-y-1">
          <li>You must provide accurate and complete information during signup.</li>
          <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
          <li>We may suspend or terminate your account if you violate our policies.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-4">3. User Content and Conduct</h2>
        <p>You are solely responsible for the content you post on <strong>SoShoLife...</strong></p>

        <h2 className="text-lg font-semibold mt-4">4. Intellectual Property Rights</h2>
        <p>All platform content and design are protected. By posting, you grant us a limited license to use your content.</p>

        <h2 className="text-lg font-semibold mt-4">5. Subscription Services</h2>
        <p>We offer a yearly subscription with premium benefits like ad-free experience, exclusive content, and more.</p>

        <ul className="list-disc ml-6 space-y-1">
          <li>Subscription is billed annually and auto-renews unless canceled.</li>
          <li>No refunds are provided after the billing period starts.</li>
          <li>You can cancel anytime via your account settings.</li>
        </ul>

        <h2 className="text-lg font-semibold mt-4">6. Suspension and Termination</h2>
        <p>We may suspend your access for violations, fraud, or legal issues...</p>

        <h2 className="text-lg font-semibold mt-4">7. Third-Party Services</h2>
        <p>We may link to third-party platforms, but we're not responsible for their policies or actions.</p>

        <h2 className="text-lg font-semibold mt-4">8. Disclaimers</h2>
        <p>The services are provided "as-is". We don't guarantee uninterrupted access or error-free operation.</p>

        <h2 className="text-lg font-semibold mt-4">9. Limitation of Liability</h2>
        <p>We are not liable for indirect or incidental damages or data loss.</p>

        <h2 className="text-lg font-semibold mt-4">10. Privacy Policy</h2>
        <p>See our <a href="/privacy" className="text-blue-600 underline">Privacy Policy</a> for data usage details.</p>

        <h2 className="text-lg font-semibold mt-4">11. Changes to Terms</h2>
        <p>We may revise these Terms and notify you. Continued use implies acceptance.</p>

        <h2 className="text-lg font-semibold mt-4">12. Governing Law</h2>
        <p>These Terms are governed by the laws of Bharat/India...</p>

        <h2 className="text-lg font-semibold mt-4">13. Contact Us</h2>
        <p>Email: admin@sosholife.com<br />Phone: 7249157446<br />Address: Pune</p>

        <div className="mt-6 text-right">
          <button
            onClick={() => window.close()}
            className="text-dark px-10 py-2 rounded hover:bg-blue-700"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TermsPopup;
