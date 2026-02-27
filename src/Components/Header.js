// components/Layout/Header.js
import React, { useState } from 'react';
import { useAuth } from '../Context/Authorisation/AuthContext';
import NotificationPanel from './Notifications/NotificationPanel'; // Adjust if path differs

const Header = () => {
  const { notificationCount } = useAuth();
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className='notifyer justify-items-end'>
      <header className="bg-blue-900 text-black shadow-md px-6 flex items-center justify-between relative z-50">
        {/* Left Side: Logo or Title */}
        {/* Right Side: Bell Icon */}
        <div className="relative">
          <button
            onClick={() => setShowPanel(prev => !prev)}
            className="relative focus:outline-none"
          >
            <i className="fas fa-bell text-xl"></i>
            {notificationCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">
                {notificationCount}
              </span>
            )}
          </button>

          {/* Notification Panel - Floating */}
          {showPanel && (
          <div className="fixed top-0 right-0 w-80 h-full bg-white shadow-lg z-50 transition-transform duration-300 ease-in-out">
            <NotificationPanel onClose={() => setShowPanel(false)} />
          </div>
          )}
        </div>
      </header>
    </div>
  );
};

export default Header;
