/* App.js — SoShoLife User Panel Root */

import './App.css';

import {
  lazy,
  Suspense,
  useEffect,
} from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from 'react-router-dom';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import AOS from 'aos';
import 'aos/dist/aos.css';

// ── Context Providers ──────────────────────────────────────────────────────────
// Order matters: outer providers must not depend on inner ones.
// AuthProvider → OnlineUsersProvider → ChatProvider → ThemeProvider → UIProvider
//   → Router → (feature providers that need socket) → AppContent
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
import { ModalProvider } from './Context/ModalContext';

// ── Behavior SDK ───────────────────────────────────────────────────────────────
import { startBehaviorSDK, stopBehaviorSDK } from './utils/behaviorSDK';
import { initializeSocket, getSocket } from './WebSocket/WebSocketClient';

// ── Always-loaded components (on the critical path) ────────────────────────────
import ErrorBoundary from './Components/ErrorBoundary';
import Navbartemp from './Components/Navbartemp';
import Subscription from './Components/Subscription/Subscription';
import TermsPopup from './Components/TermsAndConditions/TermsPopup';
import KYCStatusBanner from './Components/KYC/KYCStatusBanner';
import ThemePalettePicker from './Components/Theme/ThemePalettePicker';

// ── Eagerly loaded pages (first render / auth flow) ────────────────────────────
import WelcomPage from './Components/WelcomPage';
import LogSignNewModel from './Components/Auth/RegiLogModel_OnlyCaptchaWidget';
import Home from './Components/HomeCompo/Home';
import UpgradePromptController from './Components/Subscription/UpgradePromptController';

// ── Lazily loaded pages (deferred until route is visited) ──────────────────────
// Each of these adds non-trivial JS to the bundle. Lazy-loading them cuts
// Time-to-Interactive on the initial page load.
const Activity         = lazy(() => import('./Components/UserActivities/Activity'));
const Friend           = lazy(() => import('./Components/Friendship/AllFriends'));
const FriendReq        = lazy(() => import('./Components/Friendship/FriendRequest'));
const Suggestions      = lazy(() => import('./Components/Friendship/Suggestion'));
const Profile          = lazy(() => import('./Components/Profile/ProfileWithKYC'));
const FullscreenReels  = lazy(() => import('./Components/Reels/FullscreenReels'));
const InviteCard       = lazy(() => import('./Components/InviteCard'));
const ChatRoom         = lazy(() => import('./Components/ChatRoom/ChatRoom'));
const AboutUs          = lazy(() => import('./Components/AboutUs/AboutUs'));
const ContactUs        = lazy(() => import('./Components/AboutUs/ContactUs'));
const PrivacyPolicy    = lazy(() => import('./Components/AboutUs/PrivacyPolicy'));
const RefCancelPolicy  = lazy(() => import('./Components/AboutUs/RefCancelPolicy'));

// ── QueryClient — module-level singleton ──────────────────────────────────────
// Defined outside of any component so it is created exactly once per JS module
// load, not recreated on hot-reload or across test runs.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           60_000, // 1 minute — avoids hammering the API on focus
      retry:               1,
      refetchOnWindowFocus: false,
    },
  },
});

// ── PageLoader — minimal spinner shown while lazy chunks are fetched ───────────
function PageLoader() {
  return (
    <div
      style={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
        minHeight:      '60vh',
        width:          '100%',
      }}
      aria-label="Loading page"
      role="status"
    >
      {/* Uses the app's existing CSS spinner class if defined, otherwise a
          simple inline ring so there is zero extra CSS dependency. */}
      <div className="ssl-spinner" />
    </div>
  );
}

