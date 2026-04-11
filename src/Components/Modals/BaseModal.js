/**
 * BaseModal.js
 *
 * CHANGE: Removed useScrollLock() — scroll is now managed centrally by
 * ModalContext. This component simply renders the overlay/portal and
 * registers itself via useRegisterModal().
 */

import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { useRegisterModal } from '../../Context/ModalContext';

const BaseModal = ({ children, onClose }) => {
  // Register this modal with the central manager while mounted.
  // The manager handles scroll lock — no need for useScrollLock here.
  useRegisterModal(true);

  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="app-modal-overlay" onClick={onClose}>
      <div
        className="app-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};

export default BaseModal;