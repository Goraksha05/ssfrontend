const BASE_URL = process.env.REACT_APP_BACKEND_URL || process.env.REACT_APP_SERVER_URL || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

export async function getVapidPublicKey() {
  const res = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
  const { key } = await res.json();
  return key || '';
}

export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker not supported');
  const reg = await navigator.serviceWorker.register('/sw.js'); // ensure registered
  return reg;
}

export async function subscribeForPush(token) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push not supported on this browser/device');
  }

  // Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission not granted');

  const [reg, publicKey] = await Promise.all([ensureServiceWorker(), getVapidPublicKey()]);
  if (!publicKey) throw new Error('Missing VAPID public key');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  await fetch(`${BASE_URL}/api/push/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(sub)
  });

  return sub;
}

export async function unsubscribeFromPush(token) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    await fetch(`${BASE_URL}/api/push/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ endpoint: sub.endpoint })
    });
    await sub.unsubscribe();
  }
}
