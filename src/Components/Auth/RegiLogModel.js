// RegiLogModel.js — Improved UI/UX
// Styles are in App.css (rl-root, rl-card, rl-tab-bar, rl-glossy-btn, etc.)
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import AuthService from '../../Services/AuthService';
import ForgotPasswordModal from './ForgotPasswordModal';
import Logo from '../XLogo/Logo';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck, Eye, EyeOff, LogIn, UserPlus } from 'lucide-react';
import { initializeSocket } from '../../WebSocket/WebSocketClient';
import TermsModal from '../TermsAndConditions/TermsModal';
import apiRequest from '../../utils/apiRequest';

// Import glossy button images from Assets
import GreenGlossyBtn from '../../Assets/GreenGlossy.png';
import RedGlossyBtn from '../../Assets/RedGlossy.png';

const LogSignNewModel = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [isAdminLogin, setIsAdminLogin] = useState(false);
    const [role] = useState('user');
    const [isLogin, setIsLogin] = useState(true);
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [postLoginRedirect, setPostLoginRedirect] = useState('');
    const [mounted, setMounted] = useState(false);

    const [loginData, setLoginData] = useState({ identifier: '', password: '' });
    const [signupData, setSignupData] = useState({
        name: '', username: '', email: '', phone: '',
        password: '', cpassword: '', referralno: '',
    });

    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupCPassword, setShowSignupCPassword] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    const isPasswordMatch = (pass, confirm) => pass === confirm;

    const resetSignup = () => {
        setSignupData({ name: '', username: '', email: '', phone: '', password: '', cpassword: '', referralno: '' });
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const { identifier, password } = loginData;
        if (!identifier.trim() || !password.trim()) {
            toast.error('Please enter both username/email/phone and password.');
            return;
        }
        try {
            const response = isAdminLogin
                ? await AuthService.loginAdmin({ identifier, password })
                : await AuthService.login({ identifier, password });

            if (response?.success && response.authtoken) {
                localStorage.setItem('token', response.authtoken);
                await login(response.authtoken);
                await initializeSocket();
                setLoginData({ identifier: '', password: '' });
                setPostLoginRedirect(response.user?.isAdmin ? '/admin/dashboard' : '/');
                setShowTermsModal(true);
                navigate(response.user?.isAdmin ? '/admin/dashboard' : '/');
            } else {
                toast.error(response?.error || 'Login failed. Check your credentials.');
            }
        } catch (error) {
            const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Login failed!';
            toast.error(errMsg);
        }
    };

    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        const { name, username, email, phone, password, cpassword, referralno } = signupData;

        if (
            name.trim().length < 3 ||
            username.trim().length < 3 ||
            username.includes(' ') ||
            !/\S+@\S+\.\S+/.test(email) ||
            !/^\d{10}$/.test(phone) ||
            password.trim().length < 5
        ) {
            toast.error('Please fill all fields correctly.');
            return;
        }
        if (!isPasswordMatch(password, cpassword)) {
            toast.error('Passwords do not match.');
            return;
        }
        try {
            const result = await AuthService.signup({ name, username, email, phone, password, referralno, role });
            if (result.success && result.authtoken) {
                localStorage.setItem('token', result.authtoken);
                login(result.authtoken);
                toast.success('Signup successful! You are now logged in.');
                setPostLoginRedirect('/');
                setShowTermsModal(true);
                navigate('/');
                resetSignup();
                setAcceptedTerms(false);
            } else {
                toast.error('Signup failed: ' + (result.error || 'Unknown error.'));
            }
        } catch (error) {
            toast.error('Signup process failed. Please try again.');
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (isLogin) setLoginData(prev => ({ ...prev, [name]: value }));
        else setSignupData(prev => ({ ...prev, [name]: value }));
    };

    return (
        <div className="rl-root">
                {/* Logo */}
                <div className="rl-header">
                    <Logo />
                </div>

                {/* Tagline */}
                <p className="rl-tagline">
                    Your own 'Social Media' platform — <strong>"To Get Recognition &amp; Financial Freedom"</strong>
                </p>

                {/* Tab toggle */}
                <div className="rl-tab-bar">
                    <button
                        className={`rl-tab ${isLogin ? 'active-login' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        <LogIn size={16} /> Login
                    </button>
                    <button
                        className={`rl-tab ${!isLogin ? 'active-signup' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        <UserPlus size={16} /> Signup
                    </button>
                </div>

                {/* Card */}
                <div className={`rl-card ${mounted ? 'show' : ''}`}>

                    {isLogin ? (
                        /* ── LOGIN FORM ── */
                        <form onSubmit={handleLoginSubmit} noValidate>
                            <div className="rl-card-title">👋 Welcome Back</div>

                            {/* Admin toggle */}
                            <label className="rl-admin-check">
                                <input
                                    type="checkbox"
                                    checked={isAdminLogin}
                                    onChange={() => setIsAdminLogin(p => !p)}
                                />
                                Login as Admin
                            </label>

                            <div className="rl-input-wrap">
                                <input
                                    type="text"
                                    name="identifier"
                                    className="rl-input"
                                    placeholder="Username, Email or Phone"
                                    autoComplete="username"
                                    value={loginData.identifier}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="rl-input-wrap">
                                <input
                                    type={showLoginPassword ? 'text' : 'password'}
                                    name="password"
                                    className="rl-input has-eye"
                                    placeholder="Password"
                                    autoComplete="current-password"
                                    value={loginData.password}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="rl-eye-btn"
                                    onClick={() => setShowLoginPassword(p => !p)}
                                    tabIndex={-1}
                                >
                                    {showLoginPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>

                            <div className="rl-forgot">
                                <a href="/" onClick={(e) => { e.preventDefault(); setShowForgotModal(true); }}>
                                    Forgot Password?
                                </a>
                            </div>

                            {/* Green glossy login button */}
                            <button type="submit" className="rl-glossy-btn">
                                <img src={GreenGlossyBtn} alt="Login" />
                                <span className="rl-glossy-btn-label">
                                    <LogIn size={20} /> Login Now
                                </span>
                            </button>

                            <p className="rl-switch">
                                Not a Member?{' '}
                                <a href="/" onClick={(e) => { e.preventDefault(); setIsLogin(false); }}>
                                    Signup Now
                                </a>
                            </p>
                        </form>
                    ) : (
                        /* ── SIGNUP FORM ── */
                        <form onSubmit={handleSignupSubmit} noValidate>
                            <div className="rl-card-title">✨ Create Account</div>

                            {/* Referral */}
                            <div className="rl-input-wrap">
                                <BadgeCheck className="rl-input-icon" size={20} />
                                <input
                                    type="text"
                                    name="referralno"
                                    className="rl-input has-icon"
                                    placeholder="Referral ID (e.g., DU688828)"
                                    value={signupData.referralno}
                                    onChange={handleInputChange}
                                />
                            </div>

                            <div className="rl-divider">Personal Info</div>

                            <div className="rl-input-wrap">
                                <input
                                    type="text"
                                    name="name"
                                    className="rl-input"
                                    placeholder="Full Name"
                                    autoComplete="name"
                                    value={signupData.name}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="rl-input-wrap">
                                <input
                                    type="text"
                                    name="username"
                                    className="rl-input"
                                    placeholder="Username (no spaces)"
                                    autoComplete="username"
                                    value={signupData.username}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="rl-input-wrap">
                                <input
                                    type="email"
                                    name="email"
                                    className="rl-input"
                                    placeholder="Email Address"
                                    autoComplete="email"
                                    value={signupData.email}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="rl-input-wrap">
                                <input
                                    type="text"
                                    name="phone"
                                    className="rl-input"
                                    placeholder="10-digit Phone Number"
                                    autoComplete="tel"
                                    value={signupData.phone}
                                    onChange={handleInputChange}
                                    required
                                />
                            </div>

                            <div className="rl-divider">Security</div>

                            {/* Signup Password */}
                            <div className="rl-input-wrap">
                                <input
                                    type={showSignupPassword ? 'text' : 'password'}
                                    name="password"
                                    className="rl-input has-eye"
                                    placeholder="Password (min 5 chars)"
                                    autoComplete="new-password"
                                    value={signupData.password}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="rl-eye-btn"
                                    onClick={() => setShowSignupPassword(p => !p)}
                                    tabIndex={-1}
                                >
                                    {showSignupPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>

                            {/* Confirm Password */}
                            <div className="rl-input-wrap">
                                <input
                                    type={showSignupCPassword ? 'text' : 'password'}
                                    name="cpassword"
                                    className="rl-input has-eye"
                                    placeholder="Confirm Password"
                                    autoComplete="new-password"
                                    value={signupData.cpassword}
                                    onChange={handleInputChange}
                                    required
                                />
                                <button
                                    type="button"
                                    className="rl-eye-btn"
                                    onClick={() => setShowSignupCPassword(p => !p)}
                                    tabIndex={-1}
                                >
                                    {showSignupCPassword ? <EyeOff size={22} /> : <Eye size={22} />}
                                </button>
                            </div>

                            {signupData.cpassword && (
                                <p className="rl-pw-match" style={{ color: signupData.password === signupData.cpassword ? '#00c853' : '#e53935' }}>
                                    {signupData.password === signupData.cpassword ? '✓ Passwords match' : '✕ Passwords do not match'}
                                </p>
                            )}

                            {/* Terms */}
                            <label className="rl-terms-row">
                                <input
                                    type="checkbox"
                                    checked={acceptedTerms}
                                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                                    required
                                />
                                <span>
                                    I agree to the{' '}
                                    <a
                                        href="/terms"
                                        className="rl-terms-link"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            const w = 640, h = 625;
                                            window.open('/terms-popup', 'TermsAndConditions',
                                                `width=${w},height=${h},top=${(window.innerHeight - h) / 2},left=${(window.innerWidth - w) / 2},resizable,scrollbars=yes`);
                                        }}
                                    >
                                        Terms & Conditions
                                    </a>
                                </span>
                            </label>

                            {/* Green glossy signup button */}
                            <button type="submit" className="rl-glossy-btn" disabled={!acceptedTerms}>
                                <img src={GreenGlossyBtn} alt="Signup" />
                                <span className="rl-glossy-btn-label">
                                    <UserPlus size={20} /> Create Account
                                </span>
                            </button>

                            {/* Red glossy cancel button */}
                            <button
                                type="button"
                                className="rl-glossy-btn"
                                onClick={() => { resetSignup(); setAcceptedTerms(false); }}
                            >
                                <img src={RedGlossyBtn} alt="Cancel" />
                                <span className="rl-glossy-btn-label">Cancel / Reset</span>
                            </button>

                            <p className="rl-switch">
                                Already a Member?{' '}
                                <a href="/" onClick={(e) => { e.preventDefault(); setIsLogin(true); }}>
                                    Login Now
                                </a>
                            </p>
                        </form>
                    )}
                </div>

                {/* Modals */}
                <TermsModal
                    isOpen={showTermsModal}
                    onClose={() => setShowTermsModal(false)}
                    onAccept={async () => {
                        try {
                            await apiRequest.post('/api/auth/accept-terms', {}, {
                                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                            });
                        } catch (err) {
                            console.error('Failed to record terms acceptance:', err);
                        } finally {
                            setShowTermsModal(false);
                            navigate(postLoginRedirect);
                        }
                    }}
                />
                <ForgotPasswordModal show={showForgotModal} onClose={() => setShowForgotModal(false)} />
            </div>
    );
};

export default LogSignNewModel;