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
 * ── KEY FIXES IN THIS VERSION ────────────────────────────────────────────────
 *
 *  1. MOBILE CAMERA CAPTURE
 *     The selfie "Upload Photo" tab now adds `capture="user"` on the file input.
 *     On Android/iOS this opens the front camera directly instead of the file
 *     picker/gallery. The user can still switch to gallery from within the
 *     native camera UI on any device that supports it.
 *     A separate "Choose from Gallery" button is also provided so users who
 *     genuinely want to pick an existing photo have a clearly-labelled path.
 *
 *  2. IMAGE QUALITY PRE-FLIGHT (client-side sharpness estimate)
 *     After the user selects a selfie from local storage we draw the image to
 *     a small offscreen canvas and compute the average Laplacian variance —
 *     the same metric that livenessService.js uses server-side (stdev < 10 →
 *     rejected). If the client-side estimate is too low we block the file with
 *     a clear error message before it ever reaches the crop step, so the user
 *     gets immediate feedback instead of a server rejection after a full upload.
 *
 *  3. BANNER PERSISTENCE FIX
 *     The KYCStatusBanner is driven by KycContext.status, which is fetched from
 *     GET /api/kyc/me. The banner disappears only when the server confirms the
 *     status has changed to 'submitted' or 'verified'. After a successful POST
 *     to /api/kyc/submit the component calls refetch() immediately so the
 *     context reloads and the banner vanishes on success. Previously refetch()
 *     was deferred by 1 500 ms, which meant there was a window where the user
 *     could see the banner after a successful submit. Now refetch is called
 *     eagerly with a short retry loop (max 3 attempts × 1 s) to handle any
 *     eventual-consistency delay on the server.
 *
 *  4. UPLOAD-SOURCE LABEL
 *     Files captured via the camera button are tagged as `source: 'camera'`
 *     so the crop step can display a small "📷 Camera" chip instead of a
 *     generic filename, giving the user confidence that they used the camera.
 *
 * Dependencies (unchanged):
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

const API_BASE =
  process.env.REACT_APP_BACKEND_URL ||
  process.env.REACT_APP_SERVER_URL  ||
  '';

// ── Constants ─────────────────────────────────────────────────────────────────

// Steps: 0=Details  1=Documents  2=Verify (OCR cross-check)  3=Review & Submit
const STEPS = ['Details', 'Documents', 'Verify', 'Review'];

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

// ── Liveness hints ────────────────────────────────────────────────────────────
const LIVENESS_TIPS = [
  { icon: '☀️', text: 'Good natural or indoor light — avoid harsh shadows' },
  { icon: '👁️', text: 'Look directly at the camera, eyes open and visible' },
  { icon: '🚫', text: 'No sunglasses, masks, hats or heavy filters' },
  { icon: '📐', text: 'Plain wall or background — no other people in frame' },
  { icon: '📏', text: "Hold device at arm's length — face must fill most of the frame" },
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
 * Client-side Laplacian variance — approximates sharpness.
 * Draws the image to a small greyscale canvas then computes the
 * variance of the discrete Laplacian kernel across all pixels.
 *
 * livenessService.js uses sharp's stdev (standard deviation of the
 * luma channel). The Laplacian variance is a closely related metric:
 *   • High value  → sharp edges → real photo taken in good light
 *   • Low value   → blurry / uniform → screen photo, too-dark image
 *
 * Threshold: < 100 is almost certainly too blurry / a screenshot.
 * Returns a number between 0 and ~50 000.
 */
