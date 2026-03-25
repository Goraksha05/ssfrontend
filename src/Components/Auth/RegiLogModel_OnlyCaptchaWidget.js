// RegiLogModel.js — Hybrid reCAPTCHA v3 (primary) + v2 (fallback)
// Styles are in App.css (rl-root, rl-card, rl-tab-bar, rl-glossy-btn, etc.)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import AuthService from '../../Services/AuthService';
import ForgotPasswordModal from './ForgotPasswordModal';
import Logo from '../XLogo/Logo';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck, Eye, EyeOff, LogIn, UserPlus, ShieldCheck } from 'lucide-react';
import { initializeSocket } from '../../WebSocket/WebSocketClient';
import TermsModal from '../TermsAndConditions/TermsModal';
import apiRequest from '../../utils/apiRequest';

import GreenGlossyBtn from '../../Assets/GreenGlossy.png';
import RedGlossyBtn from '../../Assets/RedGlossy.png';

// ─── CaptchaWidget (v2 fallback checkbox) ────────────────────────────────────
//
// Rendered ONLY when the backend signals { fallback: "v2_required" }.
// Normal users never see this — they are silently verified by v3.
//
// Props:
//   widgetId  — unique HTML id for the container div
//   onVerify  — called with token string when user checks the box
//   onExpire  — called with no args when token expires (2 min)
const CaptchaWidget = ({ widgetId, onVerify, onExpire }) => {
    const containerRef = useRef(null);
    const renderedRef  = useRef(false);

    useEffect(() => {
        if (renderedRef.current) return;

        const render = () => {
            if (!containerRef.current) return;
            if (containerRef.current.childElementCount > 0) {
                renderedRef.current = true;
                return;
            }
            try {
                window.grecaptcha.render(containerRef.current, {
                    sitekey:            process.env.REACT_APP_RECAPTCHA_V2_SITE_KEY,
                    callback:           onVerify,
                    'expired-callback': onExpire,
                    theme:              'light',
                    size:               'normal',
                });
                renderedRef.current = true;
            } catch (err) {
                if (!String(err).includes('already been rendered')) {
                    console.error('[CaptchaWidget] render error:', err);
                }
            }
        };

        if (window.grecaptcha?.render) {
            render();
        } else {
            const interval = setInterval(() => {
                if (window.grecaptcha?.render) {
                    clearInterval(interval);
                    render();
                }
            }, 100);
            return () => clearInterval(interval);
        }
    }, [onVerify, onExpire]);

    return <div id={widgetId} ref={containerRef} className="rl-captcha-widget" />;
};

// ─── executeV3 helper ─────────────────────────────────────────────────────────
// Wraps grecaptcha.execute() in a Promise with a timeout guard.
// Returns the token string or null on failure.
const executeV3 = (action) => {
    return new Promise((resolve) => {
        const siteKey = process.env.REACT_APP_RECAPTCHA_V3_SITE_KEY;
        if (!siteKey) {
            console.warn('[reCAPTCHA v3] REACT_APP_RECAPTCHA_V3_SITE_KEY not set.');
            resolve(null);
            return;
        }

        const attempt = () => {
            if (window.grecaptcha?.execute) {
                window.grecaptcha.execute(siteKey, { action })
                    .then(resolve)
                    .catch((err) => {
                        console.error('[reCAPTCHA v3] execute error:', err);
                        resolve(null);
                    });
            } else {
                // Script not yet loaded — retry
                setTimeout(attempt, 150);
            }
        };

        attempt();
    });
};

