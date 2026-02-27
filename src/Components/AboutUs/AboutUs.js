import React from 'react';

const AboutUs = () => {
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 overflow-y-auto px-4 sm:px-6 py-8">
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">About Us</h1>

        <div className="text-gray-800 space-y-5 text-sm sm:text-base leading-relaxed">
          <p><strong>Welcome to SoShoLife – Where Social Meets Smart Earning.</strong></p>

          <p>
            At <strong>SoShoLife</strong>, we believe in building a digital ecosystem where social connection and personal growth go hand in hand. Designed with simplicity and purpose, SoShoLife empowers individuals to stay connected with friends, express themselves freely, and earn exciting rewards for everyday activities.
          </p>

          <p><strong>Founded in India, SoShoLife is more than just a social platform.</strong> It’s a space where users can:</p>

          <ul className="list-disc ml-6 space-y-1">
            <li><strong>Connect & Communicate:</strong> Send friend requests, chat, and build your digital community.</li>
            <li><strong>Earn Through Activity:</strong> Get rewarded for daily streaks, posting content, and inviting friends.</li>
            <li><strong>Grow With Referrals:</strong> Share your referral code and unlock milestones to earn cash and benefits.</li>
            <li><strong>Stay Secure:</strong> We use OTP-based login and encrypted authentication for user protection.</li>
            <li><strong>Access Subscriptions & Perks:</strong> Enjoy exclusive features and rewards via our simple subscription plans.</li>
          </ul>

          <p>
            We aim to make every social interaction meaningful, fun, and rewarding. Whether you're sharing moments or growing your network, SoShoLife ensures that your time online adds value to your life.
          </p>

          <p><strong>Join the SoShoLife movement — Because your social life should give back.</strong></p>

          <h2 className="text-lg font-semibold mt-6">Our Mission</h2>
          <p>
            SoShoLife is a next-generation social engagement platform that blends community, creativity, and rewards. Built with a mission to turn everyday social activity into tangible value, SoShoLife enables users to connect, post, refer, and earn — all within a secure, intuitive ecosystem.
          </p>

          <p>
            Whether it’s inviting friends, maintaining daily streaks, or simply sharing a post, users are rewarded for staying active. With robust referral systems, milestone-based rewards, and subscription benefits, SoShoLife redefines what it means to be social in the digital era.
          </p>

          <h2 className="text-lg font-semibold mt-6">Platform Highlights</h2>
          <ul className="list-disc ml-6 space-y-1">
            <li>🔐 <strong>Secure Authentication:</strong> OTP + Token-based login</li>
            <li>🏆 <strong>Reward Milestones:</strong> Streaks, Posts, Referrals</li>
            <li>🤝 <strong>Friendship & Networking Tools</strong></li>
            <li>💳 <strong>Subscription Access:</strong> Premium perks and exclusive features</li>
            <li>📈 <strong>Scalable Ecosystem:</strong> Built for the growing creator economy</li>
          </ul>

          <p className="font-semibold mt-4">
            SoShoLife isn’t just social media.<br />
            It’s a reward-driven digital lifestyle platform designed for the next billion users.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AboutUs;
