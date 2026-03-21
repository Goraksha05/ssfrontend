// utils/behaviorSDK.js
// Lightweight behavioral signal collector for the SoShoLife React frontend.
// Runs in requestIdleCallback to never block the UI thread.
// Batches signals and flushes every 15 seconds or 30 signals, whichever comes first.
//
// Usage in App.js:
//   import { startBehaviorSDK, stopBehaviorSDK } from './utils/behaviorSDK';
//   useEffect(() => {
//     if (user) {
//       const session = startBehaviorSDK(wsClient);
//       return () => stopBehaviorSDK(session);
//     }
//   }, [user?._id]);

const FLUSH_INTERVAL_MS = 15_000;
const FLUSH_BATCH_SIZE = 30;
const API_ENDPOINT = '/api/trust/signal';
const FP_ENDPOINT = '/api/trust/fingerprint';

// ── Session ID (ephemeral, not stored) ────────────────────────────────────────
function generateSessionId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ── Batch queue ────────────────────────────────────────────────────────────────
function createQueue(sessionId, wsClient) {
    const queue = [];
    let flushTimer = null;
    let isFlushing = false;

    function getToken() {
        return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    }

    function emitViaSocket(batch) {
        try {
            if (wsClient && wsClient.connected) {
                wsClient.emit('behavior_batch', batch);
                return true;
            }
        } catch (_) { }
        return false;
    }

    async function flushHTTP(batch, token) {
        try {
            fetch(API_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'auth-token': token },
                body: JSON.stringify(batch),
                keepalive: true,
            }).catch(() => { });
        } catch (_) { }
    }

    async function flush() {
        if (typeof isFlushing === 'undefined') return;
        if (queue.length === 0 || isFlushing) return;
        isFlushing = true;

        const batch = queue.splice(0, FLUSH_BATCH_SIZE);
        const token = getToken();
        if (!token) return;  // User logged out

        const sentViaSocket = emitViaSocket(batch);

        if (!sentViaSocket) {
            await flushHTTP(batch, token);
        }

        isFlushing = false;

        // Fire-and-forget — don't await, don't block anything
        try {
            for (const signal of batch) {
                fetch(API_ENDPOINT, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'auth-token': token },
                    body: JSON.stringify(signal),
                    keepalive: true,  // Survives page unload
                }).catch(() => { });  // Swallow all errors silently
            }
        } catch (_) { }
    }

    function scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setInterval(() => {
            if (document.visibilityState === 'hidden') return; // throttle background tabs

            if ('requestIdleCallback' in window) {
                requestIdleCallback(() => flush(), { timeout: 2000 });
            } else {
                flush();
            }
        }, FLUSH_INTERVAL_MS);
    }

    function push(signalType, payload) {
        queue.push({ signalType, payload, clientTimestamp: Date.now(), sessionId });
        if (queue.length >= FLUSH_BATCH_SIZE) flush();
    }

    function stop() {
        clearInterval(flushTimer);
        flushTimer = null;
        flush();  // Flush remaining on stop
    }

    scheduleFlush();
    return { push, stop, flush };
}

// ── Signal collectors ─────────────────────────────────────────────────────────

function setupTypingCollector(queue) {
    let typingStart = null;
    let charCount = 0;
    const inputs = ['INPUT', 'TEXTAREA'];

    const onKeydown = (e) => {
        if (!inputs.includes(e.target?.tagName)) return;
        if (!typingStart) { typingStart = Date.now(); charCount = 0; }
        charCount++;
    };

    const onKeyup = (e) => {
        if (!inputs.includes(e.target?.tagName)) return;
        if (typingStart && charCount >= 5) {
            const duration_ms = Date.now() - typingStart;
            const wpm = duration_ms > 0 ? (charCount / 5) / (duration_ms / 60_000) : 0;
            queue.push('typing_burst', { chars: charCount, duration_ms, wpm: Math.round(wpm) });
        }
        typingStart = null;
        charCount = 0;
    };

    document.addEventListener('keydown', onKeydown, { passive: true });
    document.addEventListener('keyup', onKeyup, { passive: true });
    return () => {
        document.removeEventListener('keydown', onKeydown);
        document.removeEventListener('keyup', onKeyup);
    };
}

function setupClickCollector(queue) {
    let lastClick = null;

    const onClick = (e) => {
        const now = Date.now();
        const interval_ms_since_last = lastClick ? now - lastClick : null;
        const target_type = e.target?.tagName?.toLowerCase() || 'unknown';
        if (interval_ms_since_last !== null) {
            queue.push('click_event', { interval_ms_since_last, target_type });
        }
        lastClick = now;
    };

    document.addEventListener('click', onClick, { passive: true });
    return () => document.removeEventListener('click', onClick);
}

