/* global self, clients */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Notification', message: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Notification';
  const options = {
    body: data.message || '',
    icon: '/logo.png',
    badge: '/logo.png',
    image: data.image || '/logo.png',
    data: { url: data.url || '/' },
    requireInteraction: false
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true })
    .then((clientList) => {
      // Focus if already open
      for (const client of clientList) {
        if ('focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

            // else open new
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});