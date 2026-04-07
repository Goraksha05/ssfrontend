// src/components/TodayOfferModal.js
import React from "react";
import { Modal, Button } from "react-bootstrap";
import useScrollLock from "../../hooks/useScrollLock";

const TodayOfferModal = ({ show, onClose, onConfirm, title, children, confirmText }) => {
  useScrollLock(show);

  return (
    <Modal show={show} onHide={onClose} centered dialogClassName="tom-dialog">
      <div className="tom-panel">
        {/* Animated sparkle bg */}
        <div className="tom-bg-sparkle" aria-hidden="true">
          {['✦','✧','⋆','✦','✧'].map((s, i) => (
            <span key={i} className={`tom-sparkle tom-sparkle-${i + 1}`}>{s}</span>
          ))}
        </div>

        {/* Header */}
        <div className="tom-header">
          <div className="tom-header-badge">🎁 Today's Offer</div>
          <h2 className="tom-title">{title}</h2>
          <button className="tom-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div className="tom-body">
          <div className="tom-content-wrap">
            {children}
          </div>
        </div>

        {/* Footer */}
        <div className="tom-footer">
          <Button className="tom-btn-cancel" onClick={onClose}>Maybe later</Button>
          {onConfirm && (
            <button className="tom-btn-confirm" onClick={onConfirm}>
              <span className="tom-btn-glow" />
              {confirmText || 'Claim Offer'} →
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TodayOfferModal;