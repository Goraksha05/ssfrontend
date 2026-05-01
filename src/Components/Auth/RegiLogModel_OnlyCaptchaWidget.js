// RegiLogModel_OnlyCaptchaWidget.js — Hybrid reCAPTCHA v3 (primary) + v2 (fallback)
// Styles are in App.css (rl-root, rl-card, rl-tab-bar, rl-glossy-btn, etc.)
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../Context/Authorisation/AuthContext';
import AuthService from '../../Services/AuthService';
import ForgotPasswordModal from './Hooks/useForgotPassword';
import Logo from '../XLogo/Logo';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { BadgeCheck, Eye, EyeOff, LogIn, UserPlus, ShieldCheck, ChevronDown, Lock } from 'lucide-react';
import { initializeSocket } from '../../WebSocket/WebSocketClient';
import TermsModal from '../TermsAndConditions/TermsModal';
import apiRequest from '../../utils/apiRequest';

import GreenGlossyBtn from '../../Assets/GreenGlossy.png';
import RedGlossyBtn from '../../Assets/RedGlossy.png';

const getFlagEmoji = (countryCode) => {
    return countryCode
        .toUpperCase()
        .replace(/./g, char =>
            String.fromCodePoint(127397 + char.charCodeAt())
        );
};
// ─── Country codes list ───────────────────────────────────────────────────────
const COUNTRY_CODES = [
    { code: 'IN', dialCode: '+91',  name: 'India'              },
    { code: 'US', dialCode: '+1',   name: 'USA'                },
    { code: 'GB', dialCode: '+44',  name: 'UK'                 },
    { code: 'AE', dialCode: '+971', name: 'UAE'                },
    { code: 'SA', dialCode: '+966', name: 'Saudi Arabia'       },
    { code: 'AU', dialCode: '+61',  name: 'Australia'          },
    { code: 'CA', dialCode: '+1',   name: 'Canada'             },
    { code: 'SG', dialCode: '+65',  name: 'Singapore'          },
    { code: 'NZ', dialCode: '+64',  name: 'New Zealand'        },
    { code: 'ZA', dialCode: '+27',  name: 'South Africa'       },
    { code: 'NG', dialCode: '+234', name: 'Nigeria'            },
    { code: 'KE', dialCode: '+254', name: 'Kenya'              },
    { code: 'GH', dialCode: '+233', name: 'Ghana'              },
    { code: 'PK', dialCode: '+92',  name: 'Pakistan'           },
    { code: 'BD', dialCode: '+880', name: 'Bangladesh'         },
    { code: 'LK', dialCode: '+94',  name: 'Sri Lanka'          },
    { code: 'NP', dialCode: '+977', name: 'Nepal'              },
    { code: 'MY', dialCode: '+60',  name: 'Malaysia'           },
    { code: 'DE', dialCode: '+49',  name: 'Germany'            },
    { code: 'FR', dialCode: '+33',  name: 'France'             },
    { code: 'IT', dialCode: '+39',  name: 'Italy'              },
    { code: 'ES', dialCode: '+34',  name: 'Spain'              },
    { code: 'NL', dialCode: '+31',  name: 'Netherlands'        },
    { code: 'SE', dialCode: '+46',  name: 'Sweden'             },
    { code: 'NO', dialCode: '+47',  name: 'Norway'             },
    { code: 'CH', dialCode: '+41',  name: 'Switzerland'        },
    { code: 'JP', dialCode: '+81',  name: 'Japan'              },
    { code: 'CN', dialCode: '+86',  name: 'China'              },
    { code: 'KR', dialCode: '+82',  name: 'South Korea'        },
    { code: 'BR', dialCode: '+55',  name: 'Brazil'             },
    { code: 'MX', dialCode: '+52',  name: 'Mexico'             },
    { code: 'AR', dialCode: '+54',  name: 'Argentina'          },
    { code: 'PH', dialCode: '+63',  name: 'Philippines'        },
    { code: 'ID', dialCode: '+62',  name: 'Indonesia'          },
    { code: 'TH', dialCode: '+66',  name: 'Thailand'           },
    { code: 'VN', dialCode: '+84',  name: 'Vietnam'            },
    { code: 'EG', dialCode: '+20',  name: 'Egypt'              },
    { code: 'RU', dialCode: '+7',   name: 'Russia'             },
    { code: 'TR', dialCode: '+90',  name: 'Turkey'             },
    { code: 'IR', dialCode: '+98',  name: 'Iran'               },
    { code: 'IQ', dialCode: '+964', name: 'Iraq'               },
    { code: 'QA', dialCode: '+974', name: 'Qatar'              },
    { code: 'KW', dialCode: '+965', name: 'Kuwait'             },
    { code: 'BH', dialCode: '+973', name: 'Bahrain'            },
    { code: 'OM', dialCode: '+968', name: 'Oman'               },
    { code: 'JO', dialCode: '+962', name: 'Jordan'             },
    { code: 'IL', dialCode: '+972', name: 'Israel'             },
    { code: 'HK', dialCode: '+852', name: 'Hong Kong'          },
    { code: 'TW', dialCode: '+886', name: 'Taiwan'             },
    { code: 'PT', dialCode: '+351', name: 'Portugal'           },
    { code: 'PL', dialCode: '+48',  name: 'Poland'             },
    { code: 'BE', dialCode: '+32',  name: 'Belgium'            },
    { code: 'AT', dialCode: '+43',  name: 'Austria'            },
    { code: 'DK', dialCode: '+45',  name: 'Denmark'            },
    { code: 'FI', dialCode: '+358', name: 'Finland'            },
    { code: 'CZ', dialCode: '+420', name: 'Czech Republic'     },
    { code: 'HU', dialCode: '+36',  name: 'Hungary'            },
    { code: 'GR', dialCode: '+30',  name: 'Greece'             },
    { code: 'RO', dialCode: '+40',  name: 'Romania'            },
    { code: 'UA', dialCode: '+380', name: 'Ukraine'            },
    { code: 'CO', dialCode: '+57',  name: 'Colombia'           },
    { code: 'CL', dialCode: '+56',  name: 'Chile'              },
    { code: 'PE', dialCode: '+51',  name: 'Peru'               },
    { code: 'ET', dialCode: '+251', name: 'Ethiopia'           },
    { code: 'TZ', dialCode: '+255', name: 'Tanzania'           },
    { code: 'UG', dialCode: '+256', name: 'Uganda'             },
    { code: 'MU', dialCode: '+230', name: 'Mauritius'          },
];

