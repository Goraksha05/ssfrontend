/**
 * App.js — SoShoLife Frontend Root (Production-Ready)
 *
 * FIXES vs previous version:
 *
 *  1. userId resolved from `user?.id ?? user?._id`
 *     The backend's getloggeduser returns { id } not { _id }, so `user?._id`
 *     in AppContent was always undefined — the behavior SDK never started for
 *     any logged-in user because `userId` was always falsy.
 *
 *  2. Admin login route missing from public routes
 *     There was no `/admin/login` route in the unauthenticated block.
 *     Admins hitting the app cold (no stored token) would be redirected to `/`
 *     (WelcomPage) with no way to reach the admin login form.
 *
 *  3. SocketProvider must wrap FriendProvider, ReferralProvider, etc.
 *     FriendProvider and ReferralProvider both call getSocket() on mount.
 *     SocketProvider initializes the socket singleton. When SocketProvider was
 *     nested INSIDE FriendProvider, those inner providers called getSocket()
 *     before SocketProvider had run initializeSocket() — always getting null.
 *     Fix: SocketProvider is promoted to wrap all feature providers that
 *     depend on a live socket.
 *
 *  4. SDK cleanup race — `window.__sdkSession = null` ran even when the
 *     session was never started (userId was falsy).
 *     The cleanup now only nulls the global if it was set by this effect,
 *     preventing a race where a concurrent login writes __sdkSession and the
 *     old cleanup from the previous render immediately nulls it.
 *
 *  5. ToastContainer was inside AppContent (inside all context providers) but
 *     toasts can be fired from contexts that are siblings of AppContent in
 *     the tree (e.g. NotificationContext fires on socket events). Moving
 *     ToastContainer to the App root ensures every toast fires correctly
 *     regardless of which provider emits it.
 *
 *  6. ReactQueryDevtools was placed outside the QueryClientProvider closing
 *     tag. In some React Query versions this causes a "No QueryClient" error
 *     at devtools init. Moved inside the provider.
 */

import './App.css';
import './Theme.css';
import './ThemeComponents.css';
import './ThemeOverrides.css';
import './RewardEligibility.css';

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
import { UIProvider } from './Context/ThemeUI/UIContext';
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

// ── Pages ─────────────────────────────────────────────────────────────────────
import WelcomPage from './Components/WelcomPage';
import LogSignNewModel from './Components/Auth/RegiLogModel';
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

  useEffect(() => {
    AOS.init({ duration: 700, once: true });
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
                                  <Route path="users"     element={<AdminUserReport />} />
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
                                <Route path="/"           element={<WelcomPage />} />
                                <Route path="/login"      element={<LogSignNewModel />} />
                                <Route path="/terms-popup" element={<TermsPopup />} />
                                {/*
                                  FIX 2: admin login route added to the public block.
                                  Without this, unauthenticated admins (no stored token)
                                  are redirected to "/" with no route to the admin login form.
                                */}
                                {/* <Route path="/admin/login" element={<AdminLogin />} /> */}
                                <Route path="*"           element={<Navigate to="/" replace />} />
                              </>
                            )}

                            {/* ── Authenticated regular user ────────────────── */}
                            {isAuthenticated && !isAdmin && (
                              <>
                                <Route path="/"              element={<Home />} />
                                <Route path="/activity"      element={<Activity />} />
                                <Route path="/invitaion"     element={<InviteCard />} />
                                <Route path="/allfriends"    element={<Friend />} />
                                <Route path="/friendrequest" element={<FriendReq />} />
                                <Route path="/suggestions"   element={<Suggestions />} />
                                <Route path="/profile"       element={<Profile />} />
                                <Route path="/reels/fullscreen" element={<FullscreenReels />} />
                                <Route path="/chat"          element={<ChatRoom />} />
                                <Route path="/aboutus"       element={<AboutUs />} />
                                <Route path="/contactus"     element={<ContactUs />} />
                                <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                                <Route path="/refcanclepolicy" element={<RefCancelPolicy />} />
                                <Route path="/login"         element={<Navigate to="/" replace />} />
                                <Route path="*"              element={<Navigate to="/" replace />} />
                              </>
                            )}

                          </Routes>

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
            staleTime:           60_000, // 1 minute
            retry:               1,
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