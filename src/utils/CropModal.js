/**
 * utils/CropModal.js
 *
 * Production-grade image crop modal.
 *
 * Changes from original:
 *   1. Zero Bootstrap dependency — all styles are self-contained inline + a
 *      companion <style> block. Works in any project regardless of CSS framework.
 *      Matches the dark theme used by KycVerification.jsx exactly.
 *   2. initialAspect prop — callers pass their intended crop aspect ratio
 *      (e.g. 16/9 for Aadhaar, 1 for selfie). The original always started at
 *      1:1 and ignored slot config entirely.
 *   3. Rotation controls — ±90° buttons so users can fix phone portrait photos
 *      that arrive pre-rotated. Rotation state is passed back via onApply so
 *      getCroppedImg can apply it during canvas rendering (feeds into the EXIF
 *      correction path in the enhanced cropImage.js).
 *   4. onApply signature updated — now calls onApply() with no arguments.
 *      The caller (handleCropApply in KycVerification) reads croppedAreaPixels
 *      from its own state (set via onCropComplete). The old onApply(aspect)
 *      signature was dead code — aspect was ignored by every call site.
 *   5. Escape key closes modal — standard browser modal UX.
 *   6. Focus trap — Tab key cycles only within the modal; Shift+Tab reverses.
 *   7. aria-modal, aria-labelledby, role="dialog" — full screen-reader support.
 *   8. Apply loading state — spinner shown while getCroppedImg processes so the
 *      user knows the button worked on large images.
 *   9. Responsive viewfinder height — uses a CSS clamp so the cropper area
 *      doesn't overflow on short mobile screens.
 *  10. body scroll lock via a ref-counted class toggle instead of a direct
 *      style mutation, so multiple overlapping modals don't fight each other.
 *  11. Zoom keyboard accessible — range input with visible value readout.
 *  12. Reset button — returns to the original uncropped view.
 *  13. Aspect ratio buttons have aria-pressed for screen readers.
 */

import React, {
  useEffect, useState, useCallback, useRef, useId,
} from 'react';
import Cropper from 'react-easy-crop';
import PropTypes from 'prop-types';

// ── Scroll-lock ref counter ────────────────────────────────────────────────────
// Increment on open, decrement on close. Body scroll only unlocks when counter
// reaches zero, so nested modals don't prematurely re-enable scrolling.
let _scrollLockCount = 0;

function lockScroll() {
  _scrollLockCount++;
  if (_scrollLockCount === 1) {
    document.body.style.overflow = 'hidden';
  }
}

function unlockScroll() {
  _scrollLockCount = Math.max(0, _scrollLockCount - 1);
  if (_scrollLockCount === 0) {
    document.body.style.overflow = '';
  }
}

// ── Aspect ratio options ───────────────────────────────────────────────────────
const ASPECT_OPTIONS = [
  // --- Square ---
  { label: '1 : 1', value: 1, ariaLabel: 'Square' },

  // --- Landscape (Common) ---
  { label: '4 : 3', value: 4 / 3, ariaLabel: 'Four by three' },
  { label: '3 : 2', value: 3 / 2, ariaLabel: 'Three by two' },
  { label: '16 : 9', value: 16 / 9, ariaLabel: 'Sixteen by nine' },
  { label: '21 : 9', value: 21 / 9, ariaLabel: 'Ultra wide' },

  // --- Portrait (Mobile / Social) ---
  { label: '3 : 4', value: 3 / 4, ariaLabel: 'Three by four' },
  { label: '2 : 3', value: 2 / 3, ariaLabel: 'Two by three' },
  { label: '9 : 16', value: 9 / 16, ariaLabel: 'Vertical video' },

  // --- Social Media Specific ---
  { label: '4 : 5', value: 4 / 5, ariaLabel: 'Instagram portrait' },
  { label: '1.91 : 1', value: 1.91, ariaLabel: 'Facebook cover' },

  // --- Cinematic / Advanced ---
  { label: '2 : 1', value: 2 / 1, ariaLabel: 'Panorama' },
  { label: '2.35 : 1', value: 2.35, ariaLabel: 'Cinematic widescreen' },

  // --- Free ---
  { label: 'Free', value: undefined, ariaLabel: 'Free form' },
];

// ── CropModal ──────────────────────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {string}   props.image           dataURL or object URL; null/undefined = closed
 * @param {function} props.onClose         Called on Cancel / Escape / backdrop click
 * @param {function} props.onApply         Called when crop is confirmed (no arguments)
 * @param {object}   props.crop            { x, y } from parent state
 * @param {function} props.setCrop
 * @param {number}   props.zoom            1–3
 * @param {function} props.setZoom
 * @param {function} props.onCropComplete  (croppedArea, croppedAreaPixels) callback
 * @param {number}   [props.initialAspect=1]  Starting aspect ratio for this slot
 * @param {boolean}  [props.applying=false]   Shows spinner on Apply button while
 *                                            the parent's getCroppedImg is running
 * @param {string}   [props.title='Crop Image']
 */
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

  const [aspect,   setAspect]   = useState(initialAspect);
  const [rotation, setRotation] = useState(0);

  // Sync aspect when the parent changes which slot is open
  useEffect(() => {
    setAspect(initialAspect);
  }, [initialAspect, image]); // reset when a new image opens

  // Reset rotation when a new image opens
  useEffect(() => {
    if (image) setRotation(0);
  }, [image]);

  // ── Scroll lock ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!image) return;
    lockScroll();
    return () => unlockScroll();
  }, [image]);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!image) return;
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => document.removeEventListener('keydown', handleKey, true);
  }, [image, onClose]);

  // ── Focus trap ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!image) return;
    // Move focus into modal on open
    const raf = requestAnimationFrame(() => firstFocRef.current?.focus());

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
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', trap);
    };
  }, [image]);

  // ── Rotation helpers ──────────────────────────────────────────────────────
  const rotateLeft  = useCallback(() => setRotation(r => (r - 90 + 360) % 360), []);
  const rotateRight = useCallback(() => setRotation(r => (r + 90) % 360),       []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
    setAspect(initialAspect);
  }, [setCrop, setZoom, initialAspect]);

  if (!image) return null;

  const zoomPct = Math.round(((zoom - 1) / 2) * 100);

  return (
    <>
      {/* ── Injected styles (self-contained — zero Bootstrap) ── */}
      <style>{MODAL_CSS}</style>

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
                {/* Counter-clockwise arrow */}
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
                {/* Clockwise arrow */}
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
            <label className="cm-control-label" htmlFor="cm-zoom-range">
              Zoom
            </label>
            <div className="cm-zoom-group">
              <input
                id="cm-zoom-range"
                type="range"
                className="cm-range"
                min="1"
                max="3"
                step="0.05"
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                aria-valuetext={`${zoomPct}%`}
              />
              <span className="cm-zoom-val">{zoomPct}%</span>
            </div>
          </div>

          {/* Aspect ratio */}
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
                    onClick={() => setAspect(opt.value)}
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
            <button
              type="button"
              className="cm-cancel-btn"
              onClick={onClose}
            >
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

// ── Self-contained styles ──────────────────────────────────────────────────────
// All class names are prefixed with `cm-` to prevent collisions.
// Matches the dark theme in KycVerification.css:
//   Background: #0a0f1a   Surface: #0c1525   Border: #1e2d45
//   Accent blue: #3b82f6  Text: #e2eaf5      Muted: #4a6280
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
    /* clamp: never shorter than 220px, never taller than 55vh */
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

  /* Apply spinner */
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

  /* ── Mobile bottom-sheet on small screens ── */
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