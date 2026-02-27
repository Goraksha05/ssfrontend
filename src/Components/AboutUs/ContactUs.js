import React from 'react';

const ContactUs = () => {
  return (
    <div className="fixed inset-0 z-40 bg-gray-50 overflow-y-auto px-4 sm:px-6 py-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl p-6 sm:p-10">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6 text-center">Contact Us</h1>

        <div className="text-gray-800 space-y-5 text-sm sm:text-base leading-relaxed text-center">
          <p>
            We'd love to hear from you! Whether you have a question, suggestion, or need help, our team is always ready to assist.
          </p>

          <div className="space-y-2">
            <p>
              <strong>Email:</strong>{' '}
              <a href="mailto:admin@sosholife.com" className="text-blue-600 underline">
                admin@sosholife.com
              </a>
            </p>
            <p>
              <strong>Phone:</strong>{' '}
              <a href="tel:7249157446" className="text-blue-600 underline">
                7249157446
              </a>
            </p>
          </div>

          <p>
            Support hours: <strong>Mon – Sat, 10:00 AM – 6:00 PM IST</strong>
          </p>

          <p>
            You can also connect with us via social media or directly within the SoShoLife app through the help center.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactUs;
