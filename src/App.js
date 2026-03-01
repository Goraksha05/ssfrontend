import './App.css';
// import 'bootstrap/dist/css/bootstrap.min.css';
import './i18n/i18n';
import WelcomPage from './Components/WelcomPage';
import AdminRoute from './Components/Admin/AdminRoute/AdminRoute';
import AdminLayout from './Components/Admin/AdminLayout';
// import AdminDashboard from './Components/Admin/AdminDashboard';
// import AdminUserReport from './Components/Admin/UserReport';
import LogSignNewModel from './Components/Auth/RegiLogModel';
import Subscription from './Components/Subscription/Subscription';
import Navbartemp from './Components/Navbartemp';
import Home from './Components/HomeCompo/Home';
import Activity from './Components/UserActivities/Activity';
import Friend from './Components/Friendship/AllFriends';
import FriendReq from './Components/Friendship/FriendRequest';
import Suggestions from './Components/Friendship/Suggestion';
import Profile from './Components/Profile/Profile';
import PostState from './Context/Posts/PostState';
import ProfileState from './Context/Profile/ProfileState';
import ErrorBoundary from './Components/ErrorBoundary';
import "react-toastify/dist/ReactToastify.css";
import { useEffect } from 'react';
import { ToastContainer } from "react-toastify";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from './Context/Authorisation/AuthContext';
import { AuthProvider } from './Context/Authorisation/AuthContext';
import { StreakProvider } from './Context/Activity/StreakContext';
import { FriendProvider } from './Context/Friend/FriendContext';
import { ReferralProvider } from './Context/Activity/ReferralContext';
import { SubscriptionProvider } from './Context/Subscription/SubscriptionContext';
import { SocketProvider } from './Context/SocketContext';
import { OnlineUsersProvider } from './Context/OnlineUsersContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { UIProvider } from "./Context/ThemeUI/UIContext";
import AOS from 'aos';
import 'aos/dist/aos.css';
import FullscreenReels from './Components/Reels/FullscreenReels';
import TermsPopup from './Components/TermsAndConditions/TermsPopup';
import AboutUs from './Components/AboutUs/AboutUs';
import ContactUs from './Components/AboutUs/ContactUs'
import PrivacyPolicy from './Components/AboutUs/PrivacyPolicy';
import RefCancelPolicy from './Components/AboutUs/RefCancelPolicy';
import { NotificationProvider } from './Context/NotificationContext';
import { ChatProvider } from './Context/ChatContext';
import ChatRoom from './Components/ChatRoom/ChatRoom';
import InviteCard from './Components/InviteCard'

const queryClient = new QueryClient();

function AppContent() {
    const { isAuthenticated, user } = useAuth();

    useEffect(() => {
        AOS.init({ duration: 700, once: true });
    }, []);

    const isAdmin = isAuthenticated && user?.isAdmin;

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
                                                {!isAdmin && isAuthenticated && (
                                                    <>
                                                        <Navbartemp title={<b>SoShoLife</b>} myHome="Home" />
                                                        <Subscription />
                                                    </>
                                                )}

                                                <Routes>
                                                    {/* ─── Admin Routes ───────────── */}
                                                    {isAdmin && (
                                                        <>
                                                            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                                                            <Route path="/admin/*" element={
                                                                <AdminRoute>
                                                                    <AdminLayout />
                                                                    {/* <AdminDashboard /> */}
                                                                </AdminRoute>
                                                            } />
                                                            <Route path="*" element={<Navigate to="/admin/dashboard" />} />
                                                        </>
                                                    )}

                                                    {/* ─── Public Routes ───────────── */}
                                                    {!isAuthenticated && (
                                                        <>
                                                            <Route path="/" element={<WelcomPage />} />
                                                            <Route path="/login" element={<LogSignNewModel />} />
                                                            <Route path="/terms-popup" element={<TermsPopup />} />
                                                            <Route path="*" element={<Navigate to="/" />} />
                                                        </>
                                                    )}

                                                    {/* ─── Authenticated User Routes ───────────── */}
                                                    {isAuthenticated && !isAdmin && (
                                                        <>
                                                            <Route path="/" element={<Home />} />
                                                            <Route path="/activity" element={<Activity />} />
                                                            <Route path="/invitaion" element={<InviteCard />} />
                                                            <Route path="/allfriends" element={<Friend />} />
                                                            <Route path="/friendrequest" element={<FriendReq />} />
                                                            <Route path="/suggestions" element={<Suggestions />} />
                                                            <Route path="/profile" element={<Profile />} />
                                                            <Route path="/login" element={<Navigate to="/" />} />
                                                            <Route path="*" element={<Navigate to="/" />} />
                                                            <Route path="/reels/fullscreen" element={<FullscreenReels />} />

                                                            <Route path="/aboutus" element={<AboutUs />} />
                                                            <Route path="/contactus" element={<ContactUs />} />
                                                            <Route path="/privacypolicy" element={<PrivacyPolicy />} />
                                                            <Route path="/refcanclepolicy" element={<RefCancelPolicy />} />

                                                            <Route path="/chat" element={<ChatRoom />} />
                                                        </>
                                                    )}
                                                </Routes>

                                                <ToastContainer position="top-right" autoClose={5000} />
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

function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                <OnlineUsersProvider>
                    <ChatProvider>
                        <UIProvider>
                            <Router>
                                <AppContent />
                            </Router>
                        </UIProvider>
                    </ChatProvider>
                </OnlineUsersProvider>
            </AuthProvider>
            <ReactQueryDevtools initialIsOpen={false} />
        </QueryClientProvider>
    );
}


export default App;