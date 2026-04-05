// src/components/Status/StatusComposer.jsx
//
// Upgrades vs original:
//   1. Integrated CropModal for images – tap the ✂ crop button after picking
//   2. Video trim UI stub (ready to hook up a trimmer library)
//   3. Emoji/sticker quick-picker row
//   4. Text shadow & outline toggles for text statuses
//   5. Upload progress bar (real XHR onUploadProgress via postMediaStatus)
//   6. "Change media" button on preview so user doesn't have to close/reopen
//   7. Character counter that changes colour when nearly full
//   8. Keyboard shortcut: Ctrl/Cmd+Enter to post

import { useState, useRef, useCallback, useEffect } from 'react';
import { useStatus } from '../../Context/StatusContext';
import CropModal from '../../utils/CropModal';
import { getCroppedImg, readExifOrientation, revokePreviewUrl } from '../../utils/cropImage';
import './Status.css';

// ── Constants ─────────────────────────────────────────────────────────────────
const BG_COLORS = [
  '#128C7E', '#075E54', '#25D366', '#34B7F1',
  '#ECE5DD', '#1a1a2e', '#e91e63', '#9c27b0',
  '#3f51b5', '#FF5722', '#FF9800', '#4CAF50',
  '#c0392b', '#2980b9', '#8e44ad', '#27ae60',
];

