import React, { createContext, useContext, useState, useEffect } from 'react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isNotificationPanelOpen, setIsNotificationPanelOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isForgotPasswordModalOpen, setIsForgotPasswordModalOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState(null);
  const [isThemePickerOpen, setIsThemePickerOpen] = useState(false);

  const openThemePicker = () => setIsThemePickerOpen(true);
  const closeThemePicker = () => setIsThemePickerOpen(false);

  // Handle auto-close on browser navigation
  useEffect(() => {
    const closeMenus = () => {
      setIsMobileMenuOpen(false);
      setIsNotificationPanelOpen(false);
    };
    window.addEventListener('popstate', closeMenus);
    return () => window.removeEventListener('popstate', closeMenus);
  }, []);

  // Handle outside clicks to close panels/menus
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

  // UI togglers
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((prev) => !prev);
    if (!isMobileMenuOpen) setIsNotificationPanelOpen(false);
  };

  const toggleNotificationPanel = () => {
    setIsNotificationPanelOpen((prev) => !prev);
    if (!isNotificationPanelOpen) setIsMobileMenuOpen(false);
  };

  // Task/Activity modal
  const openTaskModal = (taskId) => {
    setActiveTaskId(taskId);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setActiveTaskId(null);
  };

  // Login/Register/Forgot Password
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
        // Visibility states
        isMobileMenuOpen,
        isNotificationPanelOpen,
        isActivityModalOpen: isTaskModalOpen,
        isLoginModalOpen,
        isRegisterModalOpen,
        isForgotPasswordModalOpen,
        activeActivityId: activeTaskId,

        // UI controls
        toggleMobileMenu,
        toggleNotificationPanel,
        openActivityModal: openTaskModal,
        closeActivityModal: closeTaskModal,
        openLoginModal,
        closeLoginModal,
        openRegisterModal,
        closeRegisterModal,
        openForgotPasswordModal,
        closeForgotPasswordModal,

        // Theme Picker
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
