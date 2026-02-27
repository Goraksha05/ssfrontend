import React from 'react';
import { Dialog } from '@headlessui/react';

const TermsModal = ({ isOpen, onClose, onAccept }) => {
  return (
    <Dialog open={isOpen} onClose={onClose} className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="container">
        <Dialog.Title className="text-2xl font-semibold mb-4 text-center">Terms and Conditions</Dialog.Title>

        <div className="overflow-y-auto max-h-[65vh] text-sm text-gray-800 space-y-4">
          <p><strong>Effective Date:</strong> 8 Aug 2025</p>
          <p><strong>Last Updated:</strong> 25 July 2025</p>

          <p>Welcome to <strong>SoShoLife</strong> ("we", "our", or "the Platform"). These Terms and Conditions ("Terms") govern your access to and use of our website, mobile applications, products, and services (collectively, "Services").</p>

          <p>By registering, accessing, or using SoShoLife in any way, you agree to be bound by these Terms. If you do not agree, please refrain from using our Services.</p>

          <h2 className="text-lg font-semibold mt-4">1. Eligibility</h2>
          <p>You must be at least 13 years old or the minimum legal age in your country to use SoShoLife...</p>

          <h2 className="text-lg font-semibold mt-4">2. Account Registration and Security</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>You must provide accurate and complete information during signup.</li>
            <li>You are responsible for maintaining the confidentiality of your login credentials.</li>
            <li>We may suspend or terminate your account if you violate our policies.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-4">3. User Content and Conduct</h2>
          <p>You are solely responsible for the content you post on SoShoLife...</p>

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
          <p>These Terms are governed by the laws of Pune Juridiction...</p>

          <h2 className="text-lg font-semibold mt-4">13. Contact Us</h2>
          <p>Email: support@sosholife.com, admin@sosholife.com<br />Phone: 7249157446<br />Address: Wai, Satara. 412803</p>
        </div>

        <div className="flex justify-end mt-6 gap-2">
          <button onClick={onClose} className="px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg">
            Close
          </button>
          <button onClick={onAccept} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg">
            I Agree
          </button>
        </div>
      </div>
    </Dialog>
  );
};

export default TermsModal;
