// src/notification.js
import React from 'react';
import { createRoot } from 'react-dom/client';
import NotificationPopup from './NotificationPopup';
import { AuthProvider } from '../../Context/Authorisation/AuthContext';

window.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('notification-root');
  if (container) {
    const root = createRoot(container);
    root.render(
      <AuthProvider>
        <NotificationPopup />
      </AuthProvider>
    );
  } else {
    console.warn('⚠️ Element with id "notification-root" not found in DOM.');
  }
});