const fetchUserCountry = async () => {
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        return data?.country_code || 'IN';
    } catch (err) {
        console.error('Geo detection failed:', err);
        return 'IN';
    }
};

const PhoneInput = ({ value, onChange }) => {
    const [selectedCountry, setSelectedCountry] = useState(
        COUNTRY_CODES.find(c => c.code === 'IN')
    );
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [search, setSearch] = useState('');
    const dropdownRef = useRef(null);
    const searchRef   = useRef(null);

    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
                setSearch('');
            }
        };
        if (dropdownOpen) {
            document.addEventListener('mousedown', handleOutsideClick);
            setTimeout(() => searchRef.current?.focus(), 50);
        }
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [dropdownOpen]);

    const filteredCountries = COUNTRY_CODES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dialCode.includes(search)
    );

    const handleCountrySelect = (country) => {
        setSelectedCountry(country);
        setDropdownOpen(false);
        setSearch('');
    };

    const handlePhoneChange = (e) => {
        const digits = e.target.value.replace(/\D/g, '');
        onChange({ target: { name: 'phone', value: digits } });
    };

    useEffect(() => {
        const detectCountry = async () => {
            const code = await fetchUserCountry();
            const matched = COUNTRY_CODES.find(c => c.code === code);
            if (matched) setSelectedCountry(matched);
        };
        detectCountry();
    }, []);

    return (
        <div className="rl-phone-wrap" ref={dropdownRef}>
            <div className="rl-phone-input-row">
                <button
                    type="button"
                    className="rl-phone-code-btn"
                    onClick={() => setDropdownOpen(prev => !prev)}
                    aria-label="Select country code"
                    title={`${selectedCountry?.name || ''} ${selectedCountry?.dialCode || ''}`}
                >
                    {selectedCountry && (
                        <>
                            <span className="rl-phone-flag">
                                {getFlagEmoji(selectedCountry.code)}
                            </span>
                            <span className="rl-phone-dialcode">
                                {selectedCountry.dialCode}
                            </span>
                        </>
                    )}
                    <ChevronDown size={14} className={`rl-phone-chevron ${dropdownOpen ? 'open' : ''}`} />
                </button>

                {dropdownOpen && (
                    <div className="rl-phone-dropdown">
                        <div className="rl-phone-search-wrap">
                            <input
                                ref={searchRef}
                                type="text"
                                className="rl-phone-search"
                                placeholder="Search country…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                onClick={e => e.stopPropagation()}
                            />
                        </div>
                        <ul className="rl-phone-list">
                            {filteredCountries.length === 0 ? (
                                <li className="rl-phone-no-results">No results</li>
                            ) : (
                                filteredCountries.map(country => (
                                    <li
                                        key={country.code}
                                        className={`rl-phone-item ${country.code === selectedCountry?.code ? 'selected' : ''}`}
                                        onClick={() => handleCountrySelect(country)}
                                    >
                                        <span className="rl-phone-flag">{getFlagEmoji(country.code)}</span>
                                        <span className="rl-phone-item-name">{country.name}</span>
                                        <span className="rl-phone-item-dial">{country.dialCode}</span>
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                )}

                <input
                    type="tel"
                    name="phone"
                    className="rl-input rl-phone-number-input"
                    placeholder="10-digit phone number"
                    autoComplete="tel-national"
                    value={value}
                    onChange={handlePhoneChange}
                    maxLength={15}
                    required
                />
            </div>
        </div>
    );
};

// ─── CaptchaWidget (v2 fallback checkbox) ────────────────────────────────────
const CaptchaWidget = ({ widgetId, onVerify, onExpire }) => {
    const containerRef = useRef(null);
    const renderedRef = useRef(false);

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
                    sitekey: process.env.REACT_APP_RECAPTCHA_V2_SITE_KEY,
                    callback: onVerify,
                    'expired-callback': onExpire,
                    theme: 'light',
                    size: 'normal',
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
                setTimeout(attempt, 150);
            }
        };

        attempt();
    });
};

