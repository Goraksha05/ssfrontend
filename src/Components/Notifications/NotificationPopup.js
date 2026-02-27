import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import apiRequest from '../../utils/apiRequest';

const NotificationPopup = () => {
  const { notifications, setNotifications, setNotificationCount, user } = useAuth();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchNotifications = useCallback(async (page = 1) => {
    if (!user) return;

    try {
      const res = await apiRequest.get(`/api/notifications?page=${page}&limit=10`)
      // ,{
      //   headers: {
      //     Authorization: `Bearer ${token}`
      //   }
      // });
      setNotifications(res.data.data || []);
      setTotalPages(res.data.totalPages || 1);
    } catch (err) {
      console.error('Notification fetch failed:', err?.response?.status, err?.message);
    }
  }, [setNotifications, user]);

  const clearAll = () => {
    setNotifications([]);
    setNotificationCount(0);
  };

  useEffect(() => {
    if (user) fetchNotifications(page);
  }, [fetchNotifications, page, user]);

  return (
    <div className="p-4 w-full h-full bg-white overflow-auto font-sans">
      <div className="flex justify-between items-center border-b pb-2 mb-4">
        <h2 className="text-lg font-semibold">🔔 Notifications</h2>
        <button
          onClick={clearAll}
          className="text-sm text-blue-600 hover:underline"
        >
          Mark all as seen
        </button>
      </div>
      <ul className="space-y-3">
        {notifications.map((note, index) => (
          <li key={index} className="bg-gray-100 p-2 rounded shadow-sm text-sm text-gray-800">
            <strong>{note.type}:</strong> {note.message}
          </li>
        ))}
      </ul>

      <div className="flex justify-between mt-4">
        <button disabled={page === 1} onClick={() => setPage(p => Math.max(p - 1, 1))}>⬅ Prev</button>
        <span>Page {page} / {totalPages}</span>
        <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(p + 1, totalPages))}>Next ➡</button>
      </div>
    </div>
  );
};

export default NotificationPopup;
