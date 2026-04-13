/**
 * utils/CropModal.js — Render-optimised
 *
 * OPTIMISATIONS (this pass):
 *
 *  1.  <style>{MODAL_CSS}</style> extracted as a module-scope constant element.
 *      Previously the entire MODAL_CSS string was parsed into a new <style>
 *      React element on every render. As a module-scope constant it is created
 *      once and reused; React's reconciler sees the same reference and skips
 *      the DOM patch entirely after the first mount.
 *
 *  2.  ASPECT_OPTIONS buttons — onClick handlers stabilised.
 *      Previously `() => setAspect(opt.value)` created a new function for
 *      every aspect-ratio button on every render. The handlers are now built
 *      once via a module-scope lookup map (ASPECT_HANDLERS) keyed by
 *      opt.label, so the aspect-ratio button list never allocates new closures
 *      during renders triggered by zoom, crop-position, or rotation changes.
 *
 *  3.  zoomPct computation moved into render but derived purely from zoom prop.
 *      No change needed — it was already a cheap inline expression with no
 *      allocation. Kept as-is and documented.
 *
 *  4.  Zoom onChange — useCallback-wrapped handler.
 *      `(e) => setZoom(Number(e.target.value))` was a new arrow on every render.
 *      Wrapped in useCallback([setZoom]) — setZoom is stable so the result is
 *      a single allocation for the component lifetime.
 *
 *  5.  onClose / onApply / setCrop / setZoom are props or stable state
 *      setters — no additional memoisation needed, but documented to confirm.
 *
 *  6.  Two separate useEffect hooks for aspect/rotation reset on new image
 *      combined into one effect.
 *      Both fired on [image] change; combining them halves the number of
 *      effect subscriptions and avoids two sequential synchronous state
 *      updates (which would have caused two re-renders in React 17 and below,
 *      and are batched in React 18 — but a single effect is cleaner).
 *
 *  7.  Focus-trap effect: raf handle typed as a number ref (useRef(0)) rather
 *      than an untyped ref, and cancelAnimationFrame called in cleanup.
 *      Previously the raf handle from requestAnimationFrame was never cancelled
 *      on cleanup, so if the image prop changed rapidly (user switches image
 *      while modal is open) the stale raf could fire and attempt to focus a
 *      now-replaced firstFocRef target.
 *
 *  8.  rotateLeft / rotateRight already use useCallback([]) — no change.
 *      handleReset already uses useCallback — verified deps are correct.
 */

import React, {
  useEffect, useState, useCallback, useRef, useId,
} from 'react';
import Cropper from 'react-easy-crop';
import PropTypes from 'prop-types';

// ── Scroll-lock ref counter ────────────────────────────────────────────────────
let _scrollLockCount = 0;
function lockScroll() {
  _scrollLockCount++;
  if (_scrollLockCount === 1) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1);
  if (_scrollLockCount === 0) document.body.style.overflow = '';
}

// ── Aspect ratio options ───────────────────────────────────────────────────────
const ASPECT_OPTIONS = [
  { label: '1 : 1',    value: 1,       ariaLabel: 'Square'              },
  { label: '4 : 3',    value: 4 / 3,   ariaLabel: 'Four by three'       },
  { label: '3 : 2',    value: 3 / 2,   ariaLabel: 'Three by two'        },
  { label: '16 : 9',   value: 16 / 9,  ariaLabel: 'Sixteen by nine'     },
  { label: '21 : 9',   value: 21 / 9,  ariaLabel: 'Ultra wide'          },
  { label: '3 : 4',    value: 3 / 4,   ariaLabel: 'Three by four'       },
  { label: '2 : 3',    value: 2 / 3,   ariaLabel: 'Two by three'        },
  { label: '9 : 16',   value: 9 / 16,  ariaLabel: 'Vertical video'      },
  { label: '4 : 5',    value: 4 / 5,   ariaLabel: 'Instagram portrait'  },
  { label: '1.91 : 1', value: 1.91,    ariaLabel: 'Facebook cover'      },
  { label: '2 : 1',    value: 2,       ariaLabel: 'Panorama'            },
  { label: '2.35 : 1', value: 2.35,    ariaLabel: 'Cinematic widescreen'},
  { label: 'Free',     value: undefined,ariaLabel: 'Free form'          },
];

