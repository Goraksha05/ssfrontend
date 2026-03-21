/**
 * Components/KYC/KycVerification.jsx
 *
 * Three-step KYC submission form:
 *   Step 1 — Manual details (Aadhaar number, PAN number, bank account, IFSC)
 *   Step 2 — Document uploads with in-browser crop for image files
 *             Selfie slot has dedicated camera-capture + upload modes
 *   Step 3 — Review & submit
 *
 * API: POST /api/kyc/submit  (multipart/form-data)
 *   Files:  aadhaar, pan, bank, selfie
 *   Fields: aadhaarNumber, panNumber, accountNumber, ifscCode
 *
 * Selfie & liveness requirements (mirrors livenessService.js):
 *   • Resolution ≥ 200×200 px  — checked client-side before upload
 *   • Sharpness stdev ≥ 10     — camera-captured JPEGs always satisfy this;
 *                                 file uploads show a soft warning
 *   • Face must be detectable  — faceMatchService.js (server-side SSD MobileNet)
 *
 * Dependencies:
 *   react-easy-crop        (used inside CropModal)
 *   ../../utils/cropImage  → getCroppedImg
 *   ../../utils/CropModal  → CropModal
 *   ../../Context/KYC/KycContext
 *   ../../Context/Authorisation/AuthContext
 */

import React, {
  useState, useRef, useCallback, useEffect,
} from 'react';
import { useKyc, KYC_STATUSES }  from '../../Context/KYC/KycContext';
import { useAuth }               from '../../Context/Authorisation/AuthContext';
import {
  getCroppedImg,
  readExifOrientation,
  revokePreviewUrl,
}                                from '../../utils/cropImage';
import CropModal                 from '../../utils/CropModal';
import './KycVerification.css';

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

// ── Constants ─────────────────────────────────────────────────────────────────

const STEPS = ['Details', 'Documents', 'Review'];

const SLOTS = [
  {
    key:        'aadhaar',
    label:      'Aadhaar Card',
    hint:       'Front side — name & 12-digit number must be visible',
    icon:       '🪪',
    accept:     'image/jpeg,image/png,image/webp,application/pdf',
    cropAspect: 16 / 9,
    canCrop:    true,
    isSelfie:   false,
  },
  {
    key:        'pan',
    label:      'PAN Card',
    hint:       'Name, PAN number & date of birth must be clear',
    icon:       '💳',
    accept:     'image/jpeg,image/png,image/webp,application/pdf',
    cropAspect: 16 / 9,
    canCrop:    true,
    isSelfie:   false,
  },
  {
    key:        'bank',
    label:      'Bank Passbook / Statement',
    hint:       'First page — name, account number & IFSC visible',
    icon:       '🏦',
    accept:     'image/jpeg,image/png,image/webp,application/pdf',
    cropAspect: 4 / 3,
    canCrop:    true,
    isSelfie:   false,
  },
  {
    key:        'selfie',
    label:      'Live Selfie',
    hint:       'Clear photo of your face — plain background, good lighting',
    icon:       '🤳',
    accept:     'image/jpeg,image/png,image/webp',
    cropAspect: 1,
    canCrop:    true,
    isSelfie:   true,   // ← drives the dedicated selfie capture UI
  },
];

const FIELDS = [
  {
    key:         'aadhaarNumber',
    label:       'Aadhaar Number',
    placeholder: '1234 5678 9012',
    hint:        '12-digit number on your Aadhaar card',
    icon:        '🪪',
    maxLength:   14,
    validate:    v => /^\d{4}\s?\d{4}\s?\d{4}$/.test(v.replace(/\s/g, '').padStart(12))
                   && v.replace(/\s/g, '').length === 12,
    errorMsg:    'Must be exactly 12 digits',
    format:      v => v.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ').trim().slice(0, 14),
  },
  {
    key:         'panNumber',
    label:       'PAN Number',
    placeholder: 'ABCDE1234F',
    hint:        '10-character alphanumeric (e.g. ABCDE1234F)',
    icon:        '💳',
    maxLength:   10,
    validate:    v => /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v.toUpperCase()),
    errorMsg:    'Invalid PAN — must be AAAAA9999A format',
    format:      v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10),
  },
  {
    key:         'accountNumber',
    label:       'Bank Account Number',
    placeholder: '1234567890123456',
    hint:        '9 to 18 digits — no spaces or hyphens',
    icon:        '🏦',
    maxLength:   18,
    validate:    v => /^\d{9,18}$/.test(v),
    errorMsg:    'Must be 9 to 18 digits',
    format:      v => v.replace(/\D/g, '').slice(0, 18),
  },
  {
    key:         'ifscCode',
    label:       'IFSC Code',
    placeholder: 'SBIN0001234',
    hint:        '11-character code on your cheque / passbook',
    icon:        '🏦',
    maxLength:   11,
    validate:    v => /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.toUpperCase()),
    errorMsg:    'Invalid IFSC — must be AAAA0XXXXXX (11 chars)',
    format:      v => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11),
  },
];

