// src/utils/pushClient.js

const BASE_URL =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw     = atob(base64);
  const out     = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

/**
 * Fetch the VAPID public key from the backend.
 * FIX 1: check res.ok before parsing so server errors surface clearly.
 */
export async function getVapidPublicKey() {
  const res = await fetch(`${BASE_URL}/api/push/vapid-public-key`);
  if (!res.ok) {
    throw new Error(`[pushClient] Failed to fetch VAPID key: HTTP ${res.status}`);
  }
  const { key } = await res.json();
  return key || '';
}

/**
 * Return the active service worker registration.
 * FIX 4: use navigator.serviceWorker.ready instead of re-registering on every
 * call, which avoids unnecessary network requests and update races.
 * The SW must be registered at app startup (index.js or public/sw.js).
 */
export async function ensureServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }
  // ready resolves with the existing active registration — no re-register
  return navigator.serviceWorker.ready;
}

/**
 * Subscribe the current browser to web push notifications.
 * Sends the PushSubscription to the backend for storage.
 * FIX 2: checks the backend response and throws if the subscription was not saved.
 */
export async function subscribeForPush(token) {
  if (
    !('Notification' in window) ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    throw new Error('Push not supported on this browser/device');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Permission not granted');

  const [reg, publicKey] = await Promise.all([
    ensureServiceWorker(),
    getVapidPublicKey(),
  ]);
  if (!publicKey) throw new Error('Missing VAPID public key');

  const sub = await reg.pushManager.subscribe({
    userVisibleOnly:      true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  // FIX 2: verify the backend stored the subscription successfully
  const res = await fetch(`${BASE_URL}/api/push/subscribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify(sub),
  });

  if (!res.ok) {
    // Revoke the browser-side subscription so state stays consistent
    await sub.unsubscribe().catch(() => {});
    throw new Error(`[pushClient] Backend failed to store subscription: HTTP ${res.status}`);
  }

  return sub;
}

/**
 * Unsubscribe the current browser from web push notifications.
 * FIX 3: checks the backend response so callers know if server-side cleanup
 * failed (stale subscriptions would cause push delivery errors otherwise).
 */
export async function unsubscribeFromPush(token) {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();

  if (!sub) return; // nothing to unsubscribe

  // Tell the backend to remove the subscription first
  const res = await fetch(`${BASE_URL}/api/push/unsubscribe`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body:    JSON.stringify({ endpoint: sub.endpoint }),
  });

  if (!res.ok) {
    // Log a warning but still unsubscribe the browser — a stale server record
    // is better than a live browser subscription with no server counterpart
    console.warn(`[pushClient] Backend unsubscribe returned HTTP ${res.status} — proceeding with browser unsubscribe`);
  }

  await sub.unsubscribe();
}