// ── Self-contained styles ──────────────────────────────────────────────────────
const MODAL_CSS = `
  .cm-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(2, 6, 16, 0.82);
    z-index: 1100;
    backdrop-filter: blur(3px);
  }

  .cm-modal {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1101;
    background: #0a0f1a;
    border: 1px solid #1e2d45;
    border-radius: 18px;
    width: min(520px, calc(100vw - 24px));
    max-height: min(92vh, 760px);
    display: flex;
    flex-direction: column;
    font-family: 'Sora', system-ui, sans-serif;
    color: #e2eaf5;
    overflow: hidden;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.7);
  }

  /* ── Header ── */
  .cm-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    border-bottom: 1px solid #1a2a40;
    flex-shrink: 0;
  }
  .cm-title {
    font-size: 1rem;
    font-weight: 700;
    color: #e2eaf5;
    margin: 0;
    line-height: 1;
  }
  .cm-close-btn {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: transparent;
    border: 1px solid #1e3050;
    color: #4a6280;
    cursor: pointer;
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .cm-close-btn:hover { border-color: #ef4444; color: #ef4444; }
  .cm-close-btn:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 2px;
  }

  /* ── Cropper area ── */
  .cm-cropper-wrap {
    position: relative;
    height: clamp(220px, 50vh, 400px);
    background: #050c1c;
    flex-shrink: 0;
    overflow: hidden;
  }

  /* ── Controls ── */
  .cm-controls {
    padding: 14px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    border-bottom: 1px solid #1a2a40;
    flex-shrink: 0;
  }
  .cm-control-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .cm-control-row--aspect { align-items: flex-start; }
  .cm-control-label {
    font-size: 0.72rem;
    font-weight: 700;
    color: #4a6280;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    min-width: 60px;
    flex-shrink: 0;
  }

  /* Rotation */
  .cm-rotate-group {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cm-rotate-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: #0c1525;
    border: 1px solid #1e3050;
    color: #8cb4d8;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
    flex-shrink: 0;
  }
  .cm-rotate-btn:hover { background: #0f1e36; border-color: #3b6ea8; color: #60a5fa; }
  .cm-rotate-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }
  .cm-rotation-val {
    font-size: 0.75rem;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    color: #6090b0;
    min-width: 34px;
    text-align: center;
  }

  /* Zoom */
  .cm-zoom-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex: 1;
  }
  .cm-range {
    flex: 1;
    height: 4px;
    appearance: none;
    -webkit-appearance: none;
    background: linear-gradient(
      to right,
      #3b82f6 0%,
      #3b82f6 calc((var(--zoom-pct, 0)) * 1%),
      #1e3050 calc((var(--zoom-pct, 0)) * 1%),
      #1e3050 100%
    );
    border-radius: 99px;
    cursor: pointer;
    outline: none;
  }
  .cm-range::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2px solid #0a0f1a;
    cursor: pointer;
    box-shadow: 0 0 0 2px #1e3a5f;
  }
  .cm-range::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #60a5fa;
    border: 2px solid #0a0f1a;
    cursor: pointer;
  }
  .cm-range:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 4px;
  }
  .cm-zoom-val {
    font-size: 0.72rem;
    font-family: 'JetBrains Mono', 'Courier New', monospace;
    color: #6090b0;
    min-width: 34px;
    text-align: right;
  }

  /* Aspect */
  .cm-aspect-group {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .cm-aspect-btn {
    padding: 5px 12px;
    border-radius: 7px;
    border: 1px solid #1e3050;
    background: #0c1525;
    color: #4a6280;
    font-size: 0.7rem;
    font-weight: 600;
    font-family: 'Sora', system-ui, sans-serif;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .cm-aspect-btn:hover { border-color: #3b6ea8; color: #8cb4d8; background: #0f1e36; }
  .cm-aspect-btn--active {
    border-color: #3b82f6;
    background: #0f1f3d;
    color: #60a5fa;
  }
  .cm-aspect-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

  /* ── Footer ── */
  .cm-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 20px;
    flex-shrink: 0;
    gap: 10px;
  }
  .cm-footer-actions {
    display: flex;
    gap: 8px;
  }

  .cm-reset-btn {
    background: transparent;
    border: 1px solid #1e3050;
    color: #4a6280;
    font-size: 0.78rem;
    font-weight: 600;
    font-family: 'Sora', system-ui, sans-serif;
    padding: 8px 14px;
    border-radius: 9px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .cm-reset-btn:hover { border-color: #3b6ea8; color: #8cb4d8; }
  .cm-reset-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

  .cm-cancel-btn {
    background: transparent;
    border: 1px solid #1e3050;
    color: #8cb4d8;
    font-size: 0.82rem;
    font-weight: 600;
    font-family: 'Sora', system-ui, sans-serif;
    padding: 9px 18px;
    border-radius: 10px;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s;
  }
  .cm-cancel-btn:hover { border-color: #3b6ea8; }
  .cm-cancel-btn:focus-visible { outline: 2px solid #3b82f6; outline-offset: 2px; }

  .cm-apply-btn {
    background: linear-gradient(135deg, #1a4a8a, #1e5fa8);
    border: none;
    color: #e0f0ff;
    font-size: 0.82rem;
    font-weight: 700;
    font-family: 'Sora', system-ui, sans-serif;
    padding: 9px 20px;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.15s, transform 0.1s, opacity 0.15s;
    box-shadow: 0 3px 12px rgba(30, 95, 168, 0.3);
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 110px;
    justify-content: center;
  }
  .cm-apply-btn:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e5aa8, #2570c8);
    transform: translateY(-1px);
  }
  .cm-apply-btn:focus-visible { outline: 2px solid #60a5fa; outline-offset: 2px; }
  .cm-apply-btn:disabled { opacity: 0.65; cursor: not-allowed; transform: none; }

  .cm-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255,255,255,0.25);
    border-top-color: #fff;
    border-radius: 50%;
    animation: cm-spin 0.7s linear infinite;
    flex-shrink: 0;
  }
  @keyframes cm-spin { to { transform: rotate(360deg); } }

  @media (max-width: 540px) {
    .cm-modal {
      top: auto;
      bottom: 0;
      left: 0;
      transform: none;
      width: 100%;
      max-width: 100%;
      border-radius: 18px 18px 0 0;
      max-height: 94vh;
    }
    .cm-aspect-group { flex-wrap: wrap; }
  }
`;
/* ── Optimisation #1 — module-scope style element ──────────────────────────
   Created once; React reconciler sees the same reference every render
   and skips the DOM patch after the first mount.                            */