function setupScrollCollector(queue) {
    let lastScroll = null;
    let ticking = false;

    const onScroll = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const now = Date.now();
            const delta_y = window.scrollY;
            const interval_ms_since_last = lastScroll ? now - lastScroll : null;
            if (interval_ms_since_last !== null && interval_ms_since_last < 5000) {
                queue.push('scroll_event', { delta_y, interval_ms_since_last });
            }
            lastScroll = now;
            ticking = false;
        });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
}

function setupNavigationCollector(queue) {
    let lastPage = window.location.pathname;

    const onPopState = () => {
        const newPage = window.location.pathname;
        queue.push('navigation', { from_page: lastPage, to_page: newPage, method: 'back' });
        lastPage = newPage;
    };

    // Intercept React Router navigation by watching pathname changes via MutationObserver
    // This is framework-agnostic — no React Router import needed
    let urlObserver = null;
    if (typeof MutationObserver !== 'undefined') {
        urlObserver = setInterval(() => {
            if (window.location.pathname !== lastPage) {
                const newPage = window.location.pathname;
                queue.push('navigation', { from_page: lastPage, to_page: newPage, method: 'click' });
                lastPage = newPage;
            }
        }, 500);
    }

    window.addEventListener('popstate', onPopState);
    return () => {
        window.removeEventListener('popstate', onPopState);
        if (urlObserver) clearInterval(urlObserver);
    };
}

function setupSessionTracking(queue, sessionId) {
    const startTime = Date.now();
    let pageCount = 0;

    // Session start signal
    queue.push('session_start', {
        referrer: document.referrer || null,
        userAgent: navigator.userAgent,
        sessionId,
    });
    pageCount++;

    const onPageChange = () => pageCount++;
    window.addEventListener('popstate', onPageChange, { passive: true });

    // Session end on unload
    const onUnload = () => {
        const duration_ms = Date.now() - startTime;
        navigator.sendBeacon(
            API_ENDPOINT,
            JSON.stringify({
                signalType: 'session_end',
                payload: { duration_ms, page_count: pageCount },
                clientTimestamp: Date.now(),
                sessionId,
            })
        );
    };

    window.addEventListener('beforeunload', onUnload);
    return () => {
        window.removeEventListener('beforeunload', onUnload);
        window.removeEventListener('popstate', onPageChange);
    };
}

// ── Device fingerprint registration ───────────────────────────────────────────
async function registerFingerprint() {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
    if (!token) return null;

    // Collect device signals
    let gpuRenderer = '';
    let gpuVendor = '';
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        if (gl) {
            const dbgExt = gl.getExtension('WEBGL_debug_renderer_info');
            if (dbgExt) {
                gpuRenderer = gl.getParameter(dbgExt.UNMASKED_RENDERER_WEBGL) || '';
                gpuVendor = gl.getParameter(dbgExt.UNMASKED_VENDOR_WEBGL) || '';
            }
        }
    } catch (_) { }

    const signals = {
        userAgent: navigator.userAgent,
        screenRes: `${window.window.screen.width}x${window.window.screen.height}`,
        colorDepth: window.window.screen.colorDepth,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        languages: Array.from(navigator.languages || [navigator.language]),
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        gpuRenderer,
        gpuVendor,
        touchSupport: 'ontouchstart' in window,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemory: navigator.deviceMemory || null,
    };

    try {
        const resp = await fetch(FP_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'auth-token': token },
            body: JSON.stringify(signals),
        });
        const data = await resp.json();
        if (data.fpHash) {
            sessionStorage.setItem('fpHash', data.fpHash);
            return data.fpHash;
        }
    } catch (_) { }

    return null;
}

// ── Public API ─────────────────────────────────────────────────────────────────
/**
 * Start collecting behavioral signals. Call once after user logs in.
 * @returns {object} session handle — pass to stopBehaviorSDK() on logout.
 */
export function startBehaviorSDK(wsClient) {
    const sessionId = generateSessionId();
    const queue = createQueue(sessionId, wsClient);

    // Register device fingerprint asynchronously
    registerFingerprint().catch(() => { });

    // Set up all collectors
    const cleanups = [
        setupTypingCollector(queue),
        setupClickCollector(queue),
        setupScrollCollector(queue),
        setupNavigationCollector(queue),
        setupSessionTracking(queue, sessionId),
    ];

    return { queue, cleanups, sessionId };
}

/**
 * Stop collecting and flush remaining signals.
 * @param {object} session  Handle returned by startBehaviorSDK()
 */
export function stopBehaviorSDK(session) {
    if (!session) return;
    session.cleanups?.forEach(fn => fn?.());
    session.queue?.stop();
}

/**
 * Emit a manual signal (e.g. when a post is created or referral sent).
 * @param {object} session  Handle from startBehaviorSDK()
 * @param {string} type     Signal type
 * @param {object} payload  Signal data
 */
export function emitSignal(session, type, payload) {
    session?.queue?.push(type, payload);
}