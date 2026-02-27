import React from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';

const NotificationPanel = ({ onClose }) => {
  const { notifications, setNotifications, setNotificationCount } = useAuth();

  const clearNotifications = () => {
    setNotifications([]);
    setNotificationCount(0);
    if (onClose) onClose();
  };

  return (
    <div className="fixed right-4 top-20 bg-white shadow-lg rounded-lg p-4 w-80 z-50">
      <div className="flex justify-between items-center border-b pb-2 mb-2">
        <h4 className="text-lg font-semibold">🔔 Notifications</h4>
        <button className="text-sm text-blue-600" onClick={clearNotifications}>
          Clear All
        </button>
      </div>
      <ul className="space-y-2 max-h-64 overflow-y-auto">
        {notifications.length === 0 ? (
          <li className="text-gray-500 text-sm">No new notifications.</li>
        ) : (
          notifications.map((note, index) => (
            <li key={index} className="text-sm text-gray-800 border-b pb-1">
              <strong>{note.type || 'Update'}:</strong> {note.message}
            </li>
          ))
        )}
      </ul>
    </div>
  );
};

export default NotificationPanel;