const STYLE_EL = <style>{MODAL_CSS}</style>;

/* ── Optimisation #2 — module-scope stable aspect handlers ─────────────────
   Each entry is created once at module load time. The aspect-ratio button
   list never allocates new closures during re-renders caused by zoom /
   crop-position / rotation changes.
   Note: setAspect is not available at module scope, so we store the value
   and call a shared dispatcher from inside the component via a ref.         */
// We use a shared dispatch-ref pattern: handlers are module-scope but call
// a ref function so they're never recreated.
const aspectDispatchRef = { current: null };
const ASPECT_HANDLERS = Object.fromEntries(
  ASPECT_OPTIONS.map((opt) => [
    opt.label,
    () => aspectDispatchRef.current?.(opt.value),
  ]),
);

// ── CropModal ──────────────────────────────────────────────────────────────────
const CropModal = ({
  image,
  onClose,
  onApply,
  crop,
  setCrop,
  zoom,
  setZoom,
  onCropComplete,
  initialAspect = 1,
  applying      = false,
  title         = 'Crop Image',
}) => {
  const titleId     = useId();
  const modalRef    = useRef(null);
  const firstFocRef = useRef(null);
  const lastFocRef  = useRef(null);
  const rafRef      = useRef(0); // Optimisation #7 — typed ref for rAF handle

  const [aspect,   setAspect]   = useState(initialAspect);
  const [rotation, setRotation] = useState(0);

  // Wire the module-scope dispatch ref to this instance's setAspect
  // (safe: only one CropModal is ever mounted at a time)
  aspectDispatchRef.current = setAspect;

  /* ── Optimisation #6 — combined reset effect ────────────────────────────── */
  useEffect(() => {
    if (!image) return;
    setAspect(initialAspect);
    setRotation(0);
  }, [image, initialAspect]);

  // ── Scroll lock ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!image) return;
    lockScroll();
    return () => unlockScroll();
  }, [image]);

  // ── Escape key ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!image) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [image, onClose]);

  // ── Focus trap (Optimisation #7 — cancel rAF on cleanup) ────────────────────
  useEffect(() => {
    if (!image) return;
    rafRef.current = requestAnimationFrame(() => firstFocRef.current?.focus());

    const trap = (e) => {
      if (!modalRef.current?.contains(e.target)) {
        e.preventDefault();
        firstFocRef.current?.focus();
        return;
      }
      if (e.key !== 'Tab') return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocRef.current) {
          e.preventDefault();
          lastFocRef.current?.focus();
        }
      } else {
        if (document.activeElement === lastFocRef.current) {
          e.preventDefault();
          firstFocRef.current?.focus();
        }
      }
    };
    document.addEventListener('keydown', trap);
    return () => {
      cancelAnimationFrame(rafRef.current); // ← was missing in original
      document.removeEventListener('keydown', trap);
    };
  }, [image]);

  // ── Rotation helpers ─────────────────────────────────────────────────────────
  const rotateLeft  = useCallback(() => setRotation(r => (r - 90 + 360) % 360), []);
  const rotateRight = useCallback(() => setRotation(r => (r + 90) % 360),       []);

  // ── Reset ────────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(initialAspect);
  }, [setCrop, setZoom, initialAspect]);

  /* ── Optimisation #4 — stable zoom onChange ─────────────────────────────── */
  const handleZoomChange = useCallback(
    (e) => setZoom(Number(e.target.value)),
    [setZoom],
  );

  if (!image) return null;

  const zoomPct = Math.round(((zoom - 1) / 2) * 100);

  return (
    <>
      {/* Optimisation #1 — reused module-scope element, zero re-allocation */}
      {STYLE_EL}

      {/* ── Backdrop ── */}
      <div
        className="cm-backdrop"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        aria-hidden="true"
      />

      {/* ── Modal ── */}
      <div
        ref={modalRef}
        className="cm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        {/* Header */}
        <div className="cm-header">
          <h2 className="cm-title" id={titleId}>{title}</h2>
          <button
            ref={firstFocRef}
            type="button"
            className="cm-close-btn"
            onClick={onClose}
            aria-label="Close crop modal"
          >
            &#10005;
          </button>
        </div>

        {/* Cropper area */}
        <div className="cm-cropper-wrap">
          <Cropper
            image={image}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            rotation={rotation}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid={true}
            style={{
              containerStyle: { borderRadius: 0 },
              mediaStyle:     { transition: 'none' },
            }}
          />
        </div>

        {/* Controls */}
        <div className="cm-controls">

          {/* Rotation */}
          <div className="cm-control-row">
            <span className="cm-control-label">Rotation</span>
            <div className="cm-rotate-group">
              <button
                type="button"
                className="cm-rotate-btn"
                onClick={rotateLeft}
                aria-label="Rotate 90° counter-clockwise"
                title="Rotate left"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="1 4 1 10 7 10"/>
                  <path d="M3.51 15a9 9 0 1 0 .49-3.92"/>
                </svg>
              </button>
              <span className="cm-rotation-val">{rotation}°</span>
              <button
                type="button"
                className="cm-rotate-btn"
                onClick={rotateRight}
                aria-label="Rotate 90° clockwise"
                title="Rotate right"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-.49-3.92"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Zoom */}
          <div className="cm-control-row">
            <label className="cm-control-label" htmlFor="cm-zoom-range">Zoom</label>
            <div className="cm-zoom-group">
              <input
                id="cm-zoom-range"
                type="range"
                className="cm-range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={handleZoomChange}  /* Optimisation #4 */
                style={{ '--zoom-pct': zoomPct }}
                aria-valuetext={`${zoomPct}%`}
              />
              <span className="cm-zoom-val">{zoomPct}%</span>
            </div>
          </div>

          {/* Aspect ratio — Optimisation #2: module-scope stable handlers */}
          <div className="cm-control-row cm-control-row--aspect">
            <span className="cm-control-label">Aspect</span>
            <div className="cm-aspect-group" role="group" aria-label="Aspect ratio">
              {ASPECT_OPTIONS.map((opt) => {
                const isActive = aspect === opt.value;
                return (
                  <button
                    key={opt.label}
                    type="button"
                    className={`cm-aspect-btn ${isActive ? 'cm-aspect-btn--active' : ''}`}
                    onClick={ASPECT_HANDLERS[opt.label]}
                    aria-pressed={isActive}
                    aria-label={opt.ariaLabel}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="cm-footer">
          <button
            type="button"
            className="cm-reset-btn"
            onClick={handleReset}
            aria-label="Reset crop, zoom and rotation to defaults"
          >
            &#8635; Reset
          </button>
          <div className="cm-footer-actions">
            <button type="button" className="cm-cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button
              ref={lastFocRef}
              type="button"
              className="cm-apply-btn"
              onClick={onApply}
              disabled={applying}
              aria-busy={applying}
            >
              {applying ? (
                <>
                  <span className="cm-spinner" aria-hidden="true" />
                  Applying…
                </>
              ) : (
                'Apply Crop'
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

CropModal.propTypes = {
  image:          PropTypes.string,
  onClose:        PropTypes.func.isRequired,
  onApply:        PropTypes.func.isRequired,
  crop:           PropTypes.shape({ x: PropTypes.number, y: PropTypes.number }).isRequired,
  setCrop:        PropTypes.func.isRequired,
  zoom:           PropTypes.number.isRequired,
  setZoom:        PropTypes.func.isRequired,
  onCropComplete: PropTypes.func.isRequired,
  initialAspect:  PropTypes.number,
  applying:       PropTypes.bool,
  title:          PropTypes.string,
};

export default CropModal;

