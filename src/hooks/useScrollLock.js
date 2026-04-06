/**
 * useScrollLock.js  —  Reference-counted scroll-lock hook
 *
 * WHAT CHANGED FROM THE PREVIOUS VERSION AND WHY
 * ────────────────────────────────────────────────
 *
 * Previous version set `document.body.style.position = 'fixed'` to handle
 * iOS Safari rubber-band scrolling.  This caused the scroll-after-close bug:
 *
 *   1. body.position = 'fixed' + body.top = '-Xpx'
 *      → browser paints the page at scroll-position 0 visually.
 *   2. On unlock: body.position = '' is removed first (another paint at 0),
 *      then window.scrollTo(0, savedScrollY) is scheduled — but the browser
 *      has already painted the jump-to-top frame, producing a visible flash.
 *
 * The fix: don't touch body.position at all.  Instead:
 *
 *   • Lock overflow on <html> only (not <body>).  This keeps the scrollbar
 *     gutter visible, avoids layout shift, and doesn't move the page.
 *   • Compensate scrollbar width with paddingRight on <body> so content
 *     doesn't reflow when the scrollbar disappears.
 *   • Use `overscroll-behavior: none` on <html> for iOS Safari — this is
 *     the modern replacement for the position:fixed hack and does NOT cause
 *     scroll-position jumps.
 *   • Scrollbar width is cached after the first measurement (O(1) thereafter)
 *     and measured with position:fixed so the probe element never triggers
 *     a full-page reflow.
 *
 * STACKING GUARANTEE
 * ──────────────────
 * lockCount is a module-level integer shared by all hook instances.  The
 * page only unlocks when the last consumer releases its slot.  Each hook
 * instance tracks its own lock via an isLocked ref so React Strict Mode
 * double-invokes and mid-render re-runs cannot cause double-lock or
 * double-unlock.
 */

import { useEffect, useRef } from 'react';

// ─── Module-level state ───────────────────────────────────────────────────────
let lockCount           = 0;
let savedPaddingRight   = '';
let savedHtmlOverflow   = '';
let savedHtmlOverscroll = '';

// ─── Scrollbar width — measured once, lazily ─────────────────────────────────
let cachedScrollbarWidth = -1;

function getScrollbarWidth() {
  if (cachedScrollbarWidth >= 0) return cachedScrollbarWidth;
  // position:fixed takes the element out of document flow completely —
  // appending/removing it never triggers a full-page layout flush.
  const el = document.createElement('div');
  el.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:100px;overflow:scroll;visibility:hidden;';
  document.body.appendChild(el);
  cachedScrollbarWidth = el.offsetWidth - el.clientWidth;
  document.body.removeChild(el);
  return cachedScrollbarWidth;
}

// ─── Lock / Unlock ───────────────────────────────────────────────────────────

function lockScroll() {
  if (lockCount === 0) {
    const html = document.documentElement;

    // Snapshot before we change anything
    savedPaddingRight   = document.body.style.paddingRight;
    savedHtmlOverflow   = html.style.overflow;
    savedHtmlOverscroll = html.style.overscrollBehavior;

    // Compensate for scrollbar disappearing (Windows / Linux only — macOS
    // overlaid scrollbars have width 0, so this is a safe no-op there).
    const sbw = getScrollbarWidth();
    if (sbw > 0) {
      // Add to any existing paddingRight rather than overwriting it entirely.
      const currentPR = parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPR + sbw}px`;
    }

    // Lock scroll on <html> only.
    // Critically: this does NOT move the page, so there is no scroll-jump
    // on unlock — window.scrollTo() is never needed.
    html.style.overflow = 'hidden';

    // overscroll-behavior:none prevents iOS Safari rubber-band scrolling
    // without the position:fixed trick that caused the scroll-jump bug.
    html.style.overscrollBehavior = 'none';
  }
  lockCount++;
}

function unlockScroll() {
  if (lockCount <= 0) return; // guard against double-unlock
  lockCount--;

  if (lockCount === 0) {
    const html = document.documentElement;

    // Restore everything. No scrollTo() needed — we never repositioned the page.
    html.style.overflow           = savedHtmlOverflow;
    html.style.overscrollBehavior = savedHtmlOverscroll;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * useScrollLock(active)
 *
 * Pass `true` to acquire a scroll lock, `false` to release it.
 * Safe to call from any number of components simultaneously — the page only
 * unlocks once every active consumer has passed `false` or unmounted.
 *
 * @param {boolean} active
 */
export function useScrollLock(active) {
  // isLocked tracks whether THIS hook instance currently holds a lock slot.
  // A ref (not state) so toggling it never triggers a re-render.
  const isLocked = useRef(false);

  useEffect(() => {
    if (active && !isLocked.current) {
      lockScroll();
      isLocked.current = true;
    } else if (!active && isLocked.current) {
      unlockScroll();
      isLocked.current = false;
    }

    // Cleanup: release the lock if the component unmounts while still locked.
    // Covers cases like: PostItem removed from a virtualised list while the
    // Profile Modal is still technically open.
    return () => {
      if (isLocked.current) {
        unlockScroll();
        isLocked.current = false;
      }
    };
  }, [active]);
}

export default useScrollLock;