// ─── Component ────────────────────────────────────────────────────────────────
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
    const [loading, setLoading] = useState(false);

    // ── Hybrid captcha state ──────────────────────────────────────────────────
    // captchaMode: "v3" → invisible, attempt first
    //              "v2" → checkbox, shown only after backend fallback signal
    const [loginCaptchaMode,  setLoginCaptchaMode]  = useState('v3');
    const [signupCaptchaMode, setSignupCaptchaMode] = useState('v3');

    // v2 tokens — only populated when the v2 widget is shown and user checks box
    const [loginV2Token,  setLoginV2Token]  = useState('');
    const [signupV2Token, setSignupV2Token] = useState('');

    const onLoginV2Verify   = useCallback((token) => setLoginV2Token(token),  []);
    const onLoginV2Expire   = useCallback(() => setLoginV2Token(''),           []);
    const onSignupV2Verify  = useCallback((token) => setSignupV2Token(token), []);
    const onSignupV2Expire  = useCallback(() => setSignupV2Token(''),          []);

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

    const resetSignup = () => {
        setSignupData({ name: '', username: '', email: '', phone: '', password: '', cpassword: '', referralno: '' });
        setSignupCaptchaMode('v3');
        setSignupV2Token('');
    };

    // ── resetCaptchaWidget ────────────────────────────────────────────────────
    // Safely resets the v2 widget if it's rendered.
    const resetCaptchaWidget = () => {
        try {
            if (window.grecaptcha?.reset) window.grecaptcha.reset();
        } catch (_) { /* widget may not be rendered yet — ignore */ }
    };

    // ── handleLoginSubmit ─────────────────────────────────────────────────────
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const { identifier, password } = loginData;

        if (!identifier.trim() || !password.trim()) {
            toast.error('Please enter both username/email/phone and password.');
            return;
        }

        // v2 mode: require the checkbox token before submitting
        if (loginCaptchaMode === 'v2' && !loginV2Token) {
            toast.error('Please complete the "I am not a robot" check.');
            return;
        }

        setLoading(true);
        try {
            let captchaToken;
            let captchaType;

            if (loginCaptchaMode === 'v3') {
                captchaToken = await executeV3('login');
                captchaType  = 'v3';
                if (!captchaToken) {
                    // v3 script not loaded — degrade gracefully to v2
                    setLoginCaptchaMode('v2');
                    toast.info('Please complete the security check below.');
                    setLoading(false);
                    return;
                }
            } else {
                captchaToken = loginV2Token;
                captchaType  = 'v2';
            }

            const response = isAdminLogin
                ? await AuthService.loginAdmin({ identifier, password, captchaToken, captchaType, captchaAction: 'login' })
                : await AuthService.login({ identifier, password, captchaToken, captchaType, captchaAction: 'login' });

            // Backend signals that v3 score was too low → show v2 checkbox
            if (response?.fallback === 'v2_required') {
                setLoginCaptchaMode('v2');
                toast.info('Additional verification required. Please complete the checkbox below.');
                setLoading(false);
                return;
            }

            if (response?.success && response.authtoken) {
                localStorage.setItem('token', response.authtoken);
                await login(response.authtoken);
                await initializeSocket();
                setLoginData({ identifier: '', password: '' });
                setLoginV2Token('');
                setLoginCaptchaMode('v3');
                setPostLoginRedirect(response.user?.isAdmin ? '/admin/dashboard' : '/');
                setShowTermsModal(true);
                navigate(response.user?.isAdmin ? '/admin/dashboard' : '/');
            } else {
                toast.error(response?.error || 'Login failed. Check your credentials.');
                setLoginV2Token('');
                resetCaptchaWidget();
            }
        } catch (error) {
            const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Login failed!';
            toast.error(errMsg);
            setLoginV2Token('');
            resetCaptchaWidget();
        } finally {
            setLoading(false);
        }
    };

    // ── handleSignupSubmit ────────────────────────────────────────────────────
    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        const { name, username, email, phone, password, referralno } = signupData;

        // v2 mode: require checkbox token
        if (signupCaptchaMode === 'v2' && !signupV2Token) {
            toast.error('Please complete the "I am not a robot" check.');
            return;
        }

        setLoading(true);
        try {
            let captchaToken;
            let captchaType;

            if (signupCaptchaMode === 'v3') {
                captchaToken = await executeV3('signup');
                captchaType  = 'v3';
                if (!captchaToken) {
                    setSignupCaptchaMode('v2');
                    toast.info('Please complete the security check below.');
                    setLoading(false);
                    return;
                }
            } else {
                captchaToken = signupV2Token;
                captchaType  = 'v2';
            }

            const result = await AuthService.signup({
                name, username, email, phone, password, referralno, role,
                captchaToken, captchaType, captchaAction: 'signup',
            });

            // Backend fallback signal
            if (result?.fallback === 'v2_required') {
                setSignupCaptchaMode('v2');
                toast.info('Additional verification required. Please complete the checkbox below.');
                setLoading(false);
                return;
            }

            if (result.success && result.authtoken) {
                localStorage.setItem('token', result.authtoken);
                login(result.authtoken);
                toast.success('Account created! Welcome to SoShoLife 🎉');
                setPostLoginRedirect('/');
                setShowTermsModal(true);
                navigate('/');
                resetSignup();
                setAcceptedTerms(false);
            } else {
                toast.error('Signup failed: ' + (result.error || 'Unknown error.'));
                setSignupV2Token('');
                resetCaptchaWidget();
            }
        } catch (error) {
            console.error('Signup error:', error);
            toast.error('Signup process failed. Please try again.');
            setSignupV2Token('');
            resetCaptchaWidget();
        } finally {
            setLoading(false);
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

                        {/* v2 fallback widget — only shown when backend signals low v3 score */}
                        {loginCaptchaMode === 'v2' && (
                            <div className="rl-captcha-row mb-2">
                                <p className="rl-captcha-hint" style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>
                                    🔐 Extra verification required
                                </p>
                                <CaptchaWidget
                                    widgetId="login-captcha-v2 mb-2"
                                    onVerify={onLoginV2Verify}
                                    onExpire={onLoginV2Expire}
                                />
                                {loginV2Token && (
                                    <span className="rl-captcha-ok">✓ Verified</span>
                                )}
                            </div>
                        )}

                        {/* Login button — disabled only while loading OR during v2 mode before checkbox */}
                        <button
                            type="submit"
                            className="rl-glossy-btn"
                            disabled={loading || (loginCaptchaMode === 'v2' && !loginV2Token)}
                        >
                            <img src={GreenGlossyBtn} alt="Login" />
                            <span className="rl-glossy-btn-label">
                                <LogIn size={20} /> {loading ? 'Please wait…' : 'Login Now'}
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
                                    Terms &amp; Conditions
                                </a>
                            </span>
                        </label>

                        {/* v2 fallback widget — only shown when backend signals low v3 score */}
                        {signupCaptchaMode === 'v2' && (
                            <div className="rl-captcha-row mb-2">
                                <p className="rl-captcha-hint" style={{ fontSize: '0.8rem', color: '#888', marginBottom: 6 }}>
                                    🔐 Extra verification required
                                </p>
                                <CaptchaWidget
                                    widgetId="signup-captcha-v2 mb-2"
                                    onVerify={onSignupV2Verify}
                                    onExpire={onSignupV2Expire}
                                />
                                {signupV2Token && (
                                    <span className="rl-captcha-ok">✓ Verified</span>
                                )}
                            </div>
                        )}

                        {/* Create Account button */}
                        <button
                            type="submit"
                            className="rl-glossy-btn"
                            disabled={!acceptedTerms || loading || (signupCaptchaMode === 'v2' && !signupV2Token)}
                        >
                            <img src={GreenGlossyBtn} alt="Create Account" />
                            <span className="rl-glossy-btn-label">
                                <ShieldCheck size={20} /> {loading ? 'Creating account…' : 'Create Account'}
                            </span>
                        </button>

                        {/* Red glossy cancel button */}
                        <button
                            type="button"
                            className="rl-glossy-btn"
                            onClick={() => { resetSignup(); setAcceptedTerms(false); }}
                            disabled={loading}
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