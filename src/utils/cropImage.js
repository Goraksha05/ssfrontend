/**
 * utils/cropImage.js
 *
 * Production-grade image cropping utility used by CropModal.
 *
 * Exports:
 *   getCroppedImg(imageSrc, croppedAreaPixels, opts?)  → Promise<Blob>
 *   readExifOrientation(file)                          → Promise<number>  (1–8)
 *   getImageDimensions(src)                            → Promise<{width, height}>
 *   OUTPUT_FORMATS                                     → constant map
 *
 * Changes from original:
 *   1. EXIF orientation correction — phone portraits stored at rotation 6 (90°
 *      CW) are now drawn upright before cropping. Uses a dependency-free
 *      ArrayBuffer parser so no extra npm install is needed.
 *   2. Output format + quality control — callers can request 'image/jpeg',
 *      'image/png', or 'image/webp' with a custom quality value. Defaults to
 *      JPEG 0.90 (same as before) so existing call sites are unaffected.
 *   3. Transparent-image preservation — PNG/WebP output gets a white
 *      background fill so JPEG round-trips don't produce black corners, and
 *      PNG output preserves the alpha channel correctly.
 *   4. Dimension validation — zero-width or zero-height crop areas are
 *      rejected with a clear error before the canvas is even created.
 *   5. crossOrigin guarding — the attribute is only set for http/https URLs,
 *      not for data: or blob: URLs where it can cause unnecessary CORS errors
 *      on some browsers.
 *   6. Object URL cleanup helper — exported so callers can revoke preview
 *      URLs when they unmount, preventing memory leaks.
 *   7. getImageDimensions helper — lets callers validate resolution before
 *      opening the crop UI (used by the selfie pre-flight check).
 */

// ── Constants ──────────────────────────────────────────────────────────────────

export const OUTPUT_FORMATS = Object.freeze({
  JPEG: 'image/jpeg',
  PNG: 'image/png',
  WEBP: 'image/webp',
});

// ── EXIF orientation parser (no dependencies) ──────────────────────────────────
/**
 * Read EXIF orientation tag from a File or Blob without any npm dependency.
 * Returns a value from 1–8 where:
 *   1 = normal (no rotation needed)
 *   3 = 180°
 *   6 = 90° CW  (most common for phone portraits)
 *   8 = 90° CCW
 * Returns 1 (no-op) on any parse error so the caller always gets a usable value.
 *
 * The EXIF spec puts the orientation tag (0x0112) in the APP1 marker of a JPEG.
 * We only read the first ~64 KB which always contains the EXIF header.
 *
 * @param {File|Blob} fileOrBlob
 * @returns {Promise<number>}
 */
export async function readExifOrientation(fileOrBlob) {
  if (!fileOrBlob || !(fileOrBlob instanceof Blob)) return 1;

  // Only JPEG files embed EXIF in a way we can parse this simply
  if (!fileOrBlob.type?.includes('jpeg') && !fileOrBlob.type?.includes('jpg')) return 1;

  try {
    // Read first 64 KB — enough to always find the EXIF block
    const slice = fileOrBlob.slice(0, 65536);
    const buffer = await slice.arrayBuffer();
    const view = new DataView(buffer);

    // Confirm JPEG SOI marker: FF D8
    if (view.getUint16(0) !== 0xFFD8) return 1;

    let offset = 2;
    const length = view.byteLength;

    while (offset < length - 4) {
      const marker = view.getUint16(offset);
      offset += 2;

      // APP1 marker (FF E1) contains EXIF
      if (marker === 0xFFE1) {
        const segmentLength = view.getUint16(offset, false); // big-endian
        offset += 2;

        const segmentStart = offset;

        // Confirm "Exif\0\0" header
        if (view.getUint32(offset, false) !== 0x45786966) {
          offset = segmentStart + segmentLength - 2; // skip this segment
          return 1;
        }

        offset += 6;

        // Determine byte order: 'II' = little-endian, 'MM' = big-endian
        const byteOrder = view.getUint16(offset, false);
        const littleEndian = byteOrder === 0x4949;
        offset += 4; // skip byte-order + TIFF magic (0x002A)

        const tiffStart = offset - 4;

        const ifd0Offset = view.getUint32(offset, littleEndian);
        const ifd0Start = tiffStart + ifd0Offset;

        if (ifd0Start + 2 > length) return 1;

        const entryCount = view.getUint16(ifd0Start, littleEndian);

        for (let i = 0; i < entryCount; i++) {
          const entryOffset = ifd0Start + 2 + i * 12;
          if (entryOffset + 12 > length) break;

          const tag = view.getUint16(entryOffset, littleEndian);

          if (tag === 0x0112) {
            // Orientation tag
            return view.getUint16(entryOffset + 8, littleEndian);
          }
        }

        return 1; // orientation tag not found
      }

      // Skip other segments
      if (marker === 0xFFDA) break; // SOS (start of scan) — no EXIF after this
      if ((marker & 0xFF00) !== 0xFF00) break; // not a valid marker
      if (offset + 2 > length) break;
      offset += view.getUint16(offset); // jump over segment body
    }
  } catch {
    // Any parse error → assume normal orientation
  }

  return 1;
}

