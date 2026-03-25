// RegiLogModel.js — Improved UI/UX
// Styles are in App.css (rl-root, rl-card, rl-tab-bar, rl-glossy-btn, etc.)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import AuthService from '../../Services/AuthService';
import ForgotPasswordModal from './ForgotPasswordModal';
import Logo from '../XLogo/Logo';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, Send, RefreshCw } from 'lucide-react';
import { initializeSocket } from '../../WebSocket/WebSocketClient';
import TermsModal from '../TermsAndConditions/TermsModal';
import apiRequest from '../../utils/apiRequest';

// Import glossy button images from Assets
import GreenGlossyBtn from '../../Assets/GreenGlossy.png';
import RedGlossyBtn from '../../Assets/RedGlossy.png';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/**
 * CaptchaWidget — renders a reCAPTCHA v2 "I'm not a robot" checkbox.
 *
 * Why v2 instead of v3?
 *   v3 is completely invisible — users never see or interact with it. If the
 *   score is too low the request is silently rejected with no way for the user
 *   to recover. v2 shows a visible checkbox (and sometimes an image challenge)
 *   so the user knows a security check is happening and can always complete it.
 *
 * Usage:
 *   <CaptchaWidget widgetId="login-captcha" onVerify={setLoginCaptchaToken} onExpire={...} />
 *
 * Props:
 *   widgetId  — unique HTML id for the container div (needed when two widgets
 *               are mounted on the same page at the same time, e.g. login +
 *               signup rendered side-by-side, though here we only show one at
 *               a time).
 *   onVerify  — called with the token string when the user checks the box.
 *   onExpire  — called with no args when the token expires (2 min timeout).
 */
