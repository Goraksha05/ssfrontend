/**
 * ShareModal.js
 *
 * CHANGE: Replaced useScrollLock(show) with useRegisterModal(show).
 * Scroll locking is now handled centrally by ModalContext.
 */

import React, { useState } from 'react';
import { toast } from 'react-toastify';
import { useRegisterModal } from '../../Context/ModalContext';
import 'react-toastify/dist/ReactToastify.css';

const ShareModal = ({ show, inviteLink, onClose, title = 'Share Referral Link' }) => {
  // Central scroll lock — replaces: useScrollLock(show)
  useRegisterModal(show);

  const encodedLink = encodeURIComponent(inviteLink);
  const [copied, setCopied] = useState(false);

  const handleShare = (platform) => {
    try {
      if (platform === 'clipboard') {
        navigator.clipboard.writeText(inviteLink);
        setCopied(true);
        toast.success('Link copied to clipboard!');
        setTimeout(() => setCopied(false), 2000);
        return;
      }
      if (platform === 'native') {
        if (navigator.share) {
          navigator
            .share({ title: 'Join me!', text: "Here's my invite link:", url: inviteLink })
            .then(() => { toast.success('Shared!'); onClose(); })
            .catch(() => toast.error('Share cancelled.'));
          return;
        }
        toast.warning('Native sharing not supported on this device.');
        return;
      }
      if (platform === 'instagram') {
        toast.info('Instagram sharing requires the app.');
        return;
      }

      const urls = {
        whatsapp: `https://wa.me/?text=${encodedLink}`,
        facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
        email: `mailto:?subject=Join%20me%20on%20this%20app&body=${encodedLink}`,
        sms: `sms:?body=${encodedLink}`,
      };
      if (urls[platform]) {
        window.open(urls[platform], '_blank');
        toast.success('Opening…');
        onClose();
      }
    } catch {
      toast.error('Failed to share.');
    }
  };

  if (!show) return null;

  const platforms = [
    { id: 'whatsapp',  label: 'WhatsApp',  emoji: '💬', color: '#25d366', bg: 'rgba(37,211,102,0.12)'  },
    { id: 'facebook',  label: 'Facebook',  emoji: '👥', color: '#1877f2', bg: 'rgba(24,119,242,0.12)'  },
    { id: 'email',     label: 'Email',     emoji: '✉️', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
    { id: 'sms',       label: 'SMS',       emoji: '📱', color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
    { id: 'instagram', label: 'Instagram', emoji: '📸', color: '#e1306c', bg: 'rgba(225,48,108,0.12)'  },
    { id: 'native',    label: 'More…',     emoji: '↗️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)'  },
  ];

  return (
    <div
      className="shm-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="shm-panel" role="dialog" aria-modal="true">

        {/* Decorative top strip */}
        <div className="shm-accent-bar" />

        {/* Header */}
        <div className="shm-header">
          <div className="shm-header-left">
            <div className="shm-header-icon">📤</div>
            <div>
              <h2 className="shm-title">{title}</h2>
              <p className="shm-subtitle">Pick a platform to share your link</p>
            </div>
          </div>
          <button className="shm-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Link preview */}
        <div className="shm-link-preview">
          <div className="shm-link-icon">🔗</div>
          <div className="shm-link-text">{inviteLink}</div>
          <button
            className={`shm-copy-btn ${copied ? 'shm-copy-done' : ''}`}
            onClick={() => handleShare('clipboard')}
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>

        {/* Platform grid */}
        <div className="shm-body">
          <p className="shm-section-label">Share via</p>
          <div className="shm-grid">
            {platforms.map((p) => (
              <button
                key={p.id}
                className="shm-platform-btn"
                onClick={() => handleShare(p.id)}
                style={{ '--platform-color': p.color, '--platform-bg': p.bg }}
              >
                <span className="shm-platform-emoji">{p.emoji}</span>
                <span className="shm-platform-label">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="shm-footer">
          <button className="shm-cancel-btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;