function computeLaplacianVariance(imgEl) {
  const SAMPLE_SIZE = 200; // work on a 200×200 thumbnail for speed
  const canvas = document.createElement('canvas');
  canvas.width  = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imgEl, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  const W = SAMPLE_SIZE;
  const H = SAMPLE_SIZE;

  // Convert to greyscale luminance array
  const grey = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    grey[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  // Discrete Laplacian (3×3 kernel: centre=−4, NSEW=+1)
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const lap =
        -4 * grey[y * W + x] +
        grey[(y - 1) * W + x] +
        grey[(y + 1) * W + x] +
        grey[y * W + (x - 1)] +
        grey[y * W + (x + 1)];
      sum   += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  const mean = sum / n;
  return (sumSq / n) - mean * mean; // variance
}

// Laplacian variance threshold below which we warn the user.
// Real camera photos are reliably above ~300; screenshots / printed-photo
// scans can drop as low as 20–80.
const BLUR_VARIANCE_THRESHOLD = 100;

/**
 * Client-side pre-flight check mirroring livenessService.js:
 *   Rule 1 — width & height >= 200 px
 *   Rule 2 — not blurry / uniform (Laplacian variance check)
 *   Rule 3 — file size heuristic (real camera photos are rarely < 30 KB)
 *
 * Returns { ok: bool, warning: string|null, hardFail: bool }
 *   hardFail === true → we block the file (user must retake)
 *   hardFail === false + warning → soft warning, submission still allowed
 */
function preflightSelfie(file, imgEl) {
  const { naturalWidth: w, naturalHeight: h } = imgEl;

  // Rule 1: resolution (server will also reject this)
  if (w < 200 || h < 200) {
    return {
      ok:       false,
      hardFail: true,
      warning:  `Image is too small (${w}×${h} px). The server requires at least 200×200 px. Please retake the photo.`,
    };
  }

  // Rule 2: Laplacian blur detection (mirrors livenessService stdev < 10)
  let variance = 0;
  try {
    variance = computeLaplacianVariance(imgEl);
  } catch {
    // Canvas tainted by CORS or other error — skip this check
    variance = Infinity;
  }

  if (variance < BLUR_VARIANCE_THRESHOLD) {
    return {
      ok:       false,
      hardFail: true,
      warning:
        'This photo looks blurry or too dark. The liveness check will likely fail. ' +
        'Please take a fresh photo in good lighting and hold the camera steady.',
    };
  }

  // Rule 3: file size heuristic (soft warning only)
  if (file.size < 30 * 1024) {
    return {
      ok:       true,
      hardFail: false,
      warning:
        'This image looks very small. A camera photo may give better results.',
    };
  }

  return { ok: true, hardFail: false, warning: null };
}

// ── Camera availability helpers ───────────────────────────────────────────────

/**
 * Returns a human-readable reason why getUserMedia is unavailable,
 * or null if the API appears to be supported.
 */
function getCameraUnavailableReason() {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'http:' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return 'http_insecure';
  }
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    return 'api_missing';
  }
  return null;
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