const CaptchaWidget = ({ widgetId, onVerify, onExpire }) => {
    const containerRef = useRef(null);
    const renderedRef  = useRef(false);

    useEffect(() => {
        if (renderedRef.current) return; // already rendered in this mount

        const render = () => {
            if (!containerRef.current) return;
            // Guard against double-render if the effect fires twice (React StrictMode)
            if (containerRef.current.childElementCount > 0) {
                renderedRef.current = true;
                return;
            }
            try {
                window.grecaptcha.render(containerRef.current, {
                    sitekey:          process.env.REACT_APP_RECAPTCHA_SITE_KEY,
                    callback:         onVerify,
                    'expired-callback': onExpire,
                    theme:            'light',
                    size:             'normal',
                });
                renderedRef.current = true;
            } catch (err) {
                // "already rendered" error is benign — ignore it
                if (!String(err).includes('already been rendered')) {
                    console.error('[CaptchaWidget] render error:', err);
                }
            }
        };

        if (window.grecaptcha?.render) {
            render();
        } else {
            // Script not yet fully loaded — wait for it
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
    // loading state prevents double-submit and drives button disabled/label
    const [loading, setLoading] = useState(false);

    // reCAPTCHA v2 tokens — one per form.
    // Tokens are set by the widget's onVerify callback and cleared on expiry
    // or after a successful/failed submission so the user must re-check the box.
    const [loginCaptchaToken,  setLoginCaptchaToken]  = useState('');
    const [signupCaptchaToken, setSignupCaptchaToken] = useState('');

    // Stable callbacks passed to CaptchaWidget — wrapped in useCallback so the
    // widget effect dependency array does not re-fire on every render.
    const onLoginCaptchaVerify  = useCallback((token) => setLoginCaptchaToken(token),  []);
    const onLoginCaptchaExpire  = useCallback(() => setLoginCaptchaToken(''),           []);
    const onSignupCaptchaVerify = useCallback((token) => setSignupCaptchaToken(token), []);
    const onSignupCaptchaExpire = useCallback(() => setSignupCaptchaToken(''),          []);

    // OTP state — signup is a two-step flow:
    //   step 'form'   → user fills in all fields, clicks "Send OTP"
    //   step 'otp'    → OTP sent to phone, user enters code, clicks "Verify & Create Account"
    const [otpStep, setOtpStep] = useState('form'); // 'form' | 'otp'
    const [otpCode, setOtpCode] = useState('');
    const [otpLoading, setOtpLoading] = useState(false);

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
        setOtpStep('form');
        setOtpCode('');
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const { identifier, password } = loginData;
        if (!identifier.trim() || !password.trim()) {
            toast.error('Please enter both username/email/phone and password.');
            return;
        }
        // reCAPTCHA v2: token is set by the widget's onVerify callback when the
        // user checks "I'm not a robot". If they haven't done so yet (or it
        // expired) loginCaptchaToken is an empty string.
        if (!loginCaptchaToken) {
            toast.error('Please complete the "I am not a robot" check.');
            return;
        }
        setLoading(true);
        try {
            const response = isAdminLogin
                ? await AuthService.loginAdmin({ identifier, password, captchaToken: loginCaptchaToken })
                : await AuthService.login({ identifier, password, captchaToken: loginCaptchaToken });

            if (response?.success && response.authtoken) {
                localStorage.setItem('token', response.authtoken);
                await login(response.authtoken);
                await initializeSocket();
                setLoginData({ identifier: '', password: '' });
                setLoginCaptchaToken('');
                setPostLoginRedirect(response.user?.isAdmin ? '/admin/dashboard' : '/');
                setShowTermsModal(true);
                navigate(response.user?.isAdmin ? '/admin/dashboard' : '/');
            } else {
                toast.error(response?.error || 'Login failed. Check your credentials.');
                // Reset the widget so the user must re-check the box on retry
                setLoginCaptchaToken('');
                if (window.grecaptcha?.reset) window.grecaptcha.reset();
            }
        } catch (error) {
            const errMsg = error?.response?.data?.error || error?.response?.data?.message || 'Login failed!';
            toast.error(errMsg);
            setLoginCaptchaToken('');
            if (window.grecaptcha?.reset) window.grecaptcha.reset();
        } finally {
            setLoading(false);
        }
    };

    // ── Step 1: validate fields → send OTP to phone ──────────────────────────
    const handleSendOtp = async (e) => {
        e.preventDefault();
        const { name, username, email, phone, password, cpassword } = signupData;

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
        if (!acceptedTerms) {
            toast.error('Please accept the Terms & Conditions first.');
            return;
        }
        // reCAPTCHA v2: user must check the box before sending OTP
        if (!signupCaptchaToken) {
            toast.error('Please complete the "I am not a robot" check.');
            return;
        }

        setOtpLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/api/otp/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: signupData.phone, captchaToken: signupCaptchaToken }),
            });
            const data = await res.json();
            if (data.success) {
                setOtpStep('otp');
                setSignupCaptchaToken(''); // token consumed — reset for verify step
                if (window.grecaptcha?.reset) window.grecaptcha.reset();
                toast.success('OTP sent to your phone!');
            } else {
                toast.error('Failed to send OTP: ' + (data.message || 'Please try again.'));
                setSignupCaptchaToken('');
                if (window.grecaptcha?.reset) window.grecaptcha.reset();
            }
        } catch (err) {
            console.error('OTP send error:', err);
            toast.error('Could not send OTP. Please try again.');
            setSignupCaptchaToken('');
            if (window.grecaptcha?.reset) window.grecaptcha.reset();
        } finally {
            setOtpLoading(false);
        }
    };

    // ── Step 2: verify OTP → create account ──────────────────────────────────
    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        const { name, username, email, phone, password, referralno } = signupData;

        if (!otpCode.trim()) {
            toast.error('Please enter the OTP sent to your phone.');
            return;
        }
        // A fresh captcha token is required for the /api/auth/createuser endpoint.
        // The token from step 1 was consumed by /api/otp/send, so the user must
        // check the box again — this is intentional and adds an extra fraud layer.
        if (!signupCaptchaToken) {
            toast.error('Please complete the "I am not a robot" check.');
            return;
        }

        setLoading(true);
        try {
            // Step 2a: Verify OTP
            const verifyRes = await fetch(`${BACKEND_URL}/api/otp/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, otpCode: otpCode.trim() }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyData.success) {
                toast.error('Invalid OTP. Please check and try again.');
                return;
            }

            // Step 2b: Create the account using the v2 token the user just checked
            const result = await AuthService.signup({
                name, username, email, phone, password, referralno, role,
                captchaToken: signupCaptchaToken,
            });

            if (result.success && result.authtoken) {
                localStorage.setItem('token', result.authtoken);
                login(result.authtoken);
                toast.success('Account created! Welcome to SoShoLife 🎉');
                setPostLoginRedirect('/');
                setShowTermsModal(true);
                navigate('/');
                resetSignup();
                setAcceptedTerms(false);
                setSignupCaptchaToken('');
            } else {
                toast.error('Signup failed: ' + (result.error || 'Unknown error.'));
                setSignupCaptchaToken('');
                if (window.grecaptcha?.reset) window.grecaptcha.reset();
            }
        } catch (error) {
            console.error('Signup error:', error);
            toast.error('Signup process failed. Please try again.');
            setSignupCaptchaToken('');
            if (window.grecaptcha?.reset) window.grecaptcha.reset();
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

                            {/* reCAPTCHA v2 widget */}
                            <div className="rl-captcha-row">
                                <CaptchaWidget
                                    widgetId="login-captcha"
                                    onVerify={onLoginCaptchaVerify}
                                    onExpire={onLoginCaptchaExpire}
                                />
                                {loginCaptchaToken && (
                                    <span className="rl-captcha-ok">✓ Verified</span>
                                )}
                            </div>

                            {/* Green glossy login button */}
                            <button type="submit" className="rl-glossy-btn" disabled={loading || !loginCaptchaToken}>
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
                        <form onSubmit={otpStep === 'form' ? handleSendOtp : handleSignupSubmit} noValidate>
                            <div className="rl-card-title">✨ Create Account</div>

                            {otpStep === 'form' ? (
                                /* ── Step 1: fill details ── */
                                <>
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

                                    {/* reCAPTCHA v2 widget */}
                                    <div className="rl-captcha-row">
                                        <CaptchaWidget
                                            widgetId="signup-captcha"
                                            onVerify={onSignupCaptchaVerify}
                                            onExpire={onSignupCaptchaExpire}
                                        />
                                        {signupCaptchaToken && (
                                            <span className="rl-captcha-ok">✓ Verified</span>
                                        )}
                                    </div>

                                    {/* Send OTP button */}
                                    <button type="submit" className="rl-glossy-btn" disabled={!acceptedTerms || otpLoading || !signupCaptchaToken}>
                                        <img src={GreenGlossyBtn} alt="Send OTP" />
                                        <span className="rl-glossy-btn-label">
                                            <Send size={20} /> {otpLoading ? 'Sending OTP…' : 'Send OTP'}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                /* ── Step 2: enter OTP ── */
                                <>
                                    <p className="rl-otp-info">
                                        <ShieldCheck size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                                        OTP sent to <strong>{signupData.phone}</strong>. Enter it below to verify your phone and create your account.
                                    </p>

                                    <div className="rl-input-wrap">
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={6}
                                            className="rl-input"
                                            placeholder="Enter 6-digit OTP"
                                            value={otpCode}
                                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                                            autoFocus
                                            required
                                        />
                                    </div>

                                    <div className="rl-resend-row">
                                        Didn't receive it?{' '}
                                        <a
                                            href="/"
                                            onClick={async (e) => {
                                                e.preventDefault();
                                                // Resend also needs a fresh v2 captcha token.
                                                // signupCaptchaToken is set by the widget on the
                                                // verify step — if it is empty the user must first
                                                // check the "I am not a robot" box above, then resend.
                                                if (!signupCaptchaToken) {
                                                    toast.error('Please complete the "I am not a robot" check first.');
                                                    return;
                                                }
                                                setOtpLoading(true);
                                                try {
                                                    const res = await fetch(`${BACKEND_URL}/api/otp/send`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ phone: signupData.phone, captchaToken: signupCaptchaToken }),
                                                    });
                                                    const data = await res.json();
                                                    if (data.success) {
                                                        toast.success('OTP resent!');
                                                        setSignupCaptchaToken('');
                                                        if (window.grecaptcha?.reset) window.grecaptcha.reset();
                                                    } else {
                                                        toast.error('Resend failed: ' + (data.message || 'Try again.'));
                                                        setSignupCaptchaToken('');
                                                        if (window.grecaptcha?.reset) window.grecaptcha.reset();
                                                    }
                                                } catch {
                                                    toast.error('Could not resend OTP.');
                                                    setSignupCaptchaToken('');
                                                    if (window.grecaptcha?.reset) window.grecaptcha.reset();
                                                } finally {
                                                    setOtpLoading(false);
                                                }
                                            }}
                                        >
                                            {otpLoading ? 'Sending…' : 'Resend OTP'}
                                        </a>
                                        {' · '}
                                        <a href="/" onClick={(e) => { e.preventDefault(); setOtpStep('form'); setOtpCode(''); }}>
                                            Edit Details
                                        </a>
                                    </div>

                                    {/* reCAPTCHA v2 widget — fresh check required for createuser */}
                                    <div className="rl-captcha-row">
                                        <CaptchaWidget
                                            widgetId="signup-captcha-verify"
                                            onVerify={onSignupCaptchaVerify}
                                            onExpire={onSignupCaptchaExpire}
                                        />
                                        {signupCaptchaToken && (
                                            <span className="rl-captcha-ok">✓ Verified</span>
                                        )}
                                    </div>

                                    {/* Verify & Create Account button */}
                                    <button type="submit" className="rl-glossy-btn" disabled={loading || otpCode.length < 4 || !signupCaptchaToken}>
                                        <img src={GreenGlossyBtn} alt="Verify & Create Account" />
                                        <span className="rl-glossy-btn-label">
                                            <ShieldCheck size={20} /> {loading ? 'Creating account…' : 'Verify & Create Account'}
                                        </span>
                                    </button>
                                </>
                            )}

                            {/* Red glossy cancel button — always visible */}
                            <button
                                type="button"
                                className="rl-glossy-btn"
                                onClick={() => { resetSignup(); setAcceptedTerms(false); }}
                                disabled={loading || otpLoading}
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