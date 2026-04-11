/**
 * UIContext.js — UI Panel & Navigation State
 *
 * CHANGE FROM PREVIOUS VERSION
 * ─────────────────────────────
 * Modal open/close state has been REMOVED from here. It now lives in
 * ModalContext.js, which is the single source of truth for:
 *   - scroll locking
 *   - isAnyModalOpen flag
 *   - all modal visibility
 *
 * What REMAINS here:
 *   - Mobile menu open/close
 *   - Notification panel open/close
 *   - Theme picker open/close
 *   - Login / Register / ForgotPassword modal triggers
 *     (these are kept here because Navbar needs to open them imperatively;
 *      their scroll lock is handled by ModalContext via useRegisterModal)
 *
 * REMOVED from this file:
 *   - isProfileModalOpen / setIsProfileModalOpen
 *   - isRewardsModalOpen / setIsRewardsModalOpen
 *   - isCropModalOpen / setIsCropModalOpen
 *   - isAnyModalOpen (now from ModalContext)
 *   - useScrollLock (now handled centrally in ModalContext)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  // ── Navigation panels ────────────────────────────────────────────────────
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);

  // ── Auth modals ──────────────────────────────────────────────────────────
  // These flags control which auth modal is displayed.
  // Scroll lock for these modals is handled by useRegisterModal() inside
  // each auth modal component — not here.
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);

  // ── Task/Activity modal ──────────────────────────────────────────────────
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);

  // ── Theme picker ─────────────────────────────────────────────────────────
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);
  const openThemePicker = () => setIsThemePickerOpen(true);
  const closeThemePicker = () => setIsThemePickerOpen(false);

  // ── Auto-close on browser navigation ────────────────────────────────────
  useEffect(() => {
    const closeMenus = () => {
      setIsMobileMenuOpen(false);
      setIsNotificationPanelOpen(false);
    };
    window.addEventListener('popstate', closeMenus);
    return () => window.removeEventListener('popstate', closeMenus);
  }, []);

  // ── Outside click handler for panels ────────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (event) => {
      const target = event.target;
      if (
        isNotificationPanelOpen &&
        !target.closest('[data-notification-panel]') &&
        !target.closest('[data-notification-trigger]')
      ) {
        setIsNotificationPanelOpen(false);
      }
      if (
        isMobileMenuOpen &&
        !target.closest('[data-mobile-menu]') &&
        !target.closest('[data-mobile-menu-trigger]')
      ) {
        setIsMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isNotificationPanelOpen, isMobileMenuOpen]);

  // ── Togglers ─────────────────────────────────────────────────────────────
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
    if (!isMobileMenuOpen) setIsNotificationPanelOpen(false);
  };

  const toggleNotificationPanel = () => {
    setIsNotificationPanelOpen((prev) => !prev);
    if (!isNotificationPanelOpen) setIsMobileMenuOpen(false);
  };

  // ── Task modal ────────────────────────────────────────────────────────────
  const openTaskModal = (taskId) => {
    setActiveTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setActiveTaskId(null);
  };

  // ── Auth modal openers ────────────────────────────────────────────────────
  // Each opener closes the other two so only one auth step is visible.
  const openLoginModal = () => {
    setIsLoginModalOpen(true);
    setIsRegisterModalOpen(false);
    setIsForgotPasswordModalOpen(false);
  };
  const closeLoginModal = () => setIsLoginModalOpen(false);

  const openRegisterModal = () => {
    setIsRegisterModalOpen(true);
    setIsLoginModalOpen(false);
    setIsForgotPasswordModalOpen(false);
  };
  const closeRegisterModal = () => setIsRegisterModalOpen(false);

  const openForgotPasswordModal = () => {
    setIsForgotPasswordModalOpen(true);
    setIsLoginModalOpen(false);
    setIsRegisterModalOpen(false);
  };
  const closeForgotPasswordModal = () => setIsForgotPasswordModalOpen(false);

  return (
    <UIContext.Provider
      value={{
        // Panel visibility
        isMobileMenuOpen,
        isNotificationPanelOpen,

        // Panel controls
        toggleMobileMenu,
        toggleNotificationPanel,

        // Task modal
        isActivityModalOpen: isTaskModalOpen,
        activeActivityId: activeTaskId,
        openActivityModal: openTaskModal,
        closeActivityModal: closeTaskModal,

        // Auth modals
        isLoginModalOpen,
        isRegisterModalOpen,
        isForgotPasswordModalOpen,
        openLoginModal,
        closeLoginModal,
        openRegisterModal,
        closeRegisterModal,
        openForgotPasswordModal,
        closeForgotPasswordModal,

        // Theme picker
        isThemePickerOpen,
        openThemePicker,
        closeThemePicker,
      }}
    >
      {children}
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (context === undefined) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};