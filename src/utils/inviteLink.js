// src/utils/inviteLink.js
// ─────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for referral / invite link construction.
//
// Every part of the app that needs to build, parse, or validate an invite link
// must go through this module.  Never construct the URL ad-hoc elsewhere.
//
// URL format (canonical):
//   https://<origin>/signup?ref=<REFERRAL_ID>
//
// Legacy format still supported for inbound links (read-only):
//   https://<origin>/?ref=<REFERRAL_ID>   → normalised on arrival by App.js
// ─────────────────────────────────────────────────────────────────────────────

const FRONTEND_URL =
  (typeof process !== 'undefined' && process.env?.REACT_APP_FRONTEND_URL) ||
  (typeof window  !== 'undefined' ? window.location.origin : '');

// ── Build ─────────────────────────────────────────────────────────────────────

/**
 * Build the canonical signup invite URL for a given referral ID.
 *
 * @param   {string} referralId   e.g. "VK690587"
 * @returns {string}              e.g. "https://app.sosholife.com/signup?ref=VK690587"
 *                                Returns '' when referralId is falsy.
 */
export function buildInviteLink(referralId) {
  if (!referralId) return '';
  const id = String(referralId).trim().toUpperCase();
  return `${FRONTEND_URL}/signup?ref=${encodeURIComponent(id)}`;
}

// ── Parse ─────────────────────────────────────────────────────────────────────

/**
 * Extract and normalise the referral ID from any URLSearchParams object.
 * Handles both ?ref=VK690587 and ?ref=vk690587 (lowercased by some mailers).
 *
 * @param   {URLSearchParams} params
 * @returns {string}  Upper-cased referral ID, or '' if not present.
 */
export function parseRefParam(params) {
  return (params.get('ref') || '').trim().toUpperCase();
}

// ── Validate (lightweight, client-side only) ──────────────────────────────────

/**
 * Returns true when the string looks like a well-formed referral ID.
 * The actual existence check happens server-side at signup time.
 *
 * Current format: 2 uppercase letters + 6 digits  e.g. "VK690587"
 * Adjust the regex if the server-side format ever changes.
 *
 * @param   {string} id
 * @returns {boolean}
 */
export function isValidReferralIdFormat(id) {
  return /^[A-Z]{2}\d{6}$/.test(String(id || '').trim().toUpperCase());
}

// ── Share text helpers ────────────────────────────────────────────────────────

/**
 * Returns a ready-to-share text message containing the invite link.
 *
 * @param   {string} inviteLink
 * @param   {string} [senderName]  Optional: personalise with the referrer's name.
 * @returns {string}
 */
export function buildShareText(inviteLink, senderName) {
  const who = senderName ? `${senderName} has` : "I've";
  return (
    `🎉 ${who} invited you to join SoShoLife — the social platform that gives you ` +
    `Recognition & Financial Freedom!\n\nUse my personal invite link to sign up:\n${inviteLink}`
  );
}

// ── Clipboard helper ──────────────────────────────────────────────────────────

/**
 * Copy `text` to the clipboard. Returns a promise that resolves to true on
 * success or false on failure (e.g. browser denied permission).
 *
 * @param   {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers / iOS WebView
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.position = 'fixed';
      el.style.opacity  = '0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(el);
      return ok;
    } catch {
      return false;
    }
  }
}

// ── Native share ──────────────────────────────────────────────────────────────

/**
 * Trigger the Web Share API if available.
 * Resolves to 'shared' | 'cancelled' | 'unsupported'.
 *
 * @param   {string} inviteLink
 * @param   {string} [senderName]
 * @returns {Promise<'shared'|'cancelled'|'unsupported'>}
 */
export async function nativeShare(inviteLink, senderName) {
  if (!navigator.share) return 'unsupported';
  try {
    await navigator.share({
      title: 'Join me on SoShoLife',
      text:  buildShareText(inviteLink, senderName),
      url:   inviteLink,
    });
    return 'shared';
  } catch (err) {
    // AbortError → user dismissed the sheet
    if (err?.name === 'AbortError') return 'cancelled';
    throw err;
  }
}

// ── Platform share URLs ───────────────────────────────────────────────────────

/**
 * Returns a map of platform → ready-to-open share URL.
 * All values are strings; open with window.open(url, '_blank').
 *
 * @param   {string} inviteLink
 * @param   {string} [senderName]
 * @returns {Record<string, string>}
 */
export function getPlatformShareUrls(inviteLink, senderName) {
  const encoded = encodeURIComponent(inviteLink);
  const text    = encodeURIComponent(buildShareText(inviteLink, senderName));

  return {
    whatsapp:  `https://wa.me/?text=${text}`,
    facebook:  `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
    telegram:  `https://t.me/share/url?url=${encoded}&text=${encodeURIComponent('Join me on SoShoLife 🎉')}`,
    twitter:   `https://twitter.com/intent/tweet?url=${encoded}&text=${encodeURIComponent('Join me on SoShoLife — Recognition & Financial Freedom!')}`,
    linkedin:  `https://www.linkedin.com/sharing/share-offsite/?url=${encoded}`,
    email:     `mailto:?subject=${encodeURIComponent('You are invited to SoShoLife!')}&body=${text}`,
    sms:       `sms:?body=${text}`,
  };
}