// ── Liveness hints (mirrors livenessService.js rules shown to the user) ───────
const LIVENESS_TIPS = [
  { icon: '☀️', text: 'Good natural or indoor light — avoid harsh shadows' },
  { icon: '👁️', text: 'Look directly at the camera, eyes open and visible' },
  { icon: '🚫', text: 'No sunglasses, masks, hats or heavy filters' },
  { icon: '📐', text: 'Plain wall or background — no other people in frame' },
  { icon: '📏', text: 'Hold device at arm\'s length — face must fill most of the frame' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const formatBytes = b =>
  b < 1024       ? `${b} B`
  : b < 1048576  ? `${(b / 1024).toFixed(1)} KB`
  :                `${(b / 1048576).toFixed(1)} MB`;

const STATUS_META = {
  not_started: { color: '#94a3b8', label: 'Not Started',  bg: '#1e293b' },
  required:    { color: '#f59e0b', label: 'KYC Required', bg: '#2d1f00' },
  submitted:   { color: '#3b82f6', label: 'Under Review', bg: '#0f1f3d' },
  verified:    { color: '#22c55e', label: 'Verified',     bg: '#0a2d1a' },
  rejected:    { color: '#ef4444', label: 'Rejected',     bg: '#2d0f0f' },
};

/**
 * Client-side pre-flight check mirroring livenessService.js:
 *   Rule 1 — width & height >= 200 px
 *   Rule 2 — image must not be blank / near-uniform (can't check stdev client-side,
 *             but we can flag images that are too small in file size as a heuristic)
 *
 * Returns { ok: bool, warning: string|null }
 */
function preflightSelfie(file, imgEl) {
  const { naturalWidth: w, naturalHeight: h } = imgEl;

  if (w < 200 || h < 200) {
    return {
      ok: false,
      warning: `Image is too small (${w}×${h} px). The server requires at least 200×200 px.`,
    };
  }
  // File size heuristic: a real camera photo is rarely under 30 KB
  if (file.size < 30 * 1024) {
    return {
      ok: true,
      warning: 'This image looks very small. A camera photo may give better results.',
    };
  }
  return { ok: true, warning: null };
}

// ─────────────────────────────────────────────────────────────────────────────
// SelfieCapture sub-component
//
// Presents two tabs: "Take Photo" (camera) and "Upload File".
// Camera tab opens getUserMedia, shows a live viewfinder, and captures a
// JPEG blob when the user clicks "Capture". The blob is identical in quality
// to what a native camera app would produce — stdev >> 10, so livenessService
// will pass Rule 2 reliably.
//
// After capture or file selection the user is dropped into the CropModal
// (1:1 aspect) so they can centre their face before the file is committed.
// ─────────────────────────────────────────────────────────────────────────────
// ── Camera availability helpers ───────────────────────────────────────────────

/**
 * Returns a human-readable reason why getUserMedia is unavailable,
 * or null if the API appears to be supported.
 *
 * Common causes on Android / Motorola devices:
 *   1. Page served over http:// (not https:// or localhost) — browsers
 *      remove navigator.mediaDevices entirely on non-secure origins.
 *   2. Old Android System WebView version where the API was not yet exposed.
 *   3. User has revoked the camera permission at OS level.
 */
function getCameraUnavailableReason() {
  // Secure-context check: mediaDevices is hidden on http:// by the browser
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'http_insecure';
  }
  // API existence check
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return 'api_missing';
  }
  return null; // camera should be available
}

const CAMERA_ERROR_MESSAGES = {
  http_insecure:
    'Camera requires a secure connection (HTTPS). ' +
    'Your page is on HTTP — please open the app over HTTPS or use the Upload option below.',
  api_missing:
    'Your browser does not support camera access on this device. ' +
    'Please use the Upload option to choose a photo from your gallery.',
  NotAllowedError:
    'Camera permission denied. Tap the camera icon in your browser address bar, ' +
    'allow access, then try again.',
  NotFoundError:
    'No front camera was found on this device. Please use the Upload option.',
  NotReadableError:
    'Camera is being used by another app. Close it and try again.',
  OverconstrainedError:
    'Camera could not match the requested settings. Trying again with basic settings…',
  SecurityError:
    'Camera access was blocked by a security policy. Please use the Upload option.',
};