// ── AppContent — rendered inside Router so useNavigate/useLocation work ────────
function AppContent() {

  const { isAuthenticated, user } = useAuth();
  const { isThemePickerOpen, closeThemePicker } = useUI();

  // Resolve user identity. AuthContext stores the server response from
  // getloggeduser which returns { id } (not { _id }).
  // We also check the legacy `isAdmin` boolean written by AuthService and the
  // canonical `role` field set by fetchuser middleware.
  const userId  = user?.id ?? user?._id ?? null;
  const isAdmin = isAuthenticated && (
    user?.isAdmin === true ||
    user?.role === 'admin' ||
    user?.role === 'super_admin'
  );

  // ── AOS (Animate On Scroll) ────────────────────────────────────────────────
  useEffect(() => {
    AOS.init({ duration: 700, once: true });
  }, []);

  // ── reCAPTCHA v3 script injection ─────────────────────────────────────────
  // Injected once so window.grecaptcha.execute() is available before any form
  // submission. Without this, all logins/signups fail with "Captcha not loaded".
  useEffect(() => {
    const v3SiteKey = process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY;
    if (!v3SiteKey) {
      console.warn('[reCAPTCHA] REACT_APP_RECAPTCHA_V3_SITE_KEY is not set.');
      return;
    }
    if (document.querySelector('#recaptcha-script')) return;

    const script = document.createElement('script');
    script.id    = 'recaptcha-script';
    script.src   = `https://www.google.com/recaptcha/api.js?render=${v3SiteKey}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    return () => {
      document.querySelector('#recaptcha-script')?.remove();
    };
  }, []);

  // ── Behavior SDK ─────────────────────────────────────────────────────────
  // Start only for authenticated, non-admin users.
  // The SDK collects behavioral signals (typing velocity, click intervals,
  // scroll patterns, navigation graph) for the Trust & Safety engine.
  //
  // A local `startedSession` flag prevents a stale cleanup closure from
  // stopping a session that a concurrent login just created (race-condition fix).
  useEffect(() => {
    let startedSession = false;

    const init = async () => {
      if (userId && !isAdmin && !window.__sdkSession) {
        await initializeSocket();          // ensure socket singleton is ready
        const wsClient = getSocket();
        if (wsClient) {
          window.__sdkSession = startBehaviorSDK(wsClient);
          startedSession = true;
        }
      }
    };

    init();

    return () => {
      if (startedSession && window.__sdkSession) {
        stopBehaviorSDK(window.__sdkSession);
        window.__sdkSession = null;
      }
    };
  }, [userId, isAdmin]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ErrorBoundary>
      <NotificationProvider>
        <PostState>
          <ProfileState>
            <KycProvider>
              <SocketProvider>
                <StreakProvider>
                  <FriendProvider>
                    <ReferralProvider>
                      <SubscriptionProvider>
                      <UpgradePromptController />                        
                        <StatusProvider>

                          {/* ── Persistent chrome (authenticated non-admin only) ── */}
                          {isAuthenticated && !isAdmin && (
                            <>
                              <Navbartemp title={<b>SoShoLife</b>} myHome="Home" />
                              <Subscription />
                              <KYCStatusBanner />
                            </>
                          )}

                          {/* ── Route tree ────────────────────────────────────── */}
                          <Suspense fallback={<PageLoader />}>
                            <Routes>

                              {/* ── Unauthenticated (public) ───────────────────── */}
                              {!isAuthenticated && (
                                <>
                                  <Route path="/"            element={<WelcomPage />} />
                                  <Route path="/login"       element={<LogSignNewModel />} />
                                  {/*
                                    /terms-popup is opened in a small popup window by
                                    the signup form (window.open). It must remain
                                    accessible without authentication.
                                  */}
                                  <Route path="/terms-popup" element={<TermsPopup />} />
                                  {/* Catch-all: unauthenticated visitors land on welcome */}
                                  <Route path="*"            element={<Navigate to="/" replace />} />
                                </>
                              )}

                              {/* ── Authenticated regular user ─────────────────── */}
                              {isAuthenticated && !isAdmin && (
                                <>
                                  <Route path="/"                  element={<Home />} />
                                  <Route path="/activity"          element={<Activity />} />

                                  {/* Canonical invitation route */}
                                  <Route path="/invitation"        element={<InviteCard />} />
                                  {/* Legacy typo redirect — preserves any bookmarked URLs */}
                                  <Route path="/invitaion"         element={<Navigate to="/invitation" replace />} />

                                  <Route path="/allfriends"        element={<Friend />} />
                                  <Route path="/friendrequest"     element={<FriendReq />} />
                                  <Route path="/suggestions"       element={<Suggestions />} />
                                  <Route path="/profile"           element={<Profile />} />
                                  <Route path="/reels/fullscreen"  element={<FullscreenReels />} />
                                  <Route path="/chat"              element={<ChatRoom />} />
                                  <Route path="/aboutus"           element={<AboutUs />} />
                                  <Route path="/contactus"         element={<ContactUs />} />
                                  <Route path="/privacypolicy"     element={<PrivacyPolicy />} />
                                  <Route path="/refcanclepolicy"   element={<RefCancelPolicy />} />

                                  {/* Redirect /login → home if already authenticated */}
                                  <Route path="/login"             element={<Navigate to="/" replace />} />

                                  {/* Catch-all for unmatched paths */}
                                  <Route path="*"                  element={<Navigate to="/" replace />} />
                                </>
                              )}

                              {/*
                                If an admin accidentally lands on the user app,
                                redirect them cleanly. The admin panel is a
                                separate application on its own origin/path.
                              */}
                              {isAuthenticated && isAdmin && (
                                <Route
                                  path="*"
                                  element={
                                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                                      <h2>Admin access detected.</h2>
                                      <p>
                                        Please use the{' '}
                                        <a href={process.env.REACT_APP_ADMIN_URL || '/admin'}>
                                          Admin Panel
                                        </a>{' '}
                                        to manage the platform.
                                      </p>
                                    </div>
                                  }
                                />
                              )}

                            </Routes>
                          </Suspense>

                          {/* ── Global Theme Picker Modal ──────────────────────── */}
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

// ── App — root component ───────────────────────────────────────────────────────
export default function App() {
  return (
    /*
      Provider nesting order (outermost → innermost):
        QueryClientProvider  — React Query cache
          I18nProvider       — translations (no external dependencies)
            AuthProvider     — token + user state + socket setup
              OnlineUsersProvider  — presence list (needs auth)
                ChatProvider       — chat state (needs auth + online users)
                  ThemeProvider    — theme tokens (no external deps)
                    UIProvider     — UI control state (needs Theme)
                      Router       — React Router (needs to be inside providers
                                     so providers can use useNavigate if needed)
                        AppContent — feature providers + routes
    */
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <AuthProvider>
          <OnlineUsersProvider>
            <ChatProvider>
              <ThemeProvider>
                <UIProvider>
                  <ModalProvider>
                    <Router>
                      <AppContent />
                    </Router>
                  </ModalProvider>
                </UIProvider>
              </ThemeProvider>
            </ChatProvider>
          </OnlineUsersProvider>
        </AuthProvider>
      </I18nProvider>

      {/*
        ToastContainer lives at the QueryClientProvider level — outside all
        feature providers — so it is always mounted regardless of auth state.
        react-toastify will always find a target container for toasts fired
        from anywhere in the tree (including NotificationContext's socket
        listener and AuthContext's token-expiry handling).

        position="bottom-right" avoids overlapping the top-left Navbar.
      */}
      <ToastContainer
        position="bottom-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />

      {/*
        ReactQueryDevtools is inside QueryClientProvider (required) and only
        loaded in development so it is completely absent from production bundles.
      */}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}