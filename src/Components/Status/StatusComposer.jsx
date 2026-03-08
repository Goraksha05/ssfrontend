// src/components/Status/StatusComposer.jsx

import { useState, useRef, useCallback } from 'react';
import { useStatus } from '../../Context/StatusContext';
import './Status.css';

const BG_COLORS = [
  '#128C7E', '#075E54', '#25D366', '#34B7F1',
  '#ECE5DD', '#000000', '#e91e63', '#9c27b0',
  '#3f51b5', '#FF5722', '#FF9800', '#4CAF50',
];

const FONTS = [
  { label: 'Sans',   style: {}                                          },
  { label: 'Serif',  style: { fontFamily: 'Georgia, serif' }            },
  { label: 'Mono',   style: { fontFamily: 'monospace' }                 },
  { label: 'Italic', style: { fontStyle: 'italic', fontWeight: 300 }    },
  { label: 'Bold',   style: { fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' } },
];

const PRIVACY_OPTS = [
  { value: 'contacts', label: 'My Contacts'       },
  { value: 'everyone', label: 'Everyone'           },
  { value: 'only',     label: 'Only share with…'  },
];

export default function StatusComposer({ onClose }) {
  const { postTextStatus, postMediaStatus, loading } = useStatus();

  const [mode,    setMode]    = useState('text');
  const [text,    setText]    = useState('');
  const [bg,      setBg]      = useState(BG_COLORS[0]);
  const [font,    setFont]    = useState(0);
  const [privacy, setPrivacy] = useState('contacts');
  const [preview, setPreview] = useState(null);   // { url, isVideo, file }
  const [error,   setError]   = useState('');

  const fileRef = useRef(null);

  const handleFilePick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    setPreview({ url: URL.createObjectURL(file), isVideo, file });
    setMode('media');
  };

  const handleSubmit = useCallback(async () => {
    setError('');
    let result;
    if (mode === 'text') {
      if (!text.trim()) { setError('Please type something.'); return; }
      result = await postTextStatus({ text, backgroundColor: bg, fontStyle: font, privacy });
    } else {
      if (!preview?.file) { setError('Please choose an image or video.'); return; }
      const fd = new FormData();
      fd.append('media', preview.file);
      fd.append('text', text);
      fd.append('privacy', privacy);
      fd.append('backgroundColor', bg);
      fd.append('fontStyle', font);
      result = await postMediaStatus(fd);
    }
    if (result.success) onClose();
    else setError(result.error ?? 'Something went wrong.');
  }, [mode, text, bg, font, privacy, preview, postTextStatus, postMediaStatus, onClose]);

  return (
    <div className="status-composer">

      {/* Header */}
      <div className="status-composer__header">
        <button className="status-composer__close-btn" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="status-composer__title">Create Status</h2>
        <button
          className={`status-composer__mode-btn ${mode === 'text' ? 'active' : ''}`}
          onClick={() => { setMode('text'); setPreview(null); }}
        >
          Text
        </button>
        <button
          className={`status-composer__mode-btn ${mode === 'media' ? 'active' : ''}`}
          onClick={() => fileRef.current?.click()}
        >
          Photo / Video
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFilePick} />
      </div>

      {/* Canvas */}
      <div
        className="status-composer__canvas"
        style={mode === 'text' ? { background: bg } : { background: '#111' }}
      >
        {mode === 'text' && (
          <div className="status-composer__text-area">
            <textarea
              className="status-composer__textarea"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={700}
              placeholder="Type a status…"
              autoFocus
              rows={4}
              style={FONTS[font].style}
            />
          </div>
        )}

        {mode === 'media' && preview && (
          <div className="status-composer__media-preview">
            {preview.isVideo
              ? <video src={preview.url} controls />
              : <img   src={preview.url} alt="preview" />
            }
            <textarea
              className="status-composer__caption-input"
              value={text}
              onChange={e => setText(e.target.value)}
              maxLength={200}
              placeholder="Add a caption…"
              rows={2}
            />
          </div>
        )}

        {mode === 'media' && !preview && (
          <div className="status-composer__media-placeholder" onClick={() => fileRef.current?.click()}>
            <svg width="64" height="64" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>Tap to choose a photo or video</span>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="status-composer__toolbar">

        {/* Colour swatches */}
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

        {/* Font buttons */}
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
        >
          {loading ? 'Posting…' : 'Post Status'}
        </button>
      </div>
    </div>
  );
}