/**
 * ShareModal.js  — v2
 *
 * CHANGES from v1:
 *  • All link construction / share logic delegated to src/utils/inviteLink.js
 *    (single source of truth).  No URLs hard-coded here.
 *  • Added Telegram and Twitter/X platforms.
 *  • Instagram now copies link + shows a helper toast with instructions.
 *  • Scroll lock via useRegisterModal(show) — unchanged from v1.
 *  • Improved UX: animated entrance, QR-style link badge, send-count badge.
 */

import React, { useState, useCallback } from 'react';
import { toast } from 'react-toastify';
import { useRegisterModal } from '../../Context/ModalContext';
import {
  copyToClipboard,
  nativeShare,
  getPlatformShareUrls,
  buildShareText,
} from '../../utils/inviteLink';
import 'react-toastify/dist/ReactToastify.css';

// ── Platform config ────────────────────────────────────────────────────────────
// 'key' must match a key returned by getPlatformShareUrls() or be a
// special value ('clipboard' | 'native' | 'instagram').
const PLATFORMS = [
  { key: 'whatsapp',  label: 'WhatsApp',   emoji: '💬', color: '#25d366', bg: 'rgba(37,211,102,0.12)'  },
  { key: 'telegram',  label: 'Telegram',   emoji: '✈️', color: '#229ED9', bg: 'rgba(34,158,217,0.12)'  },
  { key: 'facebook',  label: 'Facebook',   emoji: '👥', color: '#1877f2', bg: 'rgba(24,119,242,0.12)'  },
  { key: 'twitter',   label: 'X / Twitter',emoji: '𝕏',  color: '#000000', bg: 'rgba(0,0,0,0.08)'       },
  { key: 'instagram', label: 'Instagram',  emoji: '📸', color: '#e1306c', bg: 'rgba(225,48,108,0.12)'  },
  { key: 'linkedin',  label: 'LinkedIn',   emoji: '💼', color: '#0077b5', bg: 'rgba(0,119,181,0.12)'   },
  { key: 'email',     label: 'Email',      emoji: '✉️', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  { key: 'sms',       label: 'SMS',        emoji: '📱', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  { key: 'native',    label: 'More…',      emoji: '↗️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
];

// ─────────────────────────────────────────────────────────────────────────────

const ShareModal = ({
  show,
  inviteLink,
  senderName,               // optional — personalises share text
  onClose,
  title = 'Share Your Invite Link',
}) => {
  useRegisterModal(show);

  const [copied,     setCopied]     = useState(false);
  const [shareCount, setShareCount] = useState(0);  // tracks successful shares in this session

  const trackShare = useCallback(() => {
    setShareCount(n => n + 1);
  }, []);

  const handleShare = useCallback(async (key) => {
    if (!inviteLink) {
      toast.error('No invite link available yet.');
      return;
    }

    try {
      // ── Clipboard ──────────────────────────────────────────────────────────
      if (key === 'clipboard') {
        const ok = await copyToClipboard(inviteLink);
        if (ok) {
          setCopied(true);
          toast.success('Link copied to clipboard!');
          setTimeout(() => setCopied(false), 2500);
          trackShare();
        } else {
          toast.error('Could not copy — please copy manually.');
        }
        return;
      }

      // ── Native Web Share ───────────────────────────────────────────────────
      if (key === 'native') {
        const result = await nativeShare(inviteLink, senderName);
        if (result === 'shared')      { toast.success('Shared!'); trackShare(); onClose(); }
        else if (result === 'cancelled') toast.info('Share cancelled.');
        else                             toast.warning('Native sharing is not available on this device.');
        return;
      }

      // ── Instagram (no direct URL share; copy + hint) ───────────────────────
      if (key === 'instagram') {
        const shareText = buildShareText(inviteLink, senderName);
        await copyToClipboard(shareText);
        toast.info(
          '📋 Your invite message has been copied! Open Instagram, start a chat, and paste it.',
          { autoClose: 6000 }
        );
        trackShare();
        return;
      }

      // ── All other platforms ────────────────────────────────────────────────
      const urls = getPlatformShareUrls(inviteLink, senderName);
      const url  = urls[key];
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
        toast.success('Opening…');
        trackShare();
        onClose();
      }
    } catch {
      toast.error('Could not open share. Please copy the link manually.');
    }
  }, [inviteLink, senderName, onClose, trackShare]);

  if (!show) return null;

  return (
    <>
      {/* ── Inline styles (no external CSS dependency) ────────────────────── */}
      <style>{`
        @keyframes shm-slide-up {
          from { opacity:0; transform:translateY(28px) scale(0.97); }
          to   { opacity:1; transform:translateY(0)    scale(1);    }
        }
        @keyframes shm-fade-in {
          from { opacity:0; }
          to   { opacity:1; }
        }
        .shm-overlay {
          position:fixed; inset:0; z-index:1500;
          background:rgba(0,0,0,0.55); backdrop-filter:blur(4px);
          display:flex; align-items:flex-end; justify-content:center;
          animation:shm-fade-in 0.18s ease;
        }
        @media(min-width:540px){
          .shm-overlay { align-items:center; }
        }
        .shm-panel {
          background:var(--color-background-primary,#fff);
          width:100%; max-width:480px;
          border-radius:20px 20px 0 0;
          overflow:hidden; position:relative;
          animation:shm-slide-up 0.22s cubic-bezier(.34,1.56,.64,1);
          box-shadow:0 -8px 40px rgba(0,0,0,0.18);
        }
        @media(min-width:540px){
          .shm-panel { border-radius:20px; }
        }
        .shm-accent-bar {
          height:4px;
          background:linear-gradient(90deg,#7c3aed,#06b6d4,#10b981);
        }
        .shm-drag-handle {
          width:40px; height:4px; border-radius:2px;
          background:var(--color-border-secondary,#e5e7eb);
          margin:12px auto 0; display:block;
        }
        @media(min-width:540px){ .shm-drag-handle{ display:none; } }
        .shm-header {
          display:flex; align-items:center; justify-content:space-between;
          padding:18px 20px 14px;
        }
        .shm-header-left { display:flex; align-items:center; gap:12px; }
        .shm-header-icon {
          width:44px; height:44px; border-radius:12px; font-size:22px;
          background:linear-gradient(135deg,#7c3aed22,#06b6d422);
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        }
        .shm-title {
          margin:0; font-size:16px; font-weight:600;
          color:var(--color-text-primary,#111);
          font-family:var(--font-sans,system-ui,sans-serif);
        }
        .shm-subtitle {
          margin:2px 0 0; font-size:12px;
          color:var(--color-text-tertiary,#888);
          font-family:var(--font-sans,system-ui,sans-serif);
        }
        .shm-share-badge {
          font-size:11px; font-weight:600; padding:2px 8px;
          border-radius:20px;
          background:var(--color-background-success,#d1fae5);
          color:var(--color-text-success,#065f46);
          border:0.5px solid var(--color-border-success,#6ee7b7);
          font-family:var(--font-sans,system-ui,sans-serif);
          margin-top:4px; display:inline-block;
        }
        .shm-close {
          width:32px; height:32px; border-radius:50%; border:none;
          background:var(--color-background-secondary,#f3f4f6);
          color:var(--color-text-secondary,#666); cursor:pointer;
          font-size:14px; display:flex; align-items:center; justify-content:center;
          transition:background 0.15s;
          font-family:var(--font-sans,system-ui,sans-serif);
          flex-shrink:0;
        }
        .shm-close:hover { background:var(--color-border-secondary,#e5e7eb); }

        /* ── Link preview ── */
        .shm-link-preview {
          margin:0 16px 16px;
          background:var(--color-background-secondary,#f9fafb);
          border:0.5px solid var(--color-border-secondary,#e5e7eb);
          border-radius:10px; padding:10px 12px;
          display:flex; align-items:center; gap:10px;
          overflow:hidden;
        }
        .shm-link-icon { font-size:18px; flex-shrink:0; }
        .shm-link-text {
          flex:1; font-size:12px; color:var(--color-text-secondary,#555);
          font-family:'Courier New',monospace; overflow:hidden;
          text-overflow:ellipsis; white-space:nowrap;
        }
        .shm-copy-btn {
          flex-shrink:0; font-size:12px; font-weight:600;
          padding:5px 12px; border-radius:6px; cursor:pointer;
          border:0.5px solid var(--color-text-primary,#111);
          background:var(--color-text-primary,#111);
          color:var(--color-background-primary,#fff);
          transition:all 0.15s;
          font-family:var(--font-sans,system-ui,sans-serif);
          white-space:nowrap;
        }
        .shm-copy-btn.shm-copy-done {
          background:var(--color-background-success,#d1fae5);
          color:var(--color-text-success,#065f46);
          border-color:var(--color-border-success,#6ee7b7);
        }

        /* ── Grid ── */
        .shm-section-label {
          font-size:11px; font-weight:500; letter-spacing:0.7px;
          text-transform:uppercase; color:var(--color-text-tertiary,#999);
          font-family:var(--font-sans,system-ui,sans-serif);
          padding:0 20px; margin:0 0 10px;
        }
        .shm-grid {
          display:grid; grid-template-columns:repeat(3,1fr);
          gap:8px; padding:0 16px;
        }
        @media(min-width:400px){
          .shm-grid { grid-template-columns:repeat(3,1fr); }
        }
        .shm-platform-btn {
          display:flex; flex-direction:column; align-items:center;
          gap:6px; padding:12px 8px; border-radius:12px; cursor:pointer;
          border:0.5px solid transparent;
          background:var(--platform-bg);
          transition:transform 0.12s, box-shadow 0.12s, border-color 0.12s;
          font-family:var(--font-sans,system-ui,sans-serif);
        }
        .shm-platform-btn:hover {
          transform:translateY(-2px);
          box-shadow:0 4px 12px rgba(0,0,0,0.1);
          border-color:var(--platform-color);
        }
        .shm-platform-btn:active { transform:scale(0.96); }
        .shm-platform-emoji { font-size:22px; line-height:1; }
        .shm-platform-label {
          font-size:11px; font-weight:500;
          color:var(--platform-color);
        }

        /* ── Footer ── */
        .shm-footer { padding:14px 16px 20px; }
        .shm-cancel-btn {
          width:100%; padding:12px; border-radius:10px; cursor:pointer;
          border:0.5px solid var(--color-border-secondary,#e5e7eb);
          background:none; color:var(--color-text-secondary,#666);
          font-size:14px; font-weight:500;
          font-family:var(--font-sans,system-ui,sans-serif);
          transition:background 0.15s;
        }
        .shm-cancel-btn:hover { background:var(--color-background-secondary,#f3f4f6); }
      `}</style>

      <div
        className="shm-overlay"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="shm-panel" role="dialog" aria-modal="true" aria-label={title}>

          <div className="shm-accent-bar" />
          <div className="shm-drag-handle" />

          {/* ── Header ── */}
          <div className="shm-header">
            <div className="shm-header-left">
              <div className="shm-header-icon">📤</div>
              <div>
                <h2 className="shm-title">{title}</h2>
                <p className="shm-subtitle">Pick a platform to share your link</p>
                {shareCount > 0 && (
                  <span className="shm-share-badge">✓ Shared {shareCount}×</span>
                )}
              </div>
            </div>
            <button className="shm-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* ── Link preview ── */}
          <div className="shm-link-preview">
            <div className="shm-link-icon">🔗</div>
            <div className="shm-link-text" title={inviteLink}>{inviteLink || '—'}</div>
            <button
              className={`shm-copy-btn${copied ? ' shm-copy-done' : ''}`}
              onClick={() => handleShare('clipboard')}
              disabled={!inviteLink}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>

          {/* ── Platform grid ── */}
          <p className="shm-section-label">Share via</p>
          <div className="shm-grid">
            {PLATFORMS.map((p) => (
              <button
                key={p.key}
                className="shm-platform-btn"
                onClick={() => handleShare(p.key)}
                style={{ '--platform-color': p.color, '--platform-bg': p.bg }}
                disabled={!inviteLink}
              >
                <span className="shm-platform-emoji">{p.emoji}</span>
                <span className="shm-platform-label">{p.label}</span>
              </button>
            ))}
          </div>

          {/* ── Footer ── */}
          <div className="shm-footer">
            <button className="shm-cancel-btn" onClick={onClose}>Cancel</button>
          </div>

        </div>
      </div>
    </>
  );
};

export default ShareModal;