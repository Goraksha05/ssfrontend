// src/components/Layout/Header.js
//
// Reads unreadCount from NotificationContext (NOT AuthContext).
// Renders NotificationsPanel (correct import path).

import React, { useState } from 'react';
import { useNotification } from '../../Context/NotificationContext';
import NotificationsPanel from '../NotificationsPanel';

const Header = () => {
  const { unreadCount } = useNotification();
  const [showPanel, setShowPanel] = useState(false);

  return (
    <div className="notifyer justify-items-end">
      <header className="bg-blue-900 text-black shadow-md px-6 flex items-center justify-between relative z-50">
        {/* Left Side: Logo or Title */}

        {/* Right Side: Bell Icon */}
        <div className="relative">
          <button
            data-notification-trigger
            onClick={() => setShowPanel((prev) => !prev)}
            className="relative focus:outline-none"
          >
            <i className="fas fa-bell text-xl"></i>
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Notification Panel — rendered outside the header so it overlays the page */}
      <NotificationsPanel
        show={showPanel}
        onClose={() => setShowPanel(false)}
      />
    </div>
  );
};

export default Header;