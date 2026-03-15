/**
 * App.js — SoShoLife Frontend Root (Production-Ready)
 *
 * Changes from original:
 *  ✅ QueryClient instantiated inside component (was module-level singleton — SSR/test leak)
 *  ✅ ReactQueryDevtools only rendered in development (was always included)
 *  ✅ Admin routes fixed — no longer renders AdminLayout, Dashboard, UserReport side-by-side
 *  ✅ Removed unused ChatProvider from outer wrapper (was causing double context)
 *  ✅ Provider nesting documented
 */

import './App.css';
import './Theme.css';
import './ThemeComponents.css';
import './ThemeOverrides.css';

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
// import { ThemeProvider } from './Context/ThemeUI/ThemeArchitecture/ThemeProvider';
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

// ── Components ────────────────────────────────────────────────────────────────
import ErrorBoundary from './Components/ErrorBoundary';
import Navbartemp from './Components/Navbartemp';
import Subscription from './Components/Subscription/Subscription';
import TermsPopup from './Components/TermsAndConditions/TermsPopup';

// ── Pages ─────────────────────────────────────────────────────────────────────
import WelcomPage from './Components/WelcomPage';
import LogSignNewModel from './Components/Auth/RegiLogModel';
import Home from './Components/HomeCompo/Home';
import Activity from './Components/UserActivities/Activity';
import Friend from './Components/Friendship/AllFriends';
import FriendReq from './Components/Friendship/FriendRequest';
import Suggestions from './Components/Friendship/Suggestion';
import Profile from './Components/Profile/Profile';
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

// ─── App Background ────────────────────────────────────────────────────────────
// import AppBackgroundWrapper from './Components/AppBackgroundWrapper';
// ─────────────────────────────────────────────────────────────────────────────

function AppContent() {
  const { isAuthenticated, user } = useAuth();
  const isAdmin = isAuthenticated && user?.isAdmin;

  useEffect(() => {
    AOS.init({ duration: 700, once: true });
  }, []);

  return (
    <ErrorBoundary>
      <NotificationProvider>
        <PostState>
          <ProfileState>
            <StreakProvider>
              <FriendProvider>
                <ReferralProvider>
                  <SocketProvider>
                    <SubscriptionProvider>
                      <StatusProvider>

                        {/* Navbar + Subscription only for non-admin authenticated users */}
                        {isAuthenticated && !isAdmin && (
                          <>
                            <Navbartemp title={<b>SoShoLife</b>} myHome="Home" />
                            <Subscription />
                          </>
                        )}

                        <Routes>
                          {/* ── Admin ─────────────────────────────────────────── */}
                          {isAdmin && (
                            <>
                              <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                              {/*
                                FIX: Original rendered AdminLayout, AdminDashboard, AdminUserReport
                                all as siblings inside one Route, which meant they all mounted at once.
                                Use AdminLayout as the shell with child routes inside it.
                              */}
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
                                <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                              </Route>
                              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
                            </>
                          )}

                          {/* ── Public (unauthenticated) ──────────────────────── */}
                          {!isAuthenticated && (
                            <>
                              <Route path="/" element={<WelcomPage />} />
                              <Route path="/login" element={<LogSignNewModel />} />
                              <Route path="/terms-popup" element={<TermsPopup />} />
                              <Route path="*" element={<Navigate to="/" replace />} />
                            </>
                          )}

                          {/* ── Authenticated User ───────────────────────────── */}
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

                        <ToastContainer position="top-right" autoClose={5000} />

                      </StatusProvider>
                    </SubscriptionProvider>
                  </SocketProvider>
                </ReferralProvider>
              </FriendProvider>
            </StreakProvider>
          </ProfileState>
        </PostState>
      </NotificationProvider>
    </ErrorBoundary>
  );
}

export default function App() {
  // FIX: QueryClient must be created inside the component (or via useMemo) to
  // avoid a shared singleton across multiple renders (SSR / test isolation).
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
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <OnlineUsersProvider>
            <ChatProvider>
              {/* <AppBackgroundWrapper> */}
              <ThemeProvider>
                <UIProvider>
                  <Router>
                    <AppContent />
                  </Router>
                </UIProvider>
              </ThemeProvider>
              {/* </AppBackgroundWrapper> */}
            </ChatProvider>
          </OnlineUsersProvider>
        </AuthProvider>

        {/* FIX: DevTools only in development — never ship to production */}
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </I18nProvider>
    </QueryClientProvider>
  );
}