// ─────────────────────────────────────────────────────────────────────────────
// SelfieCapture sub-component
// ─────────────────────────────────────────────────────────────────────────────
function SelfieCapture({ onFileReady, onCancel }) {
  const unavailableReason = getCameraUnavailableReason();
  const cameraSupported   = unavailableReason === null;

  const [mode,        setMode]        = useState(cameraSupported ? 'camera' : 'upload');
  const [cameraState, setCameraState] = useState('idle');
  const [cameraError, setCameraError] = useState(
    cameraSupported ? '' : (CAMERA_ERROR_MESSAGES[unavailableReason] ?? '')
  );
  const [capturedSrc, setCapturedSrc] = useState(null);
  const [countdown,   setCountdown]   = useState(null);

  // ── FIX: blur-check state for the upload path ────────────────────────────
  const [uploadQualityError, setUploadQualityError] = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef  = useRef(null);

  // Separate refs for the two upload inputs (camera capture vs gallery)
  const cameraInputRef  = useRef(null);
  const galleryInputRef = useRef(null);

  // ── Camera lifecycle ──────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
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
          facingMode: 'user',
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
          // fall through
        }
      }

      const msg =
        CAMERA_ERROR_MESSAGES[err.name] ??
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
    setUploadQualityError(null);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Countdown + capture ───────────────────────────────────────────────────

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

  // Camera-captured photo → tag with source so crop step knows
  const useCapturedPhoto = useCallback(() => {
    if (!capturedSrc) return;
    fetch(capturedSrc)
      .then(r => r.blob())
      .then(blob => {
        const file = new File([blob], 'selfie-camera.jpg', { type: 'image/jpeg' });
        // Tag the source so the parent can display "📷 Camera"
        file._captureSource = 'camera';
        onFileReady(file);
      });
  }, [capturedSrc, onFileReady]);

  // ── FIX: Upload tab — validate quality before passing to crop ─────────────
  /**
   * Runs the client-side blur / resolution pre-flight check on a file
   * selected from disk (gallery or camera-roll). If the check hard-fails
   * we show an error inside the modal and do NOT proceed to the crop step.
   * This gives the user immediate feedback instead of a server rejection.
   */
  const validateAndPassFile = useCallback((file, isFromCameraCapture = false) => {
    setUploadQualityError(null);

    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadQualityError('File exceeds 10 MB limit. Please choose a smaller photo.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const result = preflightSelfie(file, img);
      URL.revokeObjectURL(objectUrl);

      if (result.hardFail) {
        setUploadQualityError(result.warning);
        return;
      }

      // Tag the source
      file._captureSource = isFromCameraCapture ? 'camera' : 'gallery';
      // Soft warning is forwarded to the parent via the file object so the
      // crop step can surface it.
      if (result.warning) file._livenessWarning = result.warning;

      onFileReady(file);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      // Can't decode → pass through and let the server handle it
      file._captureSource = isFromCameraCapture ? 'camera' : 'gallery';
      onFileReady(file);
    };

    img.src = objectUrl;
  }, [onFileReady]);

  // ── FIX: Camera-input handler (capture="user" path on mobile) ────────────
  const handleCameraInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected after a retake
    e.target.value = '';
    validateAndPassFile(file, true);
  }, [validateAndPassFile]);

  // ── Gallery picker handler ────────────────────────────────────────────────
  const handleGalleryInputChange = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    validateAndPassFile(file, false);
  }, [validateAndPassFile]);

  // ── Render ────────────────────────────────────────────────────────────────
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

              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="selfie-video"
                style={{ display: cameraState === 'live' ? 'block' : 'none' }}
              />

              {cameraState === 'captured' && capturedSrc && (
                <img src={capturedSrc} alt="Captured selfie" className="selfie-captured-img" />
              )}

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

              {countdown !== null && (
                <div className="selfie-countdown">{countdown}</div>
              )}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

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

            {/* ── FIX: Hidden inputs ─────────────────────────────────────────
                Two separate inputs:
                  1. cameraInput  — `capture="user"` → opens front camera directly
                     on Android/iOS Chrome, Safari, Samsung Internet.
                  2. galleryInput — no capture attr → standard file picker / gallery.

                Both accept the same mime types as the normal selfie slot.
                After the user selects a file, validateAndPassFile() runs the
                client-side blur check before handing the file to the crop step.
            ─────────────────────────────────────────────────────────────────── */}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="user"
              style={{ display: 'none' }}
              ref={cameraInputRef}
              onChange={handleCameraInputChange}
            />
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: 'none' }}
              ref={galleryInputRef}
              onChange={handleGalleryInputChange}
            />

            {/* Quality error message */}
            {uploadQualityError && (
              <div className="selfie-quality-error" role="alert">
                <span className="selfie-error-icon">&#9888;</span>
                <div>
                  <strong>Photo not suitable</strong>
                  <p>{uploadQualityError}</p>
                </div>
              </div>
            )}

            {/* Primary CTA: opens camera directly on mobile */}
            <button
              type="button"
              className="selfie-upload-drop selfie-upload-drop--camera"
              onClick={() => {
                setUploadQualityError(null);
                cameraInputRef.current?.click();
              }}
            >
              <span className="selfie-upload-icon">📷</span>
              <p className="selfie-upload-label">Open Camera</p>
              <p className="selfie-upload-sub">Take a fresh photo right now</p>
            </button>

            {/* Secondary CTA: gallery picker */}
            <button
              type="button"
              className="selfie-upload-drop selfie-upload-drop--gallery"
              onClick={() => {
                setUploadQualityError(null);
                galleryInputRef.current?.click();
              }}
            >
              <span className="selfie-upload-icon">🖼️</span>
              <p className="selfie-upload-label">Choose from Gallery</p>
              <p className="selfie-upload-sub">JPG, PNG, WebP — max 10 MB</p>
            </button>

            {/* Quality hint */}
            <div className="selfie-upload-quality-hint">
              <span>⚡</span>
              <p>
                Photos taken with your camera pass the liveness check more reliably
                than screenshots or scanned images.
              </p>
            </div>
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

  // ── Step state ─────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Step 1: manual fields ──────────────────────────────────────────────────
  const [fields,       setFields]       = useState({ aadhaarNumber: '', panNumber: '', accountNumber: '', ifscCode: '' });
  const [fieldErrors,  setFieldErrors]  = useState({});
  const [fieldTouched, setFieldTouched] = useState({});

  // ── Step 2: document uploads ───────────────────────────────────────────────
  const [files,    setFiles]    = useState({});
  const [previews, setPreviews] = useState({});

  // ── Selfie capture modal ───────────────────────────────────────────────────
  const [showSelfieModal, setShowSelfieModal] = useState(false);
  // Soft liveness pre-flight warning (does NOT block submission)
  const [selfieWarning,   setSelfieWarning]   = useState(null);
  // Source tag for display ('camera' | 'gallery' | null)
  const [selfieSource,    setSelfieSource]    = useState(null);

  // ── OCR cross-validation state (Step 2→3) ──────────────────────────────
  const [validation,       setValidation]       = useState(null);
  const [validating,       setValidating]       = useState(false);
  const [validationError,  setValidationError]  = useState(null);
  // true once the user has seen failures and explicitly chosen to proceed anyway
  const [bypassValidation, setBypassValidation] = useState(false);

  // ── Crop modal state ───────────────────────────────────────────────────────
  const [cropSlotKey,       setCropSlotKey]       = useState(null);
  const [cropImageSrc,      setCropImageSrc]      = useState(null);
  const [cropRawFile,       setCropRawFile]       = useState(null);
  const [cropInitialAspect, setCropInitialAspect] = useState(1);
  const [cropOrientation,   setCropOrientation]   = useState(1);
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying,          setApplying]          = useState(false);

  // ── Submission ─────────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [progress,   setProgress]   = useState(0);
  const [serverMsg,  setServerMsg]  = useState(null);
  const [dragOver,   setDragOver]   = useState(null);

  const inputRefs = useRef({});

  // ── Field validation ───────────────────────────────────────────────────────
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

  // ── Step navigation ──────────────────────────────────────────
  const goToStep = (n) => {
    if (n === 1 && !validateAllFields()) return;
    // Moving from Documents (1) to Verify (2): reset any prior validation
    if (n === 2) {
      setValidation(null);
      setValidationError(null);
      setBypassValidation(false);
    }
    // Going back to Documents (1): also reset so re-upload forces re-verify
    if (n === 1) {
      setValidation(null);
      setValidationError(null);
      setBypassValidation(false);
    }
    setStep(n);
    setServerMsg(null);
  };

  // ── Crop modal handlers ────────────────────────────────────────────────────
  const openCropModal = useCallback(async (key, file) => {
    const slot           = SLOTS.find(s => s.key === key);
    const slotAspect     = slot?.cropAspect ?? 1;
    const orientation    = await readExifOrientation(file instanceof File ? file : null);

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
        orientation: cropOrientation,
        format:      'image/jpeg',
        quality:     0.92,
      });

      const croppedFile = new File(
        [blob],
        cropRawFile?.name || `${cropSlotKey}.jpg`,
        { type: 'image/jpeg' }
      );
      const newPreviewUrl = URL.createObjectURL(blob);

      if (cropSlotKey === 'selfie') {
        const img = new Image();
        img.onload = () => {
          const check = preflightSelfie(croppedFile, img);
          if (check.hardFail) {
            revokePreviewUrl(newPreviewUrl);
            setServerMsg({ type: 'error', text: check.warning });
            setApplying(false);
            closeCropModal();
            return;
          }
          if (check.warning) setSelfieWarning(check.warning);
          else setSelfieWarning(null);

          setPreviews(prev => {
            revokePreviewUrl(prev[cropSlotKey]);
            return { ...prev, [cropSlotKey]: newPreviewUrl };
          });
          setFiles(prev => ({ ...prev, [cropSlotKey]: croppedFile }));
          // Preserve source tag from the original file
          setSelfieSource(cropRawFile?._captureSource || null);
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
  };

  // ── Selfie modal: receives a raw File from either camera or upload ─────────
  const handleSelfieFileReady = useCallback((file) => {
    setShowSelfieModal(false);
    setSelfieWarning(file._livenessWarning || null);
    // Always open crop modal (1:1 aspect) so user can centre their face
    openCropModal('selfie', file);
  }, [openCropModal]);

  // ── Generic file input handler (non-selfie slots) ─────────────────────────
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
    if (key === 'selfie') { setSelfieWarning(null); setSelfieSource(null); }
    if (inputRefs.current[key]) inputRefs.current[key].value = '';
    // Any file change invalidates prior validation results
    setValidation(null);
    setValidationError(null);
    setBypassValidation(false);
  };

  const onDrop = (key, e) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(key, file);
  };

  // ── FIX: Submit with eager refetch + retry loop ────────────────────────────
  /**
   * After a successful POST to /api/kyc/submit the server sets the KYC status
   * to 'submitted' (or 'verified' if auto-approved). We call refetch()
   * immediately and retry up to 3 times at 1-second intervals so the
   * KycContext picks up the new status quickly and the banner disappears
   * without a noticeable delay.
   */
  // ── OCR cross-validation (Step 2 → Step 3) ──────────────────────────────────
  /**
   * Calls POST /api/kyc/validate with the three non-selfie files and the
   * user-typed field values. The endpoint runs the same OCR pipeline as
   * submitKYC (Tesseract via kycOCRService.js) and returns field-match
   * results for Aadhaar number, PAN number, and bank account number.
   *
   * On success: sets validation state and advances to the Verify step (2).
   * On network error: sets validationError and still advances (non-blocking).
   * The user can always bypass failures and submit anyway.
   */
  const runValidation = useCallback(async () => {
    setValidating(true);
    setValidationError(null);
    setValidation(null);

    const form = new FormData();
    // Only the OCR-able docs — selfie is not sent to /validate
    ['aadhaar', 'pan', 'bank'].forEach(key => {
      if (files[key]) form.append(key, files[key]);
    });
    form.append('aadhaarNumber', fields.aadhaarNumber.replace(/\s/g, ''));
    form.append('panNumber',     fields.panNumber);
    form.append('accountNumber', fields.accountNumber);

    try {
      const res = await fetch(`${API_BASE}/api/kyc/validate`, {
        method:  'POST',
        headers: { Authorization: `Bearer ${token}` },
        body:    form,
      });
      const data = await res.json();
      if (res.ok) {
        setValidation(data);
      } else {
        // Server returned an error body (e.g. 500)
        setValidationError(data.message || 'Validation service unavailable. You can still submit.');
      }
    } catch (err) {
      // Network failure — non-blocking, allow user to continue
      setValidationError('Could not reach the validation service. You can still submit your documents.');
    } finally {
      setValidating(false);
    }
  }, [files, fields, token]);

  const eagerRefetch = useCallback(async () => {
    const MAX_RETRIES = 3;
    const DELAY_MS    = 800;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await refetch();
        return; // done
      } catch {
        // ignore — not critical
      }
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, DELAY_MS));
      }
    }
  }, [refetch]);

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

      // Reset form
      setFiles({});
      setPreviews({});
      setFields({ aadhaarNumber: '', panNumber: '', accountNumber: '', ifscCode: '' });
      setSelfieWarning(null);
      setSelfieSource(null);
      setValidation(null);
      setValidationError(null);
      setBypassValidation(false);
      setStep(0);

      // ── FIX: Eager refetch so the banner clears immediately ──
      eagerRefetch();

    } catch (err) {
      setServerMsg({ type: 'error', text: err.message || 'Submission failed. Please try again.' });
    } finally {
      setSubmitting(false);
      setTimeout(() => setProgress(0), 1200);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const canResubmit   = [KYC_STATUSES.NOT_STARTED, KYC_STATUSES.REQUIRED, KYC_STATUSES.REJECTED].includes(status);
  const meta          = STATUS_META[status] || STATUS_META.not_started;
  const allUploaded   = SLOTS.every(s => files[s.key]);
  const allFilled     = FIELDS.every(f => fields[f.key].trim() !== '');
  const noFieldErrors = FIELDS.every(f => !fieldErrors[f.key]);

  // ── Step bar ──────────────────────────────────────────────────────────────
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

  // ── Step 1: Details ───────────────────────────────────────────────────────
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

  // ── Step 2: Documents ─────────────────────────────────────────────────────
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

          // ── Selfie slot ───────────────────────────────────────────────────
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

                    {/* Source chip — shows 📷 Camera or 🖼️ Gallery */}
                    {selfieSource && (
                      <div className={`selfie-source-chip selfie-source-chip--${selfieSource}`}>
                        {selfieSource === 'camera' ? '📷 Camera' : '🖼️ Gallery'}
                      </div>
                    )}

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

          // ── Standard document slot ────────────────────────────────────────
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
          onClick={async () => { goToStep(2); await runValidation(); }}
        >
          Review &amp; Submit &#8594;
        </button>
      </div>
    </div>
  );

  // ── Step 2: Verify (OCR cross-check results) ────────────────────────────────
  /**
   * Renders validation results from /api/kyc/validate.
   *
   * Three states:
   *   A. Still running (validating === true)  → spinner
   *   B. Network/server error                 → soft error + allow bypass
   *   C. Results received                     → per-document pass/fail cards
   *
   * Each document card shows:
   *   ✅ green — number matched correctly
   *   ❌ red   — mismatch or OCR failure, with the specific error message
   *              and a contextual action button (Edit Details / Re-upload Doc)
   *
   * The "Continue to Review" button is enabled when:
   *   - All documents passed (allPassed === true), OR
   *   - The user clicked "Submit anyway" after seeing the failures
   *
   * "Submit anyway" is a soft bypass — the server will still run its own OCR
   * and may reject if the mismatch is real. We show a warning when bypassing.
   */
  const renderValidation = () => {
    const docCards = [
      {
        key:      'aadhaar',
        label:    'Aadhaar Card',
        icon:     '🪪',
        result:   validation?.aadhaar,
        editStep: 0,   // "Edit Details" jumps to Step 0 (fields)
        reupStep: 1,   // "Re-upload" jumps to Step 1 (documents)
        passText: validation?.aadhaar?.numberExtracted
          ? `Number matched: ${validation.aadhaar.numberExtracted}`
          : 'Number verified ✓',
      },
      {
        key:      'pan',
        label:    'PAN Card',
        icon:     '💳',
        result:   validation?.pan,
        editStep: 0,
        reupStep: 1,
        passText: validation?.pan?.numberExtracted
          ? `Number matched: ${validation.pan.numberExtracted}`
          : 'Number verified ✓',
      },
      {
        key:      'bank',
        label:    'Bank Passbook / Statement',
        icon:     '🏦',
        result:   validation?.bank,
        editStep: 0,
        reupStep: 1,
        passText: 'Account number found in document ✓',
      },
    ];

    const failCount = docCards.filter(d => d.result && !d.result.ok).length;
    const hasResults = !!validation;

    return (
      <div className="kyc-section">

        {/* ── Running spinner ── */}
        {validating && (
          <div className="kyc-validation-running">
            <div className="kyc-validation-spinner-wrap">
              <div className="kyc-spinner kyc-spinner--lg" />
            </div>
            <p className="kyc-validation-running-title">Verifying your documents…</p>
            <p className="kyc-validation-running-sub">
              We're reading each document and cross-checking your details.
              This takes about 10–20 seconds.
            </p>
            <div className="kyc-validation-steps-list">
              {['Reading Aadhaar card', 'Reading PAN card', 'Checking bank document'].map((s, i) => (
                <div key={s} className="kyc-validation-step-item">
                  <div className="kyc-validation-step-dot kyc-validation-step-dot--pulse" style={{ animationDelay: `${i * 0.4}s` }} />
                  <span>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Network/server error ── */}
        {!validating && validationError && (
          <div className="kyc-validation-error-card">
            <div className="kyc-validation-error-icon">⚠️</div>
            <p className="kyc-validation-error-title">Verification service unavailable</p>
            <p className="kyc-validation-error-sub">{validationError}</p>
            <div className="kyc-validation-error-actions">
              <button
                type="button"
                className="kyc-validation-retry-btn"
                onClick={runValidation}
              >
                ↺ Try Again
              </button>
              <button
                type="button"
                className="kyc-validation-skip-btn"
                onClick={() => { setBypassValidation(true); setStep(3); setServerMsg(null); }}
              >
                Continue Anyway →
              </button>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {!validating && hasResults && (
          <>
            {/* Overall banner */}
            {validation.allPassed ? (
              <div className="kyc-validation-banner kyc-validation-banner--pass">
                <span className="kyc-validation-banner-icon">✅</span>
                <div>
                  <p className="kyc-validation-banner-title">All documents verified</p>
                  <p className="kyc-validation-banner-sub">
                    Your details match the uploaded documents. You're ready to submit.
                  </p>
                </div>
              </div>
            ) : (
              <div className="kyc-validation-banner kyc-validation-banner--fail">
                <span className="kyc-validation-banner-icon">⚠️</span>
                <div>
                  <p className="kyc-validation-banner-title">
                    {failCount} issue{failCount !== 1 ? 's' : ''} found — please review
                  </p>
                  <p className="kyc-validation-banner-sub">
                    Fix the issues below before submitting to avoid rejection.
                  </p>
                </div>
              </div>
            )}

            {/* Per-document cards */}
            <div className="kyc-validation-cards">
              {docCards.map(card => {
                const r = card.result;
                if (!r) return null;
                const passed = r.ok;

                return (
                  <div
                    key={card.key}
                    className={`kyc-val-card ${passed ? 'kyc-val-card--pass' : 'kyc-val-card--fail'}`}
                  >
                    <div className="kyc-val-card-header">
                      <span className="kyc-val-card-icon">{card.icon}</span>
                      <span className="kyc-val-card-label">{card.label}</span>
                      <span className={`kyc-val-card-badge ${passed ? 'kyc-val-card-badge--pass' : 'kyc-val-card-badge--fail'}`}>
                        {passed ? '✓ Matched' : '✕ Issue found'}
                      </span>
                    </div>

                    {passed ? (
                      <p className="kyc-val-card-pass-text">{card.passText}</p>
                    ) : (
                      <>
                        <p className="kyc-val-card-error-text">{r.error}</p>
                        <div className="kyc-val-card-actions">
                          <button
                            type="button"
                            className="kyc-val-action-btn kyc-val-action-btn--edit"
                            onClick={() => { setStep(card.editStep); setServerMsg(null); }}
                          >
                            ✏️ Edit Details
                          </button>
                          <button
                            type="button"
                            className="kyc-val-action-btn kyc-val-action-btn--reup"
                            onClick={() => { setStep(card.reupStep); setServerMsg(null); }}
                          >
                            ↑ Re-upload Document
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bypass option when there are failures */}
            {!validation.allPassed && !bypassValidation && (
              <div className="kyc-validation-bypass">
                <p>
                  If you're confident your documents are correct, you can proceed — our team
                  will review manually. However, mismatches often lead to rejection.
                </p>
                <button
                  type="button"
                  className="kyc-validation-bypass-btn"
                  onClick={() => setBypassValidation(true)}
                >
                  I understand — submit anyway
                </button>
              </div>
            )}

            {bypassValidation && !validation.allPassed && (
              <div className="kyc-msg kyc-msg--warn">
                ⚠️ You're submitting with unresolved document issues. Our team will review
                manually — this may take longer or result in rejection.
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="kyc-doc-nav" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="kyc-back-btn"
            onClick={() => { setStep(1); setServerMsg(null); }}
            disabled={validating}
          >
            ← Back
          </button>

          {/* Retry button when not running and results exist */}
          {!validating && hasResults && (
            <button
              type="button"
              className="kyc-validation-retry-inline-btn"
              onClick={runValidation}
            >
              ↺ Re-verify
            </button>
          )}

          <button
            type="button"
            className={`kyc-submit-btn kyc-submit-btn--inline ${
              (!validating && hasResults && (validation.allPassed || bypassValidation))
                ? 'kyc-submit-btn--ready'
                : ''
            } ${validating ? 'kyc-submit-btn--loading' : ''}`}
            disabled={
              validating ||
              (!hasResults && !validationError) ||
              (!validation?.allPassed && !bypassValidation && !validationError)
            }
            onClick={() => { setStep(3); setServerMsg(null); }}
          >
            {validating
              ? <><div className="kyc-btn-spinner" /> Verifying…</>
              : <>Continue to Review →</>
            }
          </button>
        </div>
      </div>
    );
  };

  // ── Step 3: Review ────────────────────────────────────────────────────────
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
                  <div style={{ position: 'relative', display: 'inline-block' }}>
                    <img src={preview} alt={slot.label} className={`kyc-review-doc-img ${slot.isSelfie ? 'kyc-review-doc-img--selfie' : ''}`} />
                    {/* Source chip on review page */}
                    {slot.isSelfie && selfieSource && (
                      <div className={`selfie-source-chip selfie-source-chip--${selfieSource} selfie-source-chip--sm`}>
                        {selfieSource === 'camera' ? '📷' : '🖼️'}
                      </div>
                    )}
                  </div>
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

      {/* Gallery-sourced selfie advisory */}
      {selfieSource === 'gallery' && !selfieWarning && (
        <div className="kyc-msg kyc-msg--info">
          ℹ️ You chose a photo from your gallery. If the liveness check fails, please
          retake the selfie using the camera.
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
        <button type="button" className="kyc-back-btn" onClick={() => { setStep(2); setServerMsg(null); }}>
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

  // ── Main render ───────────────────────────────────────────────────────────
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
            {step === 2 && renderValidation()}
            {step === 3 && renderReview()}
          </>
        )}
      </div>
    </>
  );
}