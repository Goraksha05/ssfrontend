// EnhancedMediaUpload.js
import React, { useState, useRef, forwardRef, useImperativeHandle, useCallback } from 'react';
import Lightbox from 'react-image-lightbox';
import 'react-image-lightbox/style.css';
import { toast } from 'react-toastify';

// All styles live in globals.css § 70 — no CSS here, no useTheme hook.
// Theme switching is handled entirely by body.theme-dark / body.theme-light
// class toggling, which is the same pattern used by every other component
// in the app.

/* ─── Canvas crop helper ─────────────────────────────────────────────────────
   Pure-canvas implementation — no external getCroppedImg import needed.
   Accepts optional rotation (degrees) forwarded from CropModal's state.
   ─────────────────────────────────────────────────────────────────────────── */
async function getCroppedImg(imageSrc, pixelCrop, rotation = 0) {
  const image = await new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load',  () => resolve(img));
    img.addEventListener('error', reject);
    img.src = imageSrc;
  });

  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const bw  = image.width  * cos + image.height * sin;
  const bh  = image.width  * sin + image.height * cos;

  const boundCanvas  = document.createElement('canvas');
  const boundCtx     = boundCanvas.getContext('2d');
  boundCanvas.width  = bw;
  boundCanvas.height = bh;
  boundCtx.translate(bw / 2, bh / 2);
  boundCtx.rotate(rad);
  boundCtx.drawImage(image, -image.width / 2, -image.height / 2);

  const canvas  = document.createElement('canvas');
  const ctx     = canvas.getContext('2d');
  canvas.width  = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.drawImage(
    boundCanvas,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0,           0,           pixelCrop.width,  pixelCrop.height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas is empty'))),
      'image/jpeg',
      0.92,
    ),
  );
}

/* ─── Component ─────────────────────────────────────────────────────────── */
/**
 * EnhancedMediaUpload no longer owns CropModal rendering.
 * Instead it exposes crop state upward via `onCropRequest` so the
 * parent (Home) can render CropModal at the top of the tree —
 * outside any scrollable container — eliminating the scroll bug.
 *
 * Props:
 *   onFilesPrepared  – called with File[] when ready to submit
 *   postContent      – current post text (used for submit validation)
 *   onCropRequest    – (cropPayload | null) => void
 *                      Called with a payload object when the user clicks Crop,
 *                      and with null when the crop finishes or is cancelled.
 *                      Payload shape:
 *                        { image, onApply, onClose, crop, setCrop, zoom, setZoom, onCropComplete, applying }
 */