// ─── Component ────────────────────────────────────────────────────────────────
// Props:
//   initialTab  — "login" | "signup"  (default "login")
//                 App.js passes "signup" when the route is /signup
const LogSignNewModel = ({ initialTab = 'login' }) => {
    const navigate = useNavigate();
    const { login } = useAuth();

    // ── Read ?ref= from the URL ───────────────────────────────────────────────
    // useSearchParams works for both /signup?ref=VK690587 and /login?ref=…
    const [searchParams] = useSearchParams();
    const refFromUrl = (searchParams.get('ref') || '').trim().toUpperCase();

    const [isAdminLogin, setIsAdminLogin] = useState(false);
    const [role] = useState('user');

    // Open signup tab immediately when:
    //   • the parent passed initialTab="signup"  (route /signup)
    //   • OR a ?ref= value is present in the URL
    const [isLogin, setIsLogin] = useState(
        initialTab === 'signup' || refFromUrl ? false : true
    );

    const [showForgotModal, setShowForgotModal] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);
    const [postLoginRedirect, setPostLoginRedirect] = useState('');
    const [mounted, setMounted] = useState(false);
    const [loading, setLoading] = useState(false);

    // ── Hybrid captcha state ──────────────────────────────────────────────────
    const [loginCaptchaMode, setLoginCaptchaMode] = useState('v3');
    const [signupCaptchaMode, setSignupCaptchaMode] = useState('v3');

    const [loginV2Token, setLoginV2Token] = useState('');
    const [signupV2Token, setSignupV2Token] = useState('');

    const onLoginV2Verify = useCallback((token) => setLoginV2Token(token), []);
    const onLoginV2Expire = useCallback(() => setLoginV2Token(''), []);
    const onSignupV2Verify = useCallback((token) => setSignupV2Token(token), []);
    const onSignupV2Expire = useCallback(() => setSignupV2Token(''), []);

    const [loginData, setLoginData] = useState({ identifier: '', password: '' });

    // Pre-fill referralno from URL param if present; otherwise start empty.
    const [signupData, setSignupData] = useState({
        name: '', username: '', email: '', phone: '',
        password: '', cpassword: '',
        referralno: refFromUrl,
    });

    // Track whether the referral field came from the URL so we can lock it.
    // A ref from the URL should not be editable — it belongs to the inviter.
    const referralLockedByUrl = Boolean(refFromUrl);

    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [showLoginPassword, setShowLoginPassword] = useState(false);
    const [showSignupPassword, setShowSignupPassword] = useState(false);
    const [showSignupCPassword, setShowSignupCPassword] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 80);
        return () => clearTimeout(t);
    }, []);

    // ── If ?ref= changes (edge case: user navigates to a different ref link) ──
    // Keep signupData.referralno in sync, but only when the field is URL-locked.
    useEffect(() => {
        if (refFromUrl) {
            setSignupData(prev => ({ ...prev, referralno: refFromUrl }));
            setIsLogin(false);
        }
    }, [refFromUrl]);

    const resetSignup = () => {
        // When resetting, preserve URL-supplied referral so the user can still sign up.
        setSignupData({
            name: '', username: '', email: '', phone: '',
            password: '', cpassword: '',
            referralno: referralLockedByUrl ? refFromUrl : '',
        });
        setSignupCaptchaMode('v3');
        setSignupV2Token('');
    };

    const resetCaptchaWidget = () => {
        try {
            if (window.grecaptcha?.reset) window.grecaptcha.reset();
        } catch (_) {}
    };

    // ── handleLoginSubmit ─────────────────────────────────────────────────────
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        const { identifier, password } = loginData;

        if (!identifier.trim() || !password.trim()) {
            toast.error('Please enter both username/email/phone and password.');
            return;
        }

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
                captchaType = 'v3';
                if (!captchaToken) {
                    setLoginCaptchaMode('v2');
                    toast.info('Please complete the security check below.');
                    setLoading(false);
                    return;
                }
            } else {
                captchaToken = loginV2Token;
                captchaType = 'v2';
            }

            const response = isAdminLogin
                ? await AuthService.loginAdmin({ identifier, password, captchaToken, captchaType, captchaAction: 'login' })
                : await AuthService.login({ identifier, password, captchaToken, captchaType, captchaAction: 'login' });

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
                captchaType = 'v3';
                if (!captchaToken) {
                    setSignupCaptchaMode('v2');
                    toast.info('Please complete the security check below.');
                    setLoading(false);
                    return;
                }
            } else {
                captchaToken = signupV2Token;
                captchaType = 'v2';
            }

            const result = await AuthService.signup({
                name, username, email, phone, password, referralno, role,
                captchaToken, captchaType, captchaAction: 'signup',
            });

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
        if (isLogin) {
            setLoginData(prev => ({ ...prev, [name]: value }));
        } else {
            // Prevent overwriting a URL-locked referral ID via typing
            if (name === 'referralno' && referralLockedByUrl) return;
            setSignupData(prev => ({ ...prev, [name]: value }));
        }
    };

    useEffect(() => {
        return () => {
            try {
                if (window.grecaptcha?.reset) window.grecaptcha.reset();
            } catch { }
        };
    }, []);

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

                        {/* ── Referral ID ─────────────────────────────────────────
                            When referralLockedByUrl is true the field is read-only and
                            shows a lock icon + a friendly "invited by" hint so the user
                            understands why it is pre-filled and cannot be changed.
                        */}
                        <div className="rl-input-wrap">
                            {referralLockedByUrl
                                ? <Lock className="rl-input-icon" size={18} style={{ color: '#7c3aed' }} />
                                : <BadgeCheck className="rl-input-icon" size={20} />
                            }
                            <input
                                type="text"
                                name="referralno"
                                className={`rl-input has-icon${referralLockedByUrl ? ' rl-input--locked' : ''}`}
                                placeholder="Referral ID (e.g., DU688828)"
                                value={signupData.referralno}
                                onChange={handleInputChange}
                                // readOnly prevents keyboard editing; the value is already
                                // in state from the URL param.
                                readOnly={referralLockedByUrl}
                                style={referralLockedByUrl ? {
                                    background: 'var(--color-background-secondary, #f5f0ff)',
                                    color:      'var(--color-text-secondary, #7c3aed)',
                                    cursor:     'default',
                                    userSelect: 'none',
                                } : undefined}
                                aria-label={referralLockedByUrl
                                    ? `Referral ID: ${signupData.referralno} (pre-filled from invite link)`
                                    : 'Referral ID'}
                            />
                            {/* Inline badge so the user sees clear confirmation */}
                            {referralLockedByUrl && (
                                <span
                                    title="This referral ID was filled automatically from your invite link."
                                    style={{
                                        position:   'absolute',
                                        right:      10,
                                        top:        '50%',
                                        transform:  'translateY(-50%)',
                                        fontSize:   10,
                                        fontWeight: 600,
                                        padding:    '2px 7px',
                                        borderRadius: 4,
                                        background: '#ede9fe',
                                        color:      '#7c3aed',
                                        whiteSpace: 'nowrap',
                                        pointerEvents: 'none',
                                    }}
                                >
                                    ✓ Invite link
                                </span>
                            )}
                        </div>

                        {/* Show a contextual hint below the field when pre-filled */}
                        {referralLockedByUrl && (
                            <p style={{
                                fontSize: 12,
                                color:    'var(--color-text-secondary, #7c3aed)',
                                margin:   '-8px 0 12px 2px',
                            }}>
                                🎉 You were invited! Your referral ID has been filled in automatically.
                            </p>
                        )}

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

                        {/* ────────── Phone Input with Country Code ────────── */}
                        <PhoneInput
                            value={signupData.phone}
                            onChange={handleInputChange}
                        />

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

                        {/* v2 fallback widget */}
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

                        {/* Cancel / Reset button */}
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