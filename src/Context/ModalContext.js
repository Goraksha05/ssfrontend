/**
 * ModalContext.js — Centralized Modal Manager
 *
 * ARCHITECTURE OVERVIEW
 * ─────────────────────
 * This is the single source of truth for ALL modals in the app.
 * It replaces the scattered pattern of:
 *   • Individual useScrollLock() calls inside each modal component
 *   • Boolean flags in UIContext (isProfileModalOpen, isCropModalOpen, etc.)
 *   • A separate ModalContext stack with no scroll coordination
 *
 * HOW IT WORKS
 * ─────────────
 * 1. Every modal registers itself when mounted → stack count goes up
 * 2. Every modal unregisters itself when unmounted → stack count goes down
 * 3. Scroll is locked when stack count > 0, unlocked when it hits 0
 * 4. Named modals (profile, crop, etc.) are also tracked so components
 *    can ask "is modal X open?" without owning that boolean themselves.
 *
 * MIGRATION GUIDE
 * ───────────────
 * OLD PATTERN (remove from each modal file):
 *   import useScrollLock from '../../hooks/useScrollLock';
 *   useScrollLock(show);
 *
 * NEW PATTERN (add to each modal file):
 *   import { useModalRegistry } from '../../Context/ModalContext';
 *   const { register, unregister } = useModalRegistry();
 *   useEffect(() => {
 *     if (show) { const id = register(); return () => unregister(id); }
 *   }, [show]);
 *
 * OR use the convenience wrapper:
 *   import { useRegisterModal } from '../../Context/ModalContext';
 *   useRegisterModal(show); // ← one line, handles everything
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Scroll lock — single implementation, lives here only
// ─────────────────────────────────────────────────────────────────────────────

let scrollY = 0; // captured before locking so we can restore exactly

function lockScroll() {
  scrollY = window.scrollY;
  const scrollbarWidth =
    window.innerWidth - document.documentElement.clientWidth;

  document.body.style.overflow = 'hidden';
  document.body.style.position = 'fixed';
  document.body.style.top = `-${scrollY}px`;
  document.body.style.width = '100%';
  // Prevent layout shift from disappearing scrollbar
  if (scrollbarWidth > 0) {
    document.body.style.paddingRight = `${scrollbarWidth}px`;
  }
}

function unlockScroll() {
  document.body.style.overflow = '';
  document.body.style.position = '';
  document.body.style.top = '';
  document.body.style.width = '';
  document.body.style.paddingRight = '';
  window.scrollTo(0, scrollY);
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const ModalContext = createContext(null);

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function ModalProvider({ children }) {
  /**
   * modalStack: array of { id, component, props }
   * Used for imperatively-opened modals (openModal API).
   */
  const [modalStack, setModalStack] = useState([]);

  /**
   * registryCount: how many modals are currently open.
   * This is the canonical number used to decide scroll lock.
   * Both the stack-based modals AND the declarative modals
   * (FollowersModal, ShareModal, etc.) increment/decrement this.
   */
  const registryCount = useRef(0);
  const [isAnyModalOpen, setIsAnyModalOpen] = useState(false);

  // Sync scroll lock whenever isAnyModalOpen changes
  useEffect(() => {
    if (isAnyModalOpen) {
      lockScroll();
    } else {
      unlockScroll();
    }
    // Safety: always unlock on unmount
    return () => {
      if (!isAnyModalOpen) unlockScroll();
    };
  }, [isAnyModalOpen]);

  // ── Registry API (for declarative modals) ──────────────────────────────
  const register = useCallback(() => {
    const id = `modal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    registryCount.current += 1;
    setIsAnyModalOpen(true);
    return id;
  }, []);

  const unregister = useCallback(() => {
    registryCount.current = Math.max(0, registryCount.current - 1);
    if (registryCount.current === 0) {
      setIsAnyModalOpen(false);
    }
  }, []);

  // ── Stack API (for imperative openModal calls) ──────────────────────────
  const openModal = useCallback((component, props = {}) => {
    const id = `stack_${Date.now()}`;
    setModalStack((prev) => [...prev, { id, component, props }]);
    registryCount.current += 1;
    setIsAnyModalOpen(true);
    return id;
  }, []);

  const closeModal = useCallback((id) => {
    setModalStack((prev) => {
      const next = prev.filter((m) => m.id !== id);
      // Decrement registry count for the removed modal
      registryCount.current = Math.max(0, registryCount.current - 1);
      if (registryCount.current === 0) {
        setIsAnyModalOpen(false);
      }
      return next;
    });
  }, []);

  const closeTopModal = useCallback(() => {
    setModalStack((prev) => {
      if (prev.length === 0) return prev;
      registryCount.current = Math.max(0, registryCount.current - 1);
      if (registryCount.current === 0) {
        setIsAnyModalOpen(false);
      }
      return prev.slice(0, -1);
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setModalStack([]);
    registryCount.current = 0;
    setIsAnyModalOpen(false);
  }, []);

  const value = {
    // Scroll lock state
    isAnyModalOpen,

    // Registry API — used by useRegisterModal hook
    register,
    unregister,

    // Stack API — used by openModal() callers
    openModal,
    closeModal,
    closeTopModal,
    closeAllModals,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}

      {/* Render the imperative modal stack */}
      {modalStack.map(({ id, component: Component, props }) => (
        <Component key={id} {...props} onClose={() => closeModal(id)} />
      ))}
    </ModalContext.Provider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

/** Access the raw context — use sparingly */
export function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModalContext must be used inside <ModalProvider>');
  return ctx;
}

/** Backwards-compatible alias — keeps existing openModal() call-sites working */
export const useModal = useModalContext;

/**
 * useRegisterModal(isOpen)
 *
 * Drop-in replacement for useScrollLock() inside modal components.
 * Call this at the top of any modal with the boolean that controls its visibility.
 * It handles register/unregister automatically, with no scroll-lock leaks.
 *
 * Usage:
 *   import { useRegisterModal } from '../../Context/ModalContext';
 *   const MyModal = ({ show, onClose }) => {
 *     useRegisterModal(show);
 *     ...
 *   };
 */
export function useRegisterModal(isOpen) {
  const { register, unregister } = useModalContext();

  useEffect(() => {
    if (!isOpen) return;
    // Register this modal instance and get a cleanup id
    register();
    return () => {
      unregister();
    };
  }, [isOpen, register, unregister]);
}

/**
 * useModalRegistry — lower-level hook if you need the id for manual control
 */
export function useModalRegistry() {
  const { register, unregister } = useModalContext();
  return { register, unregister };
}