const EnhancedMediaUpload = forwardRef(({ onFilesPrepared, postContent, onCropRequest }, ref) => {

  const [mediaFiles,        setMediaFiles]        = useState([]);  // { file, preview }
  const [croppingIndex,     setCroppingIndex]     = useState(null);
  const [crop,              setCrop]              = useState({ x: 0, y: 0 });
  const [zoom,              setZoom]              = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying,          setApplying]          = useState(false);
  const [lightboxIndex,     setLightboxIndex]     = useState(-1);
  const [isDragOver,        setIsDragOver]        = useState(false);

  const inputRef = useRef();
  const MAX_SIZE = 500 * 1024 * 1024; // 500 MB

  // ── File ingestion ─────────────────────────────────────────────────────
  const ingestFiles = useCallback((rawFiles) => {
    const filtered = rawFiles.filter((file) => {
      if (file.size > MAX_SIZE) {
        toast.error(`${file.name} exceeds the 500 MB limit.`);
        return false;
      }
      return true;
    });
    const withPreviews = filtered.map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setMediaFiles((prev) => [...prev, ...withPreviews]);
  }, [MAX_SIZE]);

  const handleFileChange = (e) => {
    ingestFiles(Array.from(e.target.files));
    e.target.value = '';
  };

  // ── Drag-and-drop ──────────────────────────────────────────────────────
  const handleDragOver  = (e) => { e.preventDefault(); setIsDragOver(true);  };
  const handleDragLeave = ()  => { setIsDragOver(false); };
  const handleDrop      = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    ingestFiles(Array.from(e.dataTransfer.files));
  };

  // ── Remove / reorder ───────────────────────────────────────────────────
  const handleRemoveFile = (index) => {
    setMediaFiles((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleReorder = (index, direction) => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= mediaFiles.length) return;
    setMediaFiles((prev) => {
      const updated = [...prev];
      [updated[index], updated[target]] = [updated[target], updated[index]];
      return updated;
    });
  };

  // ── Crop ──────────────────────────────────────────────────────────────
  const handleCropComplete = useCallback((_area, areaPixels) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  // Notify parent to close the modal and clean up local state
  const closeCrop = useCallback(() => {
    setCroppingIndex(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    onCropRequest(null);
  }, [onCropRequest]);

  const handleCropApply = useCallback(async () => {
    if (croppingIndex === null || !croppedAreaPixels) return;
    setApplying(true);
    try {
      const { file, preview } = mediaFiles[croppingIndex];
      const croppedBlob       = await getCroppedImg(preview, croppedAreaPixels);
      const croppedFile       = new File([croppedBlob], `cropped-${file.name}`, { type: 'image/jpeg' });
      const croppedPreview    = URL.createObjectURL(croppedFile);
      URL.revokeObjectURL(preview);
      setMediaFiles((prev) => {
        const updated = [...prev];
        updated[croppingIndex] = { file: croppedFile, preview: croppedPreview };
        return updated;
      });
      toast.success('Crop applied.');
    } catch (err) {
      console.error('Crop error:', err);
      toast.error('Failed to apply crop.');
    } finally {
      setApplying(false);
      closeCrop();
    }
  }, [croppingIndex, croppedAreaPixels, mediaFiles, closeCrop]);

  const handleCropClose = useCallback(() => {
    if (!applying) closeCrop();
  }, [applying, closeCrop]);

  // Open crop: push payload to parent so it can render CropModal at root level
  const handleCropOpen = useCallback((index) => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setCroppingIndex(index);

    onCropRequest({
      image:          mediaFiles[index].preview,
      onApply:        handleCropApply,
      onClose:        handleCropClose,
      crop,
      setCrop,
      zoom,
      setZoom,
      onCropComplete: handleCropComplete,
      applying,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediaFiles, onCropRequest, handleCropComplete]);

  // Keep the live payload in sync with applying/crop/zoom/handlers so the
  // parent always has the freshest callbacks and state.
  // We do this via a stable ref to avoid stale closures inside CropModal.
  const cropPayloadRef = useRef(null);
  React.useEffect(() => {
    if (croppingIndex === null) return;
    // Update parent with fresh payload whenever dependent state changes
    const freshPayload = {
      image:          mediaFiles[croppingIndex]?.preview ?? null,
      onApply:        handleCropApply,
      onClose:        handleCropClose,
      crop,
      setCrop,
      zoom,
      setZoom,
      onCropComplete: handleCropComplete,
      applying,
    };
    cropPayloadRef.current = freshPayload;
    onCropRequest(freshPayload);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [croppingIndex, crop, zoom, applying]);

  // ── Reset / submit ─────────────────────────────────────────────────────
  const resetForm = () => {
    mediaFiles.forEach((m) => URL.revokeObjectURL(m.preview));
    setMediaFiles([]);
    setCroppingIndex(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    setLightboxIndex(-1);
    onCropRequest(null); // ensure parent closes modal if open
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = () => {
    if (mediaFiles.length === 0 && !postContent?.trim()) {
      toast.warning('Please add media or type at least one character.');
      return;
    }
    onFilesPrepared(mediaFiles.map((m) => m.file));
    resetForm();
  };

  // ── Imperative handle ──────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    submitMediaPost: handleSubmit,
    hasMedia:        () => mediaFiles.length > 0,
    openFilePicker:  () => inputRef.current?.click(),
  }));

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <>
      <input
        type="file"
        accept="image/*,video/*"
        multiple
        ref={inputRef}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      <div className="emu-root">

        {/* ── Drop-zone ── */}
        <div
          className={`emu-dropzone${isDragOver ? ' emu-dropzone--dragover' : ''}`}
          onClick={() => inputRef.current?.click()}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload media files"
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
        >
          <svg className="emu-dropzone-icon" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 16 12 12 8 16"/>
            <line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>

          <div className="emu-dropzone-label">
            {isDragOver ? 'Drop files here' : 'Drag & drop or click to upload'}
          </div>
          <div className="emu-dropzone-sub">Images &amp; videos {/*· max 500 MB each*/}</div>

          <button
            type="button"
            className="emu-dropzone-btn rounded-pill"
            onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
          >
            <svg width="15" height="15" viewBox="0 0 26 26" fill="none"
              stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
            </svg>
            Browse files
          </button>

          {mediaFiles.length > 0 && (
            <div className="emu-count-badge">
              <span className="emu-count-dot" />
              {mediaFiles.length} file{mediaFiles.length !== 1 ? 's' : ''} attached
            </div>
          )}
        </div>

        {/* ── Media grid ── */}
        {mediaFiles.length > 0 && (
          <div className="emu-grid" role="list" aria-label="Attached media">
            {mediaFiles.map((media, index) => {
              const { file, preview } = media;
              const isImage = file.type.startsWith('image');

              return (
                <div
                  key={`${file.name}-${index}`}
                  className="emu-card"
                  role="listitem"
                >
                  <div
                    className="emu-card-thumb"
                    onClick={() => isImage && setLightboxIndex(index)}
                    title={isImage ? 'Click to enlarge' : undefined}
                  >
                    {isImage ? (
                      <img src={preview} alt={file.name} loading="lazy" />
                    ) : (
                      <>
                        <video
                          src={preview}
                          controls
                          preload="metadata"
                          style={{ pointerEvents: 'auto' }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="emu-video-badge">VIDEO</span>
                      </>
                    )}

                    <button
                      type="button"
                      className="emu-remove-btn"
                      onClick={(e) => { e.stopPropagation(); handleRemoveFile(index); }}
                      aria-label={`Remove ${file.name}`}
                    >
                      <svg width="8" height="8" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M10.707 1.293a1 1 0 0 0-1.414 0L6 4.586 2.707 1.293A1 1 0 0 0 1.293 2.707L4.586 6 1.293 9.293a1 1 0 1 0 1.414 1.414L6 7.414l3.293 3.293a1 1 0 0 0 1.414-1.414L7.414 6l3.293-3.293a1 1 0 0 0 0-1.414Z"/>
                      </svg>
                    </button>
                  </div>

                  <div className="emu-card-footer">
                    <span className="emu-card-name" title={file.name}>
                      {file.name}
                    </span>

                    <div className="emu-card-actions">
                      {isImage && (
                        <button
                          type="button"
                          className="emu-icon-btn emu-icon-btn--crop"
                          onClick={() => handleCropOpen(index)}
                          title="Crop image"
                          aria-label={`Crop ${file.name}`}
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                            <path d="M6 2v14a2 2 0 0 0 2 2h14"/>
                            <path d="M18 22V8a2 2 0 0 0-2-2H2"/>
                          </svg>
                        </button>
                      )}

                      <button
                        type="button"
                        className="emu-icon-btn"
                        onClick={() => handleReorder(index, 'up')}
                        disabled={index === 0}
                        title="Move up"
                        aria-label="Move item up"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="2,8 6,4 10,8"/>
                        </svg>
                      </button>

                      <button
                        type="button"
                        className="emu-icon-btn"
                        onClick={() => handleReorder(index, 'down')}
                        disabled={index === mediaFiles.length - 1}
                        title="Move down"
                        aria-label="Move item down"
                      >
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none"
                          stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <polyline points="2,4 6,8 10,4"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox ── */}
      {lightboxIndex >= 0 && mediaFiles.length > 0 && (
        <Lightbox
          mainSrc={mediaFiles[lightboxIndex].preview}
          onCloseRequest={() => setLightboxIndex(-1)}
          nextSrc={mediaFiles[(lightboxIndex + 1) % mediaFiles.length]?.preview}
          prevSrc={mediaFiles[(lightboxIndex + mediaFiles.length - 1) % mediaFiles.length]?.preview}
          onMovePrevRequest={() =>
            setLightboxIndex((lightboxIndex + mediaFiles.length - 1) % mediaFiles.length)
          }
          onMoveNextRequest={() =>
            setLightboxIndex((lightboxIndex + 1) % mediaFiles.length)
          }
        />
      )}
    </>
  );
});

export default EnhancedMediaUpload;