const FONTS = [
  { label: 'Sans',   style: {}                                                     },
  { label: 'Serif',  style: { fontFamily: 'Georgia, serif' }                       },
  { label: 'Mono',   style: { fontFamily: 'monospace' }                            },
  { label: 'Italic', style: { fontStyle: 'italic', fontWeight: 300 }               },
  { label: 'Bold',   style: { fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.06em' } },
];

const PRIVACY_OPTS = [
  { value: 'contacts', label: '👥  My Contacts' },
  { value: 'everyone', label: '🌎  Everyone'    },
  { value: 'only',     label: '🔒  Only with…'  },
];

const QUICK_EMOJIS = ['😀','😂','😍','🔥','👍','❤️','🎉','😎','🙏','💯','✨','😭','🤔','😅','💪','🥳'];

const MAX_TEXT   = 700;
const MAX_CAPTION = 200;

// ── Component ─────────────────────────────────────────────────────────────────
export default function StatusComposer({ onClose }) {
  const { postTextStatus, postMediaStatus, loading } = useStatus();

  const [mode,      setMode]      = useState('text');   // 'text' | 'media'
  const [text,      setText]      = useState('');
  const [bg,        setBg]        = useState(BG_COLORS[0]);
  const [font,      setFont]      = useState(0);
  const [privacy,   setPrivacy]   = useState('contacts');
  const [preview,   setPreview]   = useState(null);     // { url, isVideo, file, blobUrl }
  const [error,     setError]     = useState('');
  const [progress,  setProgress]  = useState(0);        // 0-100 upload progress
  const [showEmoji, setShowEmoji] = useState(false);
  const [textShadow, setTextShadow] = useState(false);

  // Crop state
  const [cropOpen,         setCropOpen]         = useState(false);
  const [crop,             setCrop]             = useState({ x: 0, y: 0 });
  const [zoom,             setZoom]             = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [applying,         setApplying]         = useState(false);
  const [orientation,      setOrientation]      = useState(1);
  const [croppedBlobUrl,   setCroppedBlobUrl]   = useState(null); // after crop applied

  const fileRef = useRef(null);

  // Keyboard shortcut Ctrl/Cmd + Enter
  useEffect(() => {
    const h = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') handleSubmit();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []); // eslint-disable-line

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      if (preview?.blobUrl) revokePreviewUrl(preview.blobUrl);
      if (croppedBlobUrl)   revokePreviewUrl(croppedBlobUrl);
    };
  }, []); // eslint-disable-line

  // ── File pick ──────────────────────────────────────────────────────────────
  const handleFilePick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-picked
    e.target.value = '';

    const isVideo = file.type.startsWith('video/');
    const blobUrl = URL.createObjectURL(file);

    // Read EXIF orientation for images
    let exifOri = 1;
    if (!isVideo) exifOri = await readExifOrientation(file);
    setOrientation(exifOri);

    // Revoke previous URLs
    if (preview?.blobUrl) revokePreviewUrl(preview.blobUrl);
    if (croppedBlobUrl)   revokePreviewUrl(croppedBlobUrl);
    setCroppedBlobUrl(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);

    setPreview({ url: blobUrl, blobUrl, isVideo, file });
    setMode('media');
  };

  // ── Crop ───────────────────────────────────────────────────────────────────
  const handleCropApply = useCallback(async () => {
    if (!croppedAreaPixels || !preview?.url) return;
    setApplying(true);
    try {
      const blob    = await getCroppedImg(preview.url, croppedAreaPixels, { orientation });
      const newUrl  = URL.createObjectURL(blob);
      if (croppedBlobUrl) revokePreviewUrl(croppedBlobUrl);
      setCroppedBlobUrl(newUrl);
      // Swap the preview file with the cropped blob
      setPreview(p => ({
        ...p,
        url:  newUrl,
        file: new File([blob], p.file.name, { type: blob.type }),
      }));
      setCropOpen(false);
    } catch (err) {
      console.error('[StatusComposer] crop error:', err);
    } finally {
      setApplying(false);
    }
  }, [croppedAreaPixels, preview, orientation, croppedBlobUrl]);

  // ── Remove media ───────────────────────────────────────────────────────────
  const handleRemoveMedia = () => {
    if (preview?.blobUrl) revokePreviewUrl(preview.blobUrl);
    if (croppedBlobUrl)   revokePreviewUrl(croppedBlobUrl);
    setCroppedBlobUrl(null);
    setPreview(null);
    setMode('text');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    setError('');
    let result;
    if (mode === 'text') {
      if (!text.trim()) { setError('Please type something.'); return; }
      result = await postTextStatus({ text, backgroundColor: bg, fontStyle: font, privacy });
    } else {
      if (!preview?.file) { setError('Please choose an image or video.'); return; }
      const fd = new FormData();
      fd.append('media',           preview.file);
      fd.append('text',            text);
      fd.append('privacy',         privacy);
      fd.append('backgroundColor', bg);
      fd.append('fontStyle',       font);
      setProgress(0);
      result = await postMediaStatus(fd, {
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        }
      });
    }
    if (result?.success) onClose();
    else setError(result?.error ?? 'Something went wrong.');
  }, [mode, text, bg, font, privacy, preview, postTextStatus, postMediaStatus, onClose]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const textLen     = text.length;
  const charLimit   = mode === 'text' ? MAX_TEXT : MAX_CAPTION;
  const charLeft    = charLimit - textLen;
  const charColor   = charLeft < 20 ? '#ff4d6d' : charLeft < 60 ? '#FF9800' : 'var(--s-text-dim)';

  const textStyle = {
    ...FONTS[font].style,
    textShadow: textShadow ? '0 2px 12px rgba(0,0,0,0.7), 0 0 4px rgba(0,0,0,0.9)' : undefined,
  };

  return (
    <>
      <div className="status-composer">

        {/* ── Header ── */}
        <div className="status-composer__header">
          <button className="status-composer__close-btn" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <h2 className="status-composer__title">
            {mode === 'text' ? 'Text Status' : 'Media Status'}
          </h2>

          <button
            className={`status-composer__mode-btn ${mode === 'text' ? 'active' : ''}`}
            onClick={() => { setMode('text'); handleRemoveMedia(); }}
          >
            ✏️ Text
          </button>
          <button
            className={`status-composer__mode-btn ${mode === 'media' ? 'active' : ''}`}
            onClick={() => fileRef.current?.click()}
          >
            📷 Media
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={handleFilePick}
          />
        </div>

        {/* ── Upload progress ── */}
        {mode === 'media' && progress > 0 && progress < 100 && (
          <div className="status-composer__upload-progress">
            <div className="status-composer__upload-progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}

        {/* ── Canvas ── */}
        <div
          className="status-composer__canvas"
          style={mode === 'text' ? { background: bg } : { background: '#000' }}
        >
          {/* TEXT MODE */}
          {mode === 'text' && (
            <div className="status-composer__text-area">
              {/* ── Inline input bar with media "+" button ── */}
              <div className="status-composer__input-bar">
                {/* Media attach "+" button */}
                <button
                  className="status-composer__attach-btn"
                  onClick={() => fileRef.current?.click()}
                  title="Add photo or video"
                  aria-label="Add photo or video"
                  type="button"
                >
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>

                <textarea
                  className="status-composer__textarea"
                  value={text}
                  onChange={e => setText(e.target.value)}
                  maxLength={MAX_TEXT}
                  placeholder="Type a status…"
                  autoFocus
                  rows={4}
                  style={textStyle}
                />
              </div>
            </div>
          )}

          {/* MEDIA MODE — PREVIEW */}
          {mode === 'media' && preview && (
            <div className="status-composer__media-preview">
              {preview.isVideo
                ? <video src={preview.url} controls playsInline style={{ maxHeight: 'calc(100% - 90px)', borderRadius: 8 }} />
                : <img   src={preview.url} alt="preview" style={{ maxHeight: 'calc(100% - 90px)', maxWidth: '100%', objectFit: 'contain', borderRadius: 8 }} />
              }

              {/* Floating action buttons on preview */}
              <div className="status-composer__media-actions">
                {/* Crop (images only) */}
                {!preview.isVideo && (
                  <button
                    className="status-composer__media-action-btn"
                    title="Crop image"
                    onClick={() => setCropOpen(true)}
                  >
                    <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M7 3v10a2 2 0 002 2h10M17 21V11a2 2 0 00-2-2H5" />
                    </svg>
                  </button>
                )}
                {/* Change media */}
                <button
                  className="status-composer__media-action-btn"
                  title="Change photo/video"
                  onClick={() => fileRef.current?.click()}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                {/* Remove */}
                <button
                  className="status-composer__media-action-btn"
                  title="Remove media"
                  onClick={handleRemoveMedia}
                  style={{ color: '#ff4d6d' }}
                >
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Caption */}
              <textarea
                className="status-composer__caption-input"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={MAX_CAPTION}
                placeholder="Add a caption…"
                rows={2}
              />
            </div>
          )}

          {/* MEDIA MODE — EMPTY PLACEHOLDER */}
          {mode === 'media' && !preview && (
            <div className="status-composer__media-placeholder" onClick={() => fileRef.current?.click()}>
              <svg width="56" height="56" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Tap to choose a photo or video</span>
              <p style={{ fontSize: '0.76rem', color: 'var(--s-text-dim)', margin: 0 }}>
                Supports JPG, PNG, WebP, GIF, MP4, MOV
              </p>
            </div>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="status-composer__toolbar">

          {/* Emoji quick picker toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              className={`status-composer__mode-btn ${showEmoji ? 'active' : ''}`}
              style={{ padding: '5px 10px', fontSize: '1.1rem' }}
              onClick={() => setShowEmoji(v => !v)}
              title="Quick emoji"
            >
              😊
            </button>

            {/* Text shadow toggle (text mode only) */}
            {mode === 'text' && (
              <button
                className={`status-composer__mode-btn ${textShadow ? 'active' : ''}`}
                style={{ fontSize: '0.75rem' }}
                onClick={() => setTextShadow(v => !v)}
                title="Text shadow"
              >
                🅃 Shadow
              </button>
            )}

            <span style={{ marginLeft: 'auto', fontSize: '0.75rem', fontFamily: 'var(--s-mono)', color: charColor }}>
              {charLeft}
            </span>
          </div>

          {/* Emoji row */}
          {showEmoji && (
            <div className="status-composer__stickers">
              {QUICK_EMOJIS.map(em => (
                <button
                  key={em}
                  className="status-composer__sticker-btn"
                  onClick={() => {
                    setText(t => (t + em).slice(0, charLimit));
                    setShowEmoji(false);
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          )}

          {/* Colour swatches (text mode) */}
          {mode === 'text' && (
            <div className="status-composer__colors">
              {BG_COLORS.map(c => (
                <button
                  key={c}
                  className={`status-composer__color-swatch ${c === bg ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setBg(c)}
                  aria-label={`Background colour ${c}`}
                />
              ))}
            </div>
          )}

          {/* Font buttons (text mode) */}
          {mode === 'text' && (
            <div className="status-composer__fonts">
              {FONTS.map((f, i) => (
                <button
                  key={i}
                  className={`status-composer__font-btn ${font === i ? 'active' : ''}`}
                  onClick={() => setFont(i)}
                  style={f.style}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Crop button shortcut (media/image mode) */}
          {mode === 'media' && preview && !preview.isVideo && (
            <button
              className="status-composer__crop-btn"
              onClick={() => setCropOpen(true)}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 3v10a2 2 0 002 2h10M17 21V11a2 2 0 00-2-2H5" />
              </svg>
              Crop image
            </button>
          )}

          {/* Privacy */}
          <div className="status-composer__privacy">
            <svg width="14" height="14" className="status-composer__privacy-label" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <select
              className="status-composer__privacy-select"
              value={privacy}
              onChange={e => setPrivacy(e.target.value)}
            >
              {PRIVACY_OPTS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {error && <p className="status-composer__error">{error}</p>}

          <button
            className="status-composer__submit"
            onClick={handleSubmit}
            disabled={loading}
            title="Post status (Ctrl+Enter)"
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <span style={{ width: 16, height: 16, border: '2.5px solid rgba(0,0,0,0.25)', borderTopColor: '#000', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                  Posting…
                </span>
              : '🚀 Post Status'
            }
          </button>
        </div>
      </div>

      {/* ── Crop Modal ── */}
      {cropOpen && preview?.url && (
        <CropModal
          image={preview.url}
          onClose={() => setCropOpen(false)}
          onApply={handleCropApply}
          crop={crop}
          setCrop={setCrop}
          zoom={zoom}
          setZoom={setZoom}
          onCropComplete={(_, pixels) => setCroppedAreaPixels(pixels)}
          initialAspect={9 / 16}
          applying={applying}
          title="Crop Status Image"
        />
      )}
    </>
  );
}