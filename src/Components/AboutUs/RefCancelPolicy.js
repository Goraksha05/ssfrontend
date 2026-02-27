import React from 'react';

const RefCancelPolicy = () => {
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 overflow-y-auto px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Refund & Cancellation Policy</h1>

        <div className="text-gray-800 space-y-5 text-sm sm:text-base leading-relaxed">
          <p><strong>Effective Date:</strong> 25 July 2025</p>

          <p>
            At <strong>SoShoLife</strong>, we offer users the ability to subscribe to exclusive reward plans that unlock premium features, milestone benefits, and enhanced earning opportunities. This Refund and Cancellation Policy outlines the terms under which users can cancel subscriptions and request refunds.
          </p>

          <h2 className="text-lg font-semibold mt-6">1. Subscription Plans</h2>
          <p>All subscription plans offered by SoShoLife are clearly detailed within the app or website, including:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Plan duration (monthly, quarterly, annually)</li>
            <li>Benefits included</li>
            <li>Pricing and tax, if applicable</li>
          </ul>
          <p>
            Once a subscription is successfully purchased, it is considered active and non-transferable.
          </p>

          <h2 className="text-lg font-semibold mt-6">2. Cancellation Policy</h2>
          <p>
            Users may cancel their subscription at any time through their account settings in the SoShoLife app or by contacting our support team.
          </p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Cancellation will stop any auto-renewal (if enabled), but the user will continue to enjoy subscription benefits until the current cycle ends.</li>
            <li>No partial refunds will be issued for unused periods after cancellation unless otherwise specified in writing.</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">3. Refund Policy</h2>
          <p>We strive for transparency and customer satisfaction. However, refunds will only be processed under the following conditions:</p>

          <h3 className="font-semibold">Eligible Refund Scenarios:</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Duplicate payment due to technical issues</li>
            <li>Payment failure where the amount was debited but the subscription was not activated</li>
            <li>Unauthorized transaction, reported within 48 hours of the transaction</li>
            <li>Technical failure preventing access to subscription features within 72 hours of activation</li>
          </ul>

          <p>To request a refund, users must contact us at <strong>support@sosholife.com</strong> with:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>Registered mobile/email</li>
            <li>Transaction reference number</li>
            <li>Brief reason for the refund request</li>
          </ul>

          <p>All eligible refund requests will be verified and processed within 7–10 business days to the original payment method.</p>

          <h2 className="text-lg font-semibold mt-6">4. Non-Refundable Situations</h2>
          <p>We do not offer refunds in the following cases:</p>
          <ul className="list-disc ml-6 space-y-1">
            <li>User simply changes mind after activation</li>
            <li>Reward features were accessed and used</li>
            <li>Subscription benefits are partially used</li>
            <li>Delayed cancellation by user post renewal</li>
            <li>Claims made after the plan validity has expired</li>
          </ul>

          <h2 className="text-lg font-semibold mt-6">5. Grievance & Escalation</h2>
          <p>If you're not satisfied with the resolution of a refund or cancellation issue, you can escalate the matter to our Grievance Officer:</p>
          <p>
            <strong>Grievance Officer:</strong> K Goraksha<br />
            <strong>Email:</strong> grievance@sosholife.com<br />
            {/* <strong>Phone:</strong> 9130736437<br /> */}
            <strong>Address:</strong><br />
            International Tech Park Bangalore<br />
            Whitefield Road,<br />
            Bangalore, Karnataka, India - 560066.
          </p>

          <h2 className="text-lg font-semibold mt-6">6. Policy Changes</h2>
          <p>
            SoShoLife reserves the right to modify this Refund and Cancellation Policy at any time. Updated policies will be posted with the effective date. Continued use of the platform after updates implies acceptance.
          </p>
        </div>
      </div>
    </div>
  );
};

export default RefCancelPolicy;
