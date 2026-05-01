/* global self, clients */

// ─────────────────────────────────────────────────────────────────────────────
// SoShoLife Service Worker — Push & Notification Click Handler
//
// UPGRADE: Every notification shown by this service worker now displays the
// SoShoLife logo as the icon and badge.  The server already injects icon/badge
// into the push payload (see pushService.js), but we set a hard fallback here
// so even legacy payloads that predate the upgrade still show the brand logo.
// ─────────────────────────────────────────────────────────────────────────────

// Fallback logo paths (used when the server payload omits them).
// These must exist at the web root — the public/logo.png already does.
const DEFAULT_ICON  = '/logo.png';
const DEFAULT_BADGE = '/logo.png';
const DEFAULT_IMAGE = '/logo.png';

// ── Push event ────────────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title:   'SoShoLife',
      message: event.data ? event.data.text() : '',
    };
  }

  const title = data.title || 'SoShoLife';

  // Build the notification options, always ensuring the brand logo appears.
  // Server-supplied values (data.icon etc.) take precedence over the fallbacks.
  const options = {
    body:               data.message || '',

    // Brand identity — always present
    icon:               data.icon   || DEFAULT_ICON,
    badge:              data.badge  || DEFAULT_BADGE,
    image:              data.image  || DEFAULT_IMAGE,

    // Deep-link destination
    data:               { url: data.url || '/' },

    // UX settings
    requireInteraction: false,
    vibrate:            [100, 50, 100],

    // Notification grouping — collapse identical alerts on Android
    tag:                data.tag || 'sosholife-notification',
    renotify:           data.renotify || false,

    // Action buttons (if supplied by the server)
    actions:            data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click event ──────────────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification?.data?.url || '/';

  // Handle action button clicks (if any were defined)
  if (event.action) {
    const actionUrl = event.notification?.data?.[`action_${event.action}_url`] || url;
    event.waitUntil(clients.openWindow(actionUrl));
    return;
  }

  // Default click — focus existing tab or open new one
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Prefer an existing tab on the same origin
        for (const client of clientList) {
          const clientUrl = new URL(client.url);
          const targetUrl = new URL(url, self.location.origin);

          if (clientUrl.origin === targetUrl.origin && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }

        // No matching tab found — open a new window
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// ── Push subscription change ──────────────────────────────────────────────────
// Re-subscribe automatically when the browser rotates push credentials.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true })
      .then((subscription) => {
        // POST the new subscription to the backend so it stays current.
        return fetch('/api/push/subscribe', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            endpoint: subscription.endpoint,
            keys: {
              p256dh: btoa(
                String.fromCharCode(
                  ...new Uint8Array(subscription.getKey('p256dh'))
                )
              ),
              auth: btoa(
                String.fromCharCode(
                  ...new Uint8Array(subscription.getKey('auth'))
                )
              ),
            },
          }),
        });
      })
      .catch((err) => {
        console.error('[sw] pushsubscriptionchange re-subscribe failed:', err);
      })
  );
});