function SelfieCapture({ onFileReady, onCancel }) {
  // Detect camera availability once at mount — auto-switch to upload if unavailable
  const unavailableReason = getCameraUnavailableReason();
  const cameraSupported   = unavailableReason === null;

  const [mode,        setMode]        = useState(cameraSupported ? 'camera' : 'upload');
  const [cameraState, setCameraState] = useState('idle');
  const [cameraError, setCameraError] = useState(
    // Pre-populate error if we already know camera won't work
    cameraSupported ? '' : (CAMERA_ERROR_MESSAGES[unavailableReason] ?? '')
  );
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [countdown,   setCountdown]   = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);

  // ── Camera lifecycle ────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    // Guard: check availability again at call time in case context changed
    const reason = getCameraUnavailableReason();
    if (reason) {
      setCameraError(CAMERA_ERROR_MESSAGES[reason] ?? 'Camera is not available.');
      setCameraState('error');
      return;
    }

    setCameraState('starting');
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',       // front camera on mobile
          width:  { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraState('live');
    } catch (err) {
      // OverconstrainedError: retry with no video constraints
      if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
          streamRef.current = fallbackStream;
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.play();
          }
          setCameraState('live');
          return;
        } catch {
          // Fall through to generic error handling below
        }
      }

      const msg =
        CAMERA_ERROR_MESSAGES[err.name] ??
        // TypeError means mediaDevices itself was undefined at call time —
        // this is the exact error reported on the Motorola 60 Fusion
        (err instanceof TypeError
          ? CAMERA_ERROR_MESSAGES.api_missing
          : `Camera error: ${err.message}`);

      setCameraError(msg);
      setCameraState('error');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setCameraState('idle');
    setCountdown(null);
  }, []);

  // Stop stream when modal unmounts or mode switches away from camera
  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  useEffect(() => {
    if (mode === 'camera' && cameraState === 'idle') {
      startCamera();
    }
    if (mode !== 'camera') {
      stopCamera();
      setCapturedSrc(null);
    }
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown + capture ─────────────────────────────────────────────────────

  const startCountdown = useCallback(() => {
    let n = 3;
    setCountdown(n);
    timerRef.current = setInterval(() => {
      n--;
      if (n > 0) {
        setCountdown(n);
      } else {
        clearInterval(timerRef.current);
        setCountdown(null);
        captureFrame();
      }
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const captureFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');

    // Mirror horizontally (front camera is mirrored on screen — un-mirror for storage)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedSrc(dataUrl);
    setCameraState('captured');
    stopCamera();
  }, [stopCamera]);

  const retake = useCallback(() => {
    setCapturedSrc(null);
    setCameraState('idle');
    startCamera();
  }, [startCamera]);

  // Convert dataURL to File and hand off to crop pipeline
  const useCapturedPhoto = useCallback(() => {
    if (!capturedSrc) return;
    fetch(capturedSrc)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'selfie-camera.jpg', { type: 'image/jpeg' });
        onFileReady(file);
      });
  }, [capturedSrc, onFileReady]);

  // ── File upload tab ─────────────────────────────────────────────────────────
  const fileInputRef = useRef(null);

  const handleUploadChange = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('File exceeds 10 MB limit.');
      return;
    }
    onFileReady(file);
  }, [onFileReady]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="selfie-modal-backdrop">
      <div className="selfie-modal">

        {/* Header */}
        <div className="selfie-modal-header">
          <div className="selfie-modal-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
            Take Your Selfie
          </div>
          <button className="selfie-modal-close" onClick={onCancel} type="button">&#10005;</button>
        </div>

        {/* Mode tabs */}
        <div className="selfie-tabs">
          <button
            type="button"
            className={`selfie-tab ${mode === 'camera' ? 'selfie-tab--active' : ''}`}
            onClick={() => setMode('camera')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
            Use Camera
          </button>
          <button
            type="button"
            className={`selfie-tab ${mode === 'upload' ? 'selfie-tab--active' : ''}`}
            onClick={() => setMode('upload')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Upload Photo
          </button>
        </div>

        {/* ── Camera tab ── */}
        {mode === 'camera' && (
          <div className="selfie-camera-panel">

            {/* Viewfinder / captured frame */}
            <div className="selfie-viewfinder-wrap">
              {cameraState === 'starting' && (
                <div className="selfie-viewfinder-placeholder">
                  <div className="kyc-spinner" />
                  <p>Starting camera…</p>
                </div>
              )}

              {(cameraState === 'error' || (!cameraSupported && mode === 'camera')) && (
                <div className="selfie-viewfinder-placeholder selfie-viewfinder-placeholder--error">
                  <span className="selfie-error-icon">&#9888;</span>
                  <p>{cameraError}</p>
                  <div className="selfie-error-actions">
                    {/* Only show Retry if the API is actually present — no point
                        retrying if mediaDevices is missing entirely */}
                    {cameraSupported && (
                      <button
                        type="button"
                        className="selfie-retry-btn"
                        onClick={() => { setCameraState('idle'); startCamera(); }}
                      >
                        &#8635; Try Again
                      </button>
                    )}
                    <button
                      type="button"
                      className="selfie-switch-upload-btn"
                      onClick={() => setMode('upload')}
                    >
                      &#128247; Upload Photo Instead
                    </button>
                  </div>
                </div>
              )}

              {/* Live video — mirrored for natural selfie feel */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="selfie-video"
                style={{ display: cameraState === 'live' ? 'block' : 'none' }}
              />

              {/* Captured still */}
              {cameraState === 'captured' && capturedSrc && (
                <img src={capturedSrc} alt="Captured selfie" className="selfie-captured-img" />
              )}

              {/* Face-oval guide overlay (shows only when live) */}
              {cameraState === 'live' && (
                <div className="selfie-oval-overlay">
                  <svg viewBox="0 0 320 400" className="selfie-oval-svg">
                    <defs>
                      <mask id="oval-mask">
                        <rect width="320" height="400" fill="white" />
                        <ellipse cx="160" cy="180" rx="110" ry="145" fill="black" />
                      </mask>
                    </defs>
                    <rect width="320" height="400" fill="rgba(5,12,28,0.55)" mask="url(#oval-mask)" />
                    <ellipse cx="160" cy="180" rx="110" ry="145"
                      fill="none" stroke="#60a5fa" strokeWidth="2.5"
                      strokeDasharray="8 5" />
                  </svg>
                  <p className="selfie-oval-hint">Centre your face inside the oval</p>
                </div>
              )}

              {/* Countdown bubble */}
              {countdown !== null && (
                <div className="selfie-countdown">{countdown}</div>
              )}
            </div>

            {/* Hidden canvas for frame capture */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            {/* Camera controls */}
            <div className="selfie-camera-controls">
              {cameraState === 'live' && (
                <>
                  <button
                    type="button"
                    className="selfie-capture-btn"
                    onClick={startCountdown}
                    disabled={countdown !== null}
                    title="Take photo with 3-second countdown"
                  >
                    {countdown !== null ? (
                      <span className="selfie-capture-btn-inner selfie-capture-btn-inner--counting">
                        {countdown}
                      </span>
                    ) : (
                      <span className="selfie-capture-btn-inner" />
                    )}
                  </button>
                  <p className="selfie-capture-hint">Tap to start a 3-second countdown</p>
                </>
              )}

              {cameraState === 'captured' && (
                <div className="selfie-captured-actions">
                  <button type="button" className="selfie-retake-btn" onClick={retake}>
                    &#8635; Retake
                  </button>
                  <button type="button" className="selfie-use-btn" onClick={useCapturedPhoto}>
                    Use This Photo &#8594;
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Upload tab ── */}
        {mode === 'upload' && (
          <div className="selfie-upload-panel">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleUploadChange}
            />
            <button
              type="button"
              className="selfie-upload-drop"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="selfie-upload-icon">&#128247;</span>
              <p className="selfie-upload-label">Tap to choose a photo</p>
              <p className="selfie-upload-sub">JPG, PNG, WebP — max 10 MB</p>
            </button>
          </div>
        )}

        {/* Liveness tips */}
        <div className="selfie-tips">
          <p className="selfie-tips-title">&#128064; For best results:</p>
          <ul className="selfie-tips-list">
            {LIVENESS_TIPS.map(t => (
              <li key={t.text}>
                <span>{t.icon}</span>
                {t.text}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main KycVerification component
// ─────────────────────────────────────────────────────────────────────────────
export default function KycVerification() {
  const { token }                    = useAuth();
  const { status, kycData, refetch } = useKyc();

  // ── Step state ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Step 1: manual fields ───────────────────────────────────────────────────
  const [fields,       setFields]       = useState({ aadhaarNumber: '', panNumber: '', accountNumber: '', ifscCode: '' });
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  // ── Step 2: document uploads ────────────────────────────────────────────────
  const [files,    setFiles]    = useState({});
  const [previews, setPreviews] = useState({});

  // ── Selfie capture modal ────────────────────────────────────────────────────
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  // Soft liveness pre-flight warning (does NOT block submission)
  const [selfieWarning,   setSelfieWarning]   = useState(null);

  // ── Crop modal state ────────────────────────────────────────────────────────
  const [cropSlotKey,       setCropSlotKey]       = useState(null);
  const [cropImageSrc,      setCropImageSrc]      = useState(null);
  const [cropRawFile,       setCropRawFile]       = useState(null);
  const [cropInitialAspect, setCropInitialAspect] = useState(1);
  const [cropOrientation,   setCropOrientation]   = useState(1);
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying,          setApplying]          = useState(false);

  // ── Submission ──────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [serverMsg,  setServerMsg]  = useState(null);
  const [dragOver,   setDragOver]   = useState(null);

  const inputRefs = useRef({});

  // ── Field validation ────────────────────────────────────────────────────────
  const validateField = useCallback((key, value) => {
    const def = FIELDS.find(f => f.key === key);
    if (!def) return '';
    if (!value.trim()) return `${def.label} is required`;
    return def.validate(value) ? '' : def.errorMsg;
  }, []);

  const handleFieldChange = useCallback((key, rawValue) => {
    const def = FIELDS.find(f => f.key === key);
    const formatted = def?.format ? def.format(rawValue) : rawValue;
    setFields(prev => ({ ...prev, [key]: formatted }));
    if (fieldTouched[key]) {
      setFieldErrors(prev => ({ ...prev, [key]: validateField(key, formatted) }));
    }
  }, [fieldTouched, validateField]);

  const handleFieldBlur = useCallback((key) => {
    setFieldTouched(prev => ({ ...prev, [key]: true }));
    setFieldErrors(prev => ({ ...prev, [key]: validateField(key, fields[key]) }));
  }, [fields, validateField]);

  const validateAllFields = () => {
    const errors = {};
    let hasError = false;
    FIELDS.forEach(f => {
      const err = validateField(f.key, fields[f.key]);
      errors[f.key] = err;
      if (err) hasError = true;
    });
    setFieldErrors(errors);
    setFieldTouched({ aadhaarNumber: true, panNumber: true, accountNumber: true, ifscCode: true });
    return !hasError;
  };

  // ── Step navigation ─────────────────────────────────────────────────────────
  const goToStep = (n) => {
    if (n === 1 && !validateAllFields()) return;
    setStep(n);
    setServerMsg(null);
  };

  // ── Crop modal handlers ─────────────────────────────────────────────────────
  const openCropModal = useCallback(async (key, file) => {
    // Look up the slot's intended crop aspect so CropModal starts at the right ratio
    const slot           = SLOTS.find(s => s.key === key);
    const slotAspect     = slot?.cropAspect ?? 1;

    // Read EXIF orientation before converting to dataURL — the File object
    // holds the raw bytes; after FileReader converts it we lose this info.
    // readExifOrientation returns 1 (no-op) for non-JPEG or on any error.
    const orientation = await readExifOrientation(file instanceof File ? file : null);

    // For camera-captured blobs (no .name), create an object URL directly
    const src = (file instanceof Blob && !(file instanceof File))
      ? URL.createObjectURL(file)
      : null;

    const commitState = (imageSrc) => {
      setCropSlotKey(key);
      setCropImageSrc(imageSrc);
      setCropRawFile(file);
      setCropInitialAspect(slotAspect);
      setCropOrientation(orientation);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
    };

    if (src) {
      commitState(src);
    } else {
      const reader = new FileReader();
      reader.onload = e => commitState(e.target.result);
      reader.readAsDataURL(file);
    }
  }, []);

  const handleCropComplete = useCallback((_, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleCropApply = useCallback(async () => {
    if (!cropImageSrc || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const blob = await getCroppedImg(cropImageSrc, croppedAreaPixels, {
        orientation: cropOrientation,   // EXIF correction applied during canvas draw
        format:      'image/jpeg',
        quality:     0.92,
      });

      const croppedFile = new File(
        [blob],
        cropRawFile?.name || `${cropSlotKey}.jpg`,
        { type: 'image/jpeg' }
      );
      const newPreviewUrl = URL.createObjectURL(blob);

      // Run pre-flight liveness check for the selfie slot
      if (cropSlotKey === 'selfie') {
        const img = new Image();
        img.onload = () => {
          const check = preflightSelfie(croppedFile, img);
          if (!check.ok) {
            revokePreviewUrl(newPreviewUrl);
            setServerMsg({ type: 'error', text: check.warning });
            setApplying(false);
            closeCropModal();
            return;
          }
          if (check.warning) setSelfieWarning(check.warning);
          else setSelfieWarning(null);

          // Revoke the old preview URL before replacing it
          setPreviews(prev => {
            revokePreviewUrl(prev[cropSlotKey]);
            return { ...prev, [cropSlotKey]: newPreviewUrl };
          });
          setFiles(prev => ({ ...prev, [cropSlotKey]: croppedFile }));
          setApplying(false);
          closeCropModal();
        };
        img.onerror = () => {
          revokePreviewUrl(newPreviewUrl);
          setApplying(false);
          closeCropModal();
        };
        img.src = newPreviewUrl;
      } else {
        setPreviews(prev => {
          revokePreviewUrl(prev[cropSlotKey]);
          return { ...prev, [cropSlotKey]: newPreviewUrl };
        });
        setFiles(prev => ({ ...prev, [cropSlotKey]: croppedFile }));
        setApplying(false);
        closeCropModal();
      }
    } catch (err) {
      setApplying(false);
      setServerMsg({ type: 'error', text: `Crop failed: ${err.message}` });
      closeCropModal();
    }
  }, [cropImageSrc, croppedAreaPixels, cropRawFile, cropSlotKey, cropOrientation]);

  const closeCropModal = () => {
    setCropSlotKey(null);
    setCropImageSrc(null);
    setCropRawFile(null);
    setCroppedAreaPixels(null);
    setCropOrientation(1);
    // Note: do NOT revoke cropImageSrc here — it may be the same src that
    // was already set as a preview. Only revoke it if it was a fresh object URL
    // created solely for the crop session (handled in openCropModal's commitState).
  };

  // ── Selfie modal: receives a raw File from either camera or upload ──────────
  const handleSelfieFileReady = useCallback((file) => {
    setShowSelfieModal(false);
    setSelfieWarning(null);
    // Always open crop modal (1:1 aspect) so user can centre their face
    openCropModal('selfie', file);
  }, [openCropModal]);

  // ── Generic file input handler (non-selfie slots) ────────────────────────────
  const handleFile = useCallback((key, file) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setServerMsg({ type: 'error', text: `${key}: file exceeds 10 MB limit.` });
      return;
    }
    setServerMsg(null);

    const slot = SLOTS.find(s => s.key === key);
    if (file.type.startsWith('image/') && slot?.canCrop) {
      openCropModal(key, file);
    } else {
      setFiles(prev    => ({ ...prev, [key]: file }));
      setPreviews(prev => ({ ...prev, [key]: 'pdf' }));
    }
  }, [openCropModal]);

  const removeFile = key => {
    setFiles(prev    => { const n = { ...prev }; delete n[key]; return n; });
    setPreviews(prev => { const n = { ...prev }; delete n[key]; return n; });
    if (key === 'selfie') setSelfieWarning(null);
    if (inputRefs.current[key]) inputRefs.current[key].value = '';
  };

  const onDrop = (key, e) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(key, file);
  };

  // ── Submit ───────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const missing = SLOTS.filter(s => !files[s.key]).map(s => s.label);
    if (missing.length) {
      setServerMsg({ type: 'error', text: `Please upload: ${missing.join(', ')}` });
      return;
    }

    setSubmitting(true);
    setProgress(0);
    setServerMsg(null);

    const form = new FormData();
    SLOTS.forEach(s => form.append(s.key, files[s.key]));
    form.append('aadhaarNumber', fields.aadhaarNumber.replace(/\s/g, ''));
    form.append('panNumber',     fields.panNumber);
    form.append('accountNumber', fields.accountNumber);
    form.append('ifscCode',      fields.ifscCode);

    try {
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.upload.addEventListener('progress', e => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 80));
        });
        xhr.addEventListener('load', () => {
          setProgress(95);
          try {
            const data = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(data);
            else reject(new Error(data.message || 'Submission failed'));
          } catch {
            reject(new Error('Invalid server response'));
          }
        });
        xhr.addEventListener('error', () => reject(new Error('Network error')));
        xhr.open('POST', `${API_BASE}/api/kyc/submit`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(form);
      });

      setProgress(100);
      setServerMsg({ type: 'success', text: 'Documents submitted! Your KYC is under review.' });
      setFiles({});
      setPreviews({});
      setFields({ aadhaarNumber: '', panNumber: '', accountNumber: '', ifscCode: '' });
      setSelfieWarning(null);
      setStep(0);
      setTimeout(() => refetch(), 1500);
    } catch (err) {
      setServerMsg({ type: 'error', text: err.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setProgress(0), 1200);
    }
  };

  // ── Derived ──────────────────────────────────────────────────────────────────
  const canResubmit   = [KYC_STATUSES.NOT_STARTED, KYC_STATUSES.REQUIRED, KYC_STATUSES.REJECTED].includes(status);
  const meta          = STATUS_META[status] || STATUS_META.not_started;
  const allUploaded   = SLOTS.every(s => files[s.key]);
  const allFilled     = FIELDS.every(f => fields[f.key].trim() !== '');
  const noFieldErrors = FIELDS.every(f => !fieldErrors[f.key]);

  // ── Step bar ─────────────────────────────────────────────────────────────────
  const StepBar = () => (
    <div className="kyc-stepbar">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          <div className={`kyc-step ${i < step ? 'kyc-step--done' : i === step ? 'kyc-step--active' : ''}`}>
            <div className="kyc-step-circle">{i < step ? '✓' : i + 1}</div>
            <span className="kyc-step-label">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`kyc-step-line ${i < step ? 'kyc-step-line--done' : ''}`} />
          )}
        </React.Fragment>
      ))}
    </div>
  );

  // ── Step 1: Details ───────────────────────────────────────────────────────────
  const renderDetails = () => (
    <div className="kyc-section">
      <p className="kyc-section-desc">
        Enter your document details exactly as they appear on your official IDs.
        These are verified against the documents you upload in the next step.
      </p>
      <div className="kyc-fields-grid">
        {FIELDS.map(field => {
          const hasError = fieldTouched[field.key] && !!fieldErrors[field.key];
          const isValid  = fieldTouched[field.key] && !fieldErrors[field.key] && fields[field.key];
          return (
            <div key={field.key} className={`kyc-field ${hasError ? 'kyc-field--error' : isValid ? 'kyc-field--valid' : ''}`}>
              <label className="kyc-field-label">
                <span className="kyc-field-icon">{field.icon}</span>
                {field.label}
              </label>
              <div className="kyc-field-wrap">
                <input
                  className="kyc-field-input"
                  type="text"
                  placeholder={field.placeholder}
                  value={fields[field.key]}
                  maxLength={field.maxLength}
                  onChange={e => handleFieldChange(field.key, e.target.value)}
                  onBlur={() => handleFieldBlur(field.key)}
                  autoComplete="off"
                  spellCheck={false}
                />
                {isValid  && <span className="kyc-field-status kyc-field-status--ok">✓</span>}
                {hasError && <span className="kyc-field-status kyc-field-status--err">✕</span>}
              </div>
              {hasError
                ? <p className="kyc-field-error">{fieldErrors[field.key]}</p>
                : <p className="kyc-field-hint">{field.hint}</p>
              }
            </div>
          );
        })}
      </div>
      <div className="kyc-section-footer">
        <div className="kyc-info-strip" style={{ marginBottom: 0 }}>
          <span>&#128274;</span>
          <p>Your details are encrypted end-to-end and used solely for identity verification.</p>
        </div>
        <button
          type="button"
          className={`kyc-submit-btn ${allFilled && noFieldErrors ? 'kyc-submit-btn--ready' : ''}`}
          disabled={!allFilled}
          onClick={() => goToStep(1)}
        >
          Continue to Document Upload &#8594;
        </button>
      </div>
    </div>
  );

  // ── Step 2: Documents ─────────────────────────────────────────────────────────
  const renderDocuments = () => (
    <div className="kyc-section">
      <p className="kyc-section-desc">
        Upload clear, readable copies of each document. You can crop images after selecting.
        Max <strong>10 MB</strong> per file — JPG, PNG, WebP or PDF accepted.
      </p>

      <div className="kyc-grid">
        {SLOTS.map(slot => {
          const hasFile    = !!files[slot.key];
          const preview    = previews[slot.key];
          const isDragging = dragOver === slot.key;

          // ── Selfie slot gets its own dedicated card ─────────────────────────
          if (slot.isSelfie) {
            return (
              <div
                key={slot.key}
                className={[
                  'kyc-slot kyc-slot--selfie',
                  hasFile ? 'kyc-slot--filled' : '',
                ].filter(Boolean).join(' ')}
              >
                {hasFile ? (
                  <div className="kyc-slot-filled-inner">
                    <img src={preview} alt="Selfie" className="kyc-img-preview kyc-img-preview--selfie" />
                    {/* Liveness pre-flight warning badge */}
                    {selfieWarning && (
                      <div className="selfie-warning-badge">
                        <span>&#9888;</span> {selfieWarning}
                      </div>
                    )}
                    <div className="kyc-slot-overlay">
                      <div className="kyc-slot-meta">
                        <span className="kyc-slot-check">&#10003;</span>
                        <span className="kyc-slot-label">{slot.label}</span>
                        <span className="kyc-slot-size">{formatBytes(files[slot.key].size)}</span>
                      </div>
                      <div className="kyc-slot-actions">
                        <button
                          type="button"
                          className="kyc-crop-btn"
                          onClick={e => { e.stopPropagation(); openCropModal(slot.key, files[slot.key]); }}
                        >
                          &#9986; Crop
                        </button>
                        <button
                          type="button"
                          className="selfie-retake-mini-btn"
                          onClick={e => { e.stopPropagation(); removeFile(slot.key); setShowSelfieModal(true); }}
                        >
                          &#8635; Retake
                        </button>
                        <button
                          type="button"
                          className="kyc-remove-btn"
                          onClick={e => { e.stopPropagation(); removeFile(slot.key); }}
                        >
                          &#10005; Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="selfie-slot-empty">
                    <div className="selfie-slot-avatar">
                      <svg viewBox="0 0 64 64" fill="none">
                        <circle cx="32" cy="22" r="14" stroke="#60a5fa" strokeWidth="2" />
                        <path d="M8 56c0-13.25 10.75-24 24-24s24 10.75 24 24" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <p className="kyc-slot-name">{slot.label}</p>
                    <p className="kyc-slot-hint">{slot.hint}</p>

                    {/* Primary: camera button */}
                    <button
                      type="button"
                      className="selfie-open-btn selfie-open-btn--camera"
                      onClick={() => setShowSelfieModal(true)}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                      Take or Upload Selfie
                    </button>

                    <p className="selfie-slot-note">
                      Camera or photo file · Face must be clearly visible
                    </p>
                  </div>
                )}
              </div>
            );
          }

          // ── Standard document slot ──────────────────────────────────────────
          return (
            <div
              key={slot.key}
              className={[
                'kyc-slot',
                hasFile    ? 'kyc-slot--filled' : '',
                isDragging ? 'kyc-slot--drag'   : '',
              ].filter(Boolean).join(' ')}
              onDragOver={e => { e.preventDefault(); setDragOver(slot.key); }}
              onDragLeave={() => setDragOver(null)}
              onDrop={e => onDrop(slot.key, e)}
              onClick={() => !hasFile && inputRefs.current[slot.key]?.click()}
            >
              <input
                type="file"
                accept={slot.accept}
                style={{ display: 'none' }}
                ref={el => (inputRefs.current[slot.key] = el)}
                onChange={e => handleFile(slot.key, e.target.files[0])}
              />

              {hasFile ? (
                <div className="kyc-slot-filled-inner">
                  {preview === 'pdf' ? (
                    <div className="kyc-pdf-preview">
                      <span>&#128196;</span>
                      <span className="kyc-pdf-name">{files[slot.key].name}</span>
                    </div>
                  ) : (
                    <img src={preview} alt={slot.label} className="kyc-img-preview" />
                  )}
                  <div className="kyc-slot-overlay">
                    <div className="kyc-slot-meta">
                      <span className="kyc-slot-check">&#10003;</span>
                      <span className="kyc-slot-label">{slot.label}</span>
                      <span className="kyc-slot-size">{formatBytes(files[slot.key].size)}</span>
                    </div>
                    <div className="kyc-slot-actions">
                      {preview !== 'pdf' && (
                        <button type="button" className="kyc-crop-btn"
                          onClick={e => { e.stopPropagation(); openCropModal(slot.key, files[slot.key]); }}>
                          &#9986; Crop
                        </button>
                      )}
                      <button type="button" className="kyc-remove-btn"
                        onClick={e => { e.stopPropagation(); removeFile(slot.key); }}>
                        &#10005; Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="kyc-slot-empty">
                  <div className="kyc-slot-icon">{slot.icon}</div>
                  <p className="kyc-slot-name">{slot.label}</p>
                  <p className="kyc-slot-hint">{slot.hint}</p>
                  <div className="kyc-upload-btn">
                    {isDragging ? 'Drop here' : 'Click or drag to upload'}
                  </div>
                  {slot.canCrop && <p className="kyc-slot-crop-note">Images can be cropped after selection</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="kyc-doc-nav">
        <button type="button" className="kyc-back-btn" onClick={() => goToStep(0)}>
          &#8592; Back
        </button>
        <button
          type="button"
          className={`kyc-submit-btn kyc-submit-btn--inline ${allUploaded ? 'kyc-submit-btn--ready' : ''}`}
          disabled={!allUploaded}
          onClick={() => goToStep(2)}
        >
          Review &amp; Submit &#8594;
        </button>
      </div>
    </div>
  );

  // ── Step 3: Review ────────────────────────────────────────────────────────────
  const renderReview = () => (
    <div className="kyc-section">
      <p className="kyc-section-desc">
        Review your details before submitting. Once submitted, your application will
        be reviewed by our team within 1–2 business days.
      </p>

      <div className="kyc-review-card">
        <div className="kyc-review-card-header">
          <span>&#128203;</span> Personal Details
          <button type="button" className="kyc-review-edit" onClick={() => goToStep(0)}>Edit</button>
        </div>
        <div className="kyc-review-rows">
          {FIELDS.map(f => (
            <div key={f.key} className="kyc-review-row">
              <span className="kyc-review-key">{f.label}</span>
              <span className="kyc-review-val kyc-review-val--mono">
                {f.key === 'aadhaarNumber'
                  ? fields[f.key].replace(/\d(?=\d{4})/g, '•')
                  : f.key === 'accountNumber'
                  ? '••••' + fields[f.key].slice(-4)
                  : fields[f.key]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="kyc-review-card">
        <div className="kyc-review-card-header">
          <span>&#128196;</span> Documents
          <button type="button" className="kyc-review-edit" onClick={() => goToStep(1)}>Edit</button>
        </div>
        <div className="kyc-review-doc-grid">
          {SLOTS.map(slot => {
            const preview = previews[slot.key];
            return (
              <div key={slot.key} className={`kyc-review-doc ${slot.isSelfie ? 'kyc-review-doc--selfie' : ''}`}>
                {preview === 'pdf' ? (
                  <div className="kyc-review-doc-pdf">&#128196;</div>
                ) : (
                  <img src={preview} alt={slot.label} className={`kyc-review-doc-img ${slot.isSelfie ? 'kyc-review-doc-img--selfie' : ''}`} />
                )}
                <p className="kyc-review-doc-label">{slot.label}</p>
                <p className="kyc-review-doc-size">{formatBytes(files[slot.key]?.size || 0)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selfie liveness warning at review stage */}
      {selfieWarning && (
        <div className="kyc-msg kyc-msg--warn">
          &#9888; {selfieWarning} The server will perform a final liveness check.
        </div>
      )}

      {submitting && (
        <div className="kyc-progress-wrap">
          <div className="kyc-progress-bar">
            <div className="kyc-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span className="kyc-progress-label">Uploading… {progress}%</span>
        </div>
      )}

      {serverMsg && (
        <div className={`kyc-msg kyc-msg--${serverMsg.type}`}>
          {serverMsg.type === 'success' ? '\u2713' : '\u26A0'} {serverMsg.text}
        </div>
      )}

      <div className="kyc-doc-nav">
        <button type="button" className="kyc-back-btn" onClick={() => { setStep(1); setServerMsg(null); }}>
          &#8592; Back
        </button>
        <button
          type="button"
          className="kyc-submit-btn kyc-submit-btn--ready kyc-submit-btn--inline"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting
            ? <><div className="kyc-btn-spinner" /> Submitting…</>
            : <><span>&#128272;</span> Submit KYC</>
          }
        </button>
      </div>

      <p className="kyc-privacy-note" style={{ marginTop: 16 }}>
        &#128274; Your documents are encrypted and used solely for identity verification.
        They are never shared with third parties.
      </p>
    </div>
  );

  // ── Main render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Crop modal */}
      <CropModal
        image={cropImageSrc}
        onClose={closeCropModal}
        onApply={handleCropApply}
        crop={crop}
        setCrop={setCrop}
        zoom={zoom}
        setZoom={setZoom}
        onCropComplete={handleCropComplete}
        initialAspect={cropInitialAspect}
        applying={applying}
        title={
          cropSlotKey === 'selfie'    ? 'Crop Selfie' :
          cropSlotKey === 'aadhaar'   ? 'Crop Aadhaar Card' :
          cropSlotKey === 'pan'       ? 'Crop PAN Card' :
          cropSlotKey === 'bank'      ? 'Crop Bank Passbook' :
          'Crop Image'
        }
      />

      {/* Selfie capture modal */}
      {showSelfieModal && (
        <SelfieCapture
          onFileReady={handleSelfieFileReady}
          onCancel={() => setShowSelfieModal(false)}
        />
      )}

      <div className="kyc-root">
        <div className="kyc-header">
          <div className="kyc-header-left">
            <div className="kyc-shield">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" />
              </svg>
            </div>
            <div>
              <h2 className="kyc-title">Identity Verification</h2>
              <p className="kyc-subtitle">Secure · Encrypted · Confidential</p>
            </div>
          </div>
          <div className="kyc-badge" style={{ color: meta.color, background: meta.bg }}>
            {meta.label}
          </div>
        </div>

        {!canResubmit && (
          <div className="kyc-status-panel" style={{ borderColor: meta.color + '44', background: meta.bg }}>
            {status === KYC_STATUSES.VERIFIED && (
              <div className="kyc-verified-block">
                <div className="kyc-verified-icon">&#10003;</div>
                <div>
                  <p className="kyc-verified-title">KYC Verified</p>
                  {kycData?.verifiedAt && (
                    <p className="kyc-verified-date">
                      Verified on{' '}
                      {new Date(kycData.verifiedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              </div>
            )}
            {status === KYC_STATUSES.SUBMITTED && (
              <div className="kyc-pending-block">
                <div className="kyc-spinner" />
                <div>
                  <p className="kyc-pending-title">Review in Progress</p>
                  <p className="kyc-pending-sub">Our team is verifying your documents. This usually takes 24–48 hours.</p>
                </div>
              </div>
            )}
          </div>
        )}

        {status === KYC_STATUSES.REJECTED && kycData?.rejectionReason && (
          <div className="kyc-rejection-banner">
            <span className="kyc-rejection-icon">&#9888;</span>
            <div>
              <strong>Rejection Reason:</strong>
              <p>{kycData.rejectionReason}</p>
            </div>
          </div>
        )}

        {canResubmit && (
          <>
            <StepBar />
            {step === 0 && renderDetails()}
            {step === 1 && renderDocuments()}
            {step === 2 && renderReview()}
          </>
        )}
      </div>
    </>
  );
}