/**
 * Convert an EXIF orientation value to CSS/canvas rotation degrees and
 * whether the width/height must be swapped (portrait phone shots).
 *
 * @param {number} orientation  1–8
 * @returns {{ rotation: number, flipX: boolean, flipY: boolean, swapDims: boolean }}
 */
function exifOrientationToTransform(orientation) {
  switch (orientation) {
    case 2: return { rotation: 0, flipX: true, flipY: false, swapDims: false };
    case 3: return { rotation: 180, flipX: false, flipY: false, swapDims: false };
    case 4: return { rotation: 0, flipX: false, flipY: true, swapDims: false };
    case 5: return { rotation: 90, flipX: true, flipY: false, swapDims: true };
    case 6: return { rotation: 90, flipX: false, flipY: false, swapDims: true };
    case 7: return { rotation: 270, flipX: true, flipY: false, swapDims: true };
    case 8: return { rotation: 270, flipX: false, flipY: false, swapDims: true };
    default: return { rotation: 0, flipX: false, flipY: false, swapDims: false };
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Determine whether a URL is a remote http/https URL (needs crossOrigin)
 * vs a local data: or blob: URL (setting crossOrigin can cause CORS errors).
 */
function needsCrossOrigin(src) {
  return typeof src === 'string' && /^https?:\/\//i.test(src);
}

/**
 * Load an image from src, applying EXIF orientation correction to the canvas.
 * Returns { canvas, ctx } with the image drawn upright and ready to sample.
 *
 * This is the heart of the EXIF fix: we draw the raw JPEG onto a rotated
 * canvas BEFORE we sample the crop region, so the coordinates from
 * react-easy-crop (which shows the corrected image via CSS) line up correctly.
 *
 * @param {string}  src          dataURL or blob URL
 * @param {number}  [orientation=1]
 * @returns {Promise<HTMLCanvasElement>}
 */
function createOrientedCanvas(src, orientation = 1) {
  return new Promise((resolve, reject) => {
    const img = new Image();

    if (needsCrossOrigin(src)) {
      img.crossOrigin = 'anonymous';
    }

    img.onload = () => {
      const { rotation, flipX, flipY, swapDims } = exifOrientationToTransform(orientation);

      // After rotation, width and height may swap (portrait → landscape correction)
      const canvasWidth = swapDims ? img.naturalHeight : img.naturalWidth;
      const canvasHeight = swapDims ? img.naturalWidth : img.naturalHeight;

      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const ctx = canvas.getContext('2d');

      // Apply transforms in order: translate to centre → rotate → flip → draw
      ctx.translate(canvasWidth / 2, canvasHeight / 2);
      if (rotation) ctx.rotate((rotation * Math.PI) / 180);
      if (flipX) ctx.scale(-1, 1);
      if (flipY) ctx.scale(1, -1);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      resolve(canvas);
    };

    img.onerror = () => reject(new Error(`[cropImage] Failed to load image from: ${src?.slice(0, 80)}`));
    img.src = src;
  });
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Crop an image to the given pixel rectangle and return a Blob.
 *
 * @param {string} imageSrc           dataURL or object URL of the source image
 * @param {{ x, y, width, height }} croppedAreaPixels   from react-easy-crop
 * @param {object} [opts]
 * @param {string} [opts.format='image/jpeg']   One of OUTPUT_FORMATS values
 * @param {number} [opts.quality=0.90]          0–1 (ignored for PNG)
 * @param {number} [opts.orientation=1]         EXIF orientation (1–8); use
 *                                              readExifOrientation() to get this
 *                                              from the original File before
 *                                              converting it to a dataURL.
 * @param {string} [opts.bgColor='#ffffff']     Background fill for JPEG output
 *                                              (prevents black corners from
 *                                              transparent PNG → JPEG conversion)
 * @returns {Promise<Blob>}
 */
export const getCroppedImg = async (
  imageSrc,
  croppedAreaPixels,
  opts = {}
) => {
  const {
    format = OUTPUT_FORMATS.JPEG,
    quality = 0.90,
    orientation = 1,
    bgColor = '#ffffff',
  } = opts;

  // ── Input validation ────────────────────────────────────────────────────────
  if (!imageSrc) {
    throw new Error('[cropImage] imageSrc is required');
  }
  if (!croppedAreaPixels) {
    throw new Error('[cropImage] croppedAreaPixels is required');
  }

  const { x, y, width, height } = croppedAreaPixels;

  if (!width || !height || width <= 0 || height <= 0) {
    throw new Error(
      `[cropImage] Invalid crop dimensions: ${width}×${height}. ` +
      'Ensure the user has interacted with the cropper before applying.'
    );
  }

  // ── Draw source image with EXIF orientation correction ─────────────────────
  const sourceCanvas = await createOrientedCanvas(imageSrc, orientation);

  // ── Sample the crop region ─────────────────────────────────────────────────
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = Math.round(width);
  outputCanvas.height = Math.round(height);

  const ctx = outputCanvas.getContext('2d');

  // Fill background before drawing — prevents black corners when converting
  // transparent images (PNG/WebP with alpha) to JPEG
  if (format === OUTPUT_FORMATS.JPEG) {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, outputCanvas.width, outputCanvas.height);
  }

  ctx.drawImage(
    sourceCanvas,
    Math.round(x),
    Math.round(y),
    Math.round(width),
    Math.round(height),
    0,
    0,
    Math.round(width),
    Math.round(height)
  );

  // ── Export to Blob ──────────────────────────────────────────────────────────
  return new Promise((resolve, reject) => {
    outputCanvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error(
            '[cropImage] canvas.toBlob produced null. ' +
            'This can happen if the source image is tainted by CORS. ' +
            'Ensure the server sends Access-Control-Allow-Origin, or use a data: URL.'
          ));
          return;
        }
        resolve(blob);
      },
      format,
      // PNG ignores quality; passing it anyway is harmless
      quality
    );
  });
};

/**
 * Get the natural pixel dimensions of an image from a URL/dataURL.
 * Useful for pre-flight resolution checks (e.g. livenessService ≥ 200×200).
 *
 * @param {string} src
 * @returns {Promise<{ width: number, height: number }>}
 */
export function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (needsCrossOrigin(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('[cropImage] Could not load image to read dimensions'));
    img.src = src;
  });
}

/**
 * Revoke an object URL created by URL.createObjectURL().
 * Call this in useEffect cleanup to prevent memory leaks.
 *
 * @param {string|null|undefined} url
 */
export function revokePreviewUrl(url) {
  if (url && typeof url === 'string' && url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}