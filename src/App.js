/* App.js — SoShoLife Frontend Root (Production-Ready) */

import './App.css';
// import './RewardEligibility.css';

import { useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

// ── Context Providers ─────────────────────────────────────────────────────────
import { AuthProvider, useAuth } from './Context/Authorisation/AuthContext';
import { I18nProvider } from './i18n/i18nContext';
import { UIProvider, useUI } from './Context/ThemeUI/UIContext';
import { ThemeProvider } from './Context/ThemeUI/ThemeContext';
import { OnlineUsersProvider } from './Context/OnlineUsersContext';
import { ChatProvider } from './Context/ChatContext';
import { NotificationProvider } from './Context/NotificationContext';
import { SocketProvider } from './Context/SocketContext';
import { SubscriptionProvider } from './Context/Subscription/SubscriptionContext';
import { StatusProvider } from './Context/StatusContext';
import { StreakProvider } from './Context/Activity/StreakContext';
import { FriendProvider } from './Context/Friend/FriendContext';
import { ReferralProvider } from './Context/Activity/ReferralContext';
import PostState from './Context/Posts/PostState';
import ProfileState from './Context/Profile/ProfileState';
import { KycProvider } from './Context/KYC/KycContext';

// ── User Behavior Tracking ────────────────────────────────────────────────────
import { startBehaviorSDK, stopBehaviorSDK } from './utils/behaviorSDK';
import { initializeSocket, getSocket } from './WebSocket/WebSocketClient';

// ── Components ────────────────────────────────────────────────────────────────
import ErrorBoundary from './Components/ErrorBoundary';
import Navbartemp from './Components/Navbartemp';
import Subscription from './Components/Subscription/Subscription';
import TermsPopup from './Components/TermsAndConditions/TermsPopup';
import KYCStatusBanner from './Components/KYC/KYCStatusBanner';
// ThemePalettePicker is rendered at app level — controlled by UIContext
import ThemePalettePicker from './Components/Theme/ThemePalettePicker';

// ── Pages ─────────────────────────────────────────────────────────────────────
import WelcomPage from './Components/WelcomPage';
import LogSignNewModel from './Components/Auth/RegiLogModel_OnlyCaptchaWidget';
import Home from './Components/HomeCompo/Home';
import Activity from './Components/UserActivities/Activity';
import Friend from './Components/Friendship/AllFriends';
import FriendReq from './Components/Friendship/FriendRequest';
import Suggestions from './Components/Friendship/Suggestion';
import Profile from './Components/Profile/ProfileWithKYC';
import FullscreenReels from './Components/Reels/FullscreenReels';
import InviteCard from './Components/InviteCard';
import ChatRoom from './Components/ChatRoom/ChatRoom';
import AboutUs from './Components/AboutUs/AboutUs';
import ContactUs from './Components/AboutUs/ContactUs';
import PrivacyPolicy from './Components/AboutUs/PrivacyPolicy';
import RefCancelPolicy from './Components/AboutUs/RefCancelPolicy';

// ── Admin Pages ───────────────────────────────────────────────────────────────
import AdminRoute from './Components/Admin/AdminRoute/AdminRoute';
import AdminLayout from './Components/Admin/AdminLayout';
import AdminDashboard from './Components/Admin/AdminDashboard';
import AdminUserReport from './Components/Admin/UserReport';
// Import the admin login page so unauthenticated admins can reach it
// import AdminLogin from './Components/Admin/AdminLogin';

// ─────────────────────────────────────────────────────────────────────────────

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.isAdmin;

  // FIX 1: backend's getloggeduser returns { id } (not { _id }).
  // user?._id was always undefined, so userId was always falsy and the
  // behavior SDK never started. Resolve from either field.
  const userId = user?.id ?? user?._id;

  // ── UIContext — theme picker state ─────────────────────────────────────────
  const { isThemePickerOpen, closeThemePicker } = useUI();

  useEffect(() => {
    AOS.init({ duration: 700, once: true });
  }, []);

  // ── reCAPTCHA v3 script injection ─────────────────────────────────────────
  // The Google reCAPTCHA script must be loaded before any form can call
  // window.grecaptcha.execute(). We inject it once on mount so that
  // window.grecaptcha is always available by the time the user submits
  // the signup (or login) form.
  // Without this, window.grecaptcha is always undefined and every signup
  // immediately fails with "Captcha not loaded".

  useEffect(() => {
    const v3SiteKey = process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY;
    if (!v3SiteKey) {
      console.warn('[reCAPTCHA] REACT_APP_RECAPTCHA_V3_SITE_KEY is not set.');
      return;
    }

    // Avoid injecting the script twice (e.g. on hot-reload in development)
    if (document.querySelector('#recaptcha-script')) return;

    const script = document.createElement('script');
    script.id = 'recaptcha-script';
    // ?render=V3_SITE_KEY enables grecaptcha.execute() for v3.
    // The v2 widget render() API is also available from this script.
    script.src = `https://www.google.com/recaptcha/api.js?render=${v3SiteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      const el = document.querySelector('#recaptcha-script');
      if (el) el.remove();
    };
  }, []);

  // ── Behavior SDK ─────────────────────────────────────────────────────────
  // Start only for authenticated, non-admin users.
  // FIX 4: track whether THIS effect instance started the SDK in a local
  // variable so cleanup only nulls the global when it was set here —
  // prevents a stale cleanup from a previous render clearing a session
  // that a concurrent login just wrote.
  useEffect(() => {
    let startedSession = false;

    const init = async () => {
      if (userId && !isAdmin && !window.__sdkSession) {
        await initializeSocket(); // ensure socket singleton is initialized
        const wsClient = getSocket();
        if (wsClient) {
          const session = startBehaviorSDK(wsClient);
          window.__sdkSession = session;
          startedSession = true;
        }
      }
    };

    init();

    return () => {
      // Only stop and clear the session that THIS effect created
      if (startedSession && window.__sdkSession) {
        stopBehaviorSDK(window.__sdkSession);
        window.__sdkSession = null;
      }
    };
  }, [userId, isAdmin]);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <PostState>
          <ProfileState>
            <KycProvider>
              {/*
                FIX 3: SocketProvider is promoted to wrap FriendProvider and
                ReferralProvider. Both of those call getSocket() on mount to
                register socket listeners. SocketProvider must run
                initializeSocket() before its children mount, otherwise
                getSocket() returns null inside those providers and all
                real-time friend / referral events are silently dropped.
              */}
              <SocketProvider>
                <StreakProvider>
                  <FriendProvider>
                    <ReferralProvider>
                      <SubscriptionProvider>
                        <StatusProvider>

                          {/* Navbar + chrome only for authenticated non-admin users */}
                          {isAuthenticated && !isAdmin && (
                            <>
                              <Navbartemp title={<b>SoShoLife</b>} myHome="Home" />
                              <Subscription />
                              <KYCStatusBanner />
                            </>
                          )}

                          <Routes>

                            {/* ── Admin (authenticated admin) ───────────────── */}
                            {isAdmin && (
                              <>
                                <Route
                                  path="/admin"
                                  element={<Navigate to="/admin/dashboard" replace />}
                                />
                                <Route
                                  path="/admin/*"
                                  element={
                                    <AdminRoute>
                                      <AdminLayout />
                                    </AdminRoute>
                                  }
                                >
                                  <Route path="dashboard" element={<AdminDashboard />} />
                                  <Route path="users" element={<AdminUserReport />} />
                                  <Route
                                    path="*"
                                    element={<Navigate to="/admin/dashboard" replace />}
                                  />
                                </Route>
                                <Route
                                  path="*"
                                  element={<Navigate to="/admin/dashboard" replace />}
                                />
                              </>
                            )}

                            {/* ── Public (unauthenticated) ──────────────────── */}
                            {!isAuthenticated && (
                              <>
                                <Route path="/" element={<WelcomPage />} />
                                <Route path="/login" element={<LogSignNewModel />} />
                                <Route path="/terms-popup" element={<TermsPopup />} />
                                {/*
                                  FIX 2: admin login route added to the public block.
                                  Without this, unauthenticated admins (no stored token)
                                  are redirected to "/" with no route to the admin login form.
                                */}
                                {/* <Route path="/admin/login" element={<AdminLogin />} /> */}
                                <Route path="*" element={<Navigate to="/" replace />} />
                              </>
                            )}

                            {/* ── Authenticated regular user ────────────────── */}
                            {isAuthenticated && !isAdmin && (
                              <>
                                <Route path="/" element={<Home />} />
                                <Route path="/activity" element={<Activity />} />
                                <Route path="/invitaion" element={<InviteCard />} />
                                <Route path="/allfriends" element={<Friend />} />
                                <Route path="/friendrequest" element={<FriendReq />} />
                                <Route path="/suggestions" element={<Suggestions />} />
                                <Route path="/profile" element={<Profile />} />
                                <Route path="/reels/fullscreen" element={<FullscreenReels />} />
                                <Route path="/chat" element={<ChatRoom />} />
                                <Route path="/aboutus" element={<AboutUs />} />
                                <Route path="/contactus" element={<ContactUs />} />
                                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                                <Route path="/refcanclepolicy" element={<RefCancelPolicy />} />
                                <Route path="/login" element={<Navigate to="/" replace />} />
                                <Route path="*" element={<Navigate to="/" replace />} />
                              </>
                            )}

                          </Routes>

                          {/* ── Global Theme Picker Modal ────────────────────*/}
                          <ThemePalettePicker
                            open={isThemePickerOpen}
                            onClose={closeThemePicker}
                          />

                        </StatusProvider>
                      </SubscriptionProvider>
                    </ReferralProvider>
                  </FriendProvider>
                </StreakProvider>
              </SocketProvider>
            </KycProvider>
          </ProfileState>
        </PostState>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  // QueryClient created via useMemo — avoids a shared singleton across multiple
  // renders (SSR / test isolation).
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
    []
  );

  return (
    /*
      FIX 6: ReactQueryDevtools is now inside QueryClientProvider.
      In some React Query versions, mounting DevTools outside the provider
      causes "No QueryClient set" errors at devtools initialization time.
    */
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <OnlineUsersProvider>
            <ChatProvider>
              <ThemeProvider>
                <UIProvider>
                  <Router>
                    <AppContent />
                  </Router>
                </UIProvider>
              </ThemeProvider>
            </ChatProvider>
          </OnlineUsersProvider>
        </AuthProvider>

        {/* FIX 5: ToastContainer at the root so toasts fired from any context
            in the tree (including NotificationContext socket listener) always
            have a mounted container to target.
            FIX 6: DevTools inside the provider — safe for all React Query versions. */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </I18nProvider>

      {/*
        ToastContainer lives at the QueryClientProvider level — outside all
        feature providers but inside the client — so it is always mounted
        regardless of auth state, and react-toastify can always find a target.
      */}
      <ToastContainer position="top-left" autoClose={5000} />
    </QueryClientProvider>
  );
}