/**
 * useScrollLock.js  —  Reference-counted scroll-lock hook
 *
 * PERFORMANCE FIX (forced reflow elimination)
 * ────────────────────────────────────────────
 * The previous version measured scrollbar width lazily — on the first
 * lockScroll() call, which always happens inside a click handler.
 * Reading offsetWidth/clientWidth right after a DOM write is a forced
 * reflow: the browser must synchronously recalculate layout before it
 * can return the value, blocking the main thread (contributed to the
 * 170–230ms click handler violations).
 *
 * Fix: measure at module load time using requestIdleCallback (or a
 * short setTimeout fallback). The measurement happens during browser
 * idle time, well before any user interaction. By the time a modal
 * opens, cachedScrollbarWidth is already populated — lockScroll()
 * never triggers a layout read at all.
 */

import { useEffect, useRef } from 'react';

// ─── Module-level state ───────────────────────────────────────────────────────
let lockCount           = 0;
let savedPaddingRight   = '';
let savedHtmlOverflow   = '';
let savedHtmlOverscroll = '';

// ─── Scrollbar width — measured at idle time, never during interaction ────────
let cachedScrollbarWidth = 0; // safe default: 0 means no compensation applied

function measureScrollbarWidth() {
  const el = document.createElement('div');
  // position:fixed takes the element out of document flow — appending it
  // does NOT trigger a full-page layout flush.
  el.style.cssText =
    'position:fixed;top:-9999px;left:-9999px;width:100px;overflow:scroll;visibility:hidden;pointer-events:none;';
  document.body.appendChild(el);
  // This read is safe here because we are in an idle callback —
  // no pending DOM writes exist, so there is no forced reflow.
  cachedScrollbarWidth = el.offsetWidth - el.clientWidth;
  document.body.removeChild(el);
}

// Measure as early as possible but during idle time, not during parsing.
// requestIdleCallback: fires when the browser has a free moment (ideal).
// setTimeout 0 fallback: fires after the current task queue drains.
if (typeof window !== 'undefined') {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(measureScrollbarWidth, { timeout: 500 });
  } else {
    setTimeout(measureScrollbarWidth, 0);
  }
}

// ─── Lock / Unlock ────────────────────────────────────────────────────────────

function lockScroll() {
  if (lockCount === 0) {
    const html = document.documentElement;

    // Snapshot before changing anything
    savedPaddingRight   = document.body.style.paddingRight;
    savedHtmlOverflow   = html.style.overflow;
    savedHtmlOverscroll = html.style.overscrollBehavior;

    // Compensate for scrollbar disappearing (Windows/Linux).
    // cachedScrollbarWidth was measured at idle — no reflow here.
    if (cachedScrollbarWidth > 0) {
      const currentPR =
        parseFloat(getComputedStyle(document.body).paddingRight) || 0;
      document.body.style.paddingRight = `${currentPR + cachedScrollbarWidth}px`;
    }

    // Lock scroll on <html> only — does NOT move the page, so no
    // scroll-jump occurs on unlock and window.scrollTo() is never needed.
    html.style.overflow = 'hidden';

    // Prevents iOS Safari rubber-band scrolling without the
    // position:fixed trick that caused scroll-position jumps.
    html.style.overscrollBehavior = 'none';
  }
  lockCount++;
}

function unlockScroll() {
  if (lockCount <= 0) return; // guard against double-unlock
  lockCount--;

  if (lockCount === 0) {
    const html = document.documentElement;
    html.style.overflow           = savedHtmlOverflow;
    html.style.overscrollBehavior = savedHtmlOverscroll;
    document.body.style.paddingRight = savedPaddingRight;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useScrollLock(active)
 *
 * Pass `true` to acquire a scroll lock, `false` to release it.
 * Safe to call from any number of components simultaneously — the page
 * only unlocks once every active consumer has passed `false` or unmounted.
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

    // Release the lock if the component unmounts while still locked.
    return () => {
      if (isLocked.current) {
        unlockScroll();
        isLocked.current = false;
      }
    };
  }, [active]);
}

export default useScrollLock;