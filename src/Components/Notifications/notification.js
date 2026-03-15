// src/notification.js
//
// Entry point for rendering <NotificationPopup /> into a standalone DOM node
// (e.g. a sidebar widget or an embedded iframe).
//
// REFACTOR vs original:
//   • Removed the isolated <AuthProvider> wrapper that surrounded
//     <NotificationPopup /> here. That wrapper created a SECOND, isolated
//     AuthContext that had no token, no user, and no socket — causing every
//     API call inside NotificationPopup to fail silently.
//
//   • The correct approach: if this widget lives inside the main app shell
//     (i.e. inside the existing <AuthProvider> + <NotificationProvider> tree),
//     just render <NotificationPopup /> directly — it will consume the shared
//     contexts from the parent tree automatically.
//
//   • If this widget MUST run in a fully isolated page (no parent providers),
//     use the <IsolatedNotificationPopup> export at the bottom, which wraps
//     the full provider stack. Only use that for truly standalone pages.
//
// USAGE — inside main app (most common):
//   The Navbar/App already mounts <NotificationsPanel /> for the full drawer.
//   <NotificationPopup /> is a lighter alternative for embedding as a widget,
//   e.g. inside a profile sidebar or a mini tray:
//
//     // Anywhere inside the existing provider tree:
//     import NotificationPopup from './notification';
//     <NotificationPopup />
//
// USAGE — standalone isolated page:
//   Only if #notification-root is on a page that has NO parent React tree:
//
//     import { mountIsolatedNotificationWidget } from './notification';
//     mountIsolatedNotificationWidget();

import React from 'react';
import { createRoot } from 'react-dom/client';
import NotificationPopup from './NotificationPopup';

// ── Providers needed for an isolated mount ─────────────────────────────────
// These are only imported when mountIsolatedNotificationWidget() is called.
// Normal in-app usage does NOT need them (parent tree already has them).
import { AuthProvider }         from '../../Context/Authorisation/AuthContext';
import { SocketProvider }       from '../../Context/SocketContext';
import { NotificationProvider } from '../../Context/NotificationContext';

// ── Default export: bare <NotificationPopup /> ────────────────────────────
// Use this inside the existing app provider tree.
export default NotificationPopup;

// ── Isolated wrapper (for standalone pages only) ───────────────────────────
/**
 * Wraps NotificationPopup with the full provider stack required to function
 * independently. Use ONLY when mounting outside the main app React tree.
 */
export const IsolatedNotificationWidget = () => (
  <AuthProvider>
    <SocketProvider>
      <NotificationProvider>
        <NotificationPopup />
      </NotificationProvider>
    </SocketProvider>
  </AuthProvider>
);

// ── Mount helper for standalone pages ─────────────────────────────────────
/**
 * Call this from a standalone HTML page that has a <div id="notification-root">
 * but no parent React app.
 *
 * Example:
 *   import { mountIsolatedNotificationWidget } from './notification';
 *   mountIsolatedNotificationWidget();
 *
 * Or in a plain <script> (if bundled):
 *   window.addEventListener('DOMContentLoaded', () => {
 *     mountIsolatedNotificationWidget();
 *   });
 */
export const mountIsolatedNotificationWidget = () => {
  window.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('notification-root');

    if (!container) {
      console.warn(
        '[notification.js] ⚠️ Element with id "notification-root" not found in DOM. ' +
        'Add <div id="notification-root"></div> to your HTML.'
      );
      return;
    }

    const root = createRoot(container);
    root.render(<IsolatedNotificationWidget />);
  });
};