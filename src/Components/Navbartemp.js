import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../Context/Authorisation/AuthContext";
import { useSubscription } from "../Context/Subscription/SubscriptionContext";
import { useI18n } from "../i18n/i18nContext";           // ← i18nContext hook
import '@fortawesome/fontawesome-free/css/all.min.css';
import './Navbar.css';
import Logo from "./XLogo/logoImage";
import {
  BadgeCheck,
  Search,
  Bell,
  Home,
  Activity,
  User,
  ChevronDown,
  Globe,
  X
} from 'lucide-react';
import { useFriend } from "../Context/Friend/FriendContext";
import { Modal, Button } from "react-bootstrap";
import NotificationsPanel from '../Components/NotificationsPanel';
import apiRequest from "../utils/apiRequest";
import SubscribeIcon from '../Assets/PrimeMembers.png';
import LogoutIcon from '../Assets/LogoutButton.png';
// import ThemeToggle from '../Components/Theme/ThemeToggle';
import { ThemePickerTrigger } from '../Components/Theme/ThemePalettePicker';
import { useUI } from '../Context/ThemeUI/UIContext';
// import KycVerification from './KYC/KycVerification';

// ─── NOTE on i18n.js ──────────────────────────────────────────────────────────
// The old `i18n.js` (i18next/react-i18next) is no longer imported here.
// All language state is managed by <I18nProvider> via the useI18n() hook.
// You can safely DELETE src/i18n/i18n.js unless another part of the app
// still imports it.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;



/* ─── Small reusable hover-aware link ────────────────────────────────── */
function NavLinkItem({ to, icon: Icon, children, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      className={`navbar-nav-link${hover ? " active" : ""}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      <Icon size={15} />
      {children}
    </Link>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────── */
export default function Navbartemp({ title, myHome }) {
  const { openThemePicker } = useUI();

  const { isAuthenticated, logout, notificationCount, setNotificationCount, authtoken } = useAuth();
  const { openSubscription } = useSubscription();
  const navigate = useNavigate();

  // ── i18n ──────────────────────────────────────────────────────────────
  // lang       : active language code, e.g. "en", "hi", "mr"
  // setLang    : call with a language code to switch instantly & persist
  // t          : translation object — use t.someKey or t.format("key", vars)
  // LANGUAGES  : full list of supported languages for the picker UI
  const { lang, setLang, t, LANGUAGES } = useI18n();
  // ──────────────────────────────────────────────────────────────────────

  const [userName, setUserName] = useState("Unknown");
  const logoutTimer = useRef(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(true);
  const navbarRef = useRef();
  const searchRef = useRef();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showPoliciesMenu, setShowPoliciesMenu] = useState(false);
  const langRef = useRef();
  const policiesRef = useRef();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);


  const { sendRequest } = useFriend();

  /* ── Search ── */
  const handleSearchChange = async (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (query.trim().length > 1) {
      try {
        const res = await apiRequest.get(`${BACKEND_URL}/api/users/search?query=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${authtoken}` }
        });
        setSearchResults(res.data);
        setShowSearchResults(true);
      } catch (err) {
        console.error("Search error:", err);
      }
    } else {
      setShowSearchResults(false);
    }
  };

  const openProfileModal = async (userId) => {
    try {
      const res = await apiRequest.get(`${BACKEND_URL}/api/profile/${userId}`, {
        headers: { Authorization: `Bearer ${authtoken}` }
      });
      setSelectedUser(res.data.profile);
      setShowProfileModal(true);
    } catch (err) {
      console.error("Fetch profile error:", err);
    }
  };

  /* ── Logout ── */
  const handleLogout = useCallback((auto = false) => {
    if (!auto) {
      const confirmLogout = window.confirm("Are you sure you want to log out?");
      if (!confirmLogout) return;
    }
    localStorage.removeItem("token");
    localStorage.removeItem("User");
    logout();
    navigate("/login");
    if (!auto) window.location.reload();
    else console.warn("⚠ Auto-logout due to inactivity.");
  }, [logout, navigate]);

  /* ── Load user ── */
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const { user: { id: userId } = {} } = jwtDecode(token);
      const fetchUserName = async () => {
        const res = await apiRequest.get(`${BACKEND_URL}/api/auth/getuser/${userId}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        setUserName(res.data.name);
      };
      fetchUserName();
    } catch (err) {
      console.error("Failed to fetch user data:", err);
    }

    const resetTimer = () => {
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
      logoutTimer.current = setTimeout(() => handleLogout(true), 8 * 60 * 1000);
    };
    const activityEvents = ["mousemove", "keydown", "scroll", "touchstart"];
    const handleUserActivity = () => resetTimer();
    activityEvents.forEach(e => window.addEventListener(e, handleUserActivity));
    resetTimer();
    return () => {
      activityEvents.forEach(e => window.removeEventListener(e, handleUserActivity));
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [handleLogout]);

  /* ── Outside click / Escape ── */
  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") {
        setIsCollapsed(true);
        setShowSearchResults(false);
        setSearchQuery("");
        setShowLangMenu(false);
        setShowPoliciesMenu(false);
        return;
      }
      if (navbarRef.current && !navbarRef.current.contains(e.target)) setIsCollapsed(true);
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setShowSearchResults(false);
        setSearchQuery("");
      }
      if (langRef.current && !langRef.current.contains(e.target)) setShowLangMenu(false);
      if (policiesRef.current && !policiesRef.current.contains(e.target)) setShowPoliciesMenu(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", handler);
    };
  }, []);

  const handleNavItemClick = () => setIsCollapsed(true);

  const storedUser = JSON.parse(localStorage.getItem("User") || "{}");
  const isPrime = storedUser?.subscription?.active;

  /* ── Language change handler ── */
  const handleLangChange = (code) => {
    setLang(code);          // updates context, persists to localStorage, flips RTL dir
    setShowLangMenu(false);
  };

  /* ── Go to profile ── */
  const handleGoToProfile = () => {
    navigate("/profile");
  };

  return (
    <>
      {/* ══════════════════════════════════════════════════════════ NAV */}
      <nav className="navbar-root">
        <div ref={navbarRef} className="navbar-inner">

          {/* Brand */}
          <Link className="navbar-brand" to="/">
            <Logo />
          </Link>
          {/* <span>{title}</span> */}
          {/* Search bar */}
          <div ref={searchRef} className="navbar-search-wrap">
            <div className={`navbar-search-inner${searchFocused ? " focused" : ""}`}>
              <Search size={15} style={{ color: "rgba(150,200,255,0.5)", flexShrink: 0 }} />
              <input
                type="search"
                className="navbar-search-input"
                placeholder={t["nav.search_placeholder"] || "Search friends..."}
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchQuery && (
                <button
                  className="navbar-search-clear"
                  onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showSearchResults && (
              <div className="navbar-dropdown-results">
                {searchResults.length > 0 ? searchResults.map((user) => (
                  <div
                    key={user._id}
                    className="navbar-dropdown-item"
                    onClick={() => { setShowSearchResults(false); setSearchQuery(""); openProfileModal(user._id); }}
                  >
                    <img
                      src={user.profileImage || "/default-avatar.png"}
                      alt={user.name}
                      className="navbar-dropdown-avatar"
                    />
                    <div>
                      <div className="navbar-dropdown-name">{user.name}</div>
                      <div className="navbar-dropdown-username">@{user.username}</div>
                    </div>
                    <span className="navbar-dropdown-view">
                      {t["nav.view_profile"] || "View →"}
                    </span>
                  </div>
                )) : (
                  <div className="navbar-dropdown-empty">
                    {t["nav.no_users_found"] || "No users found"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop nav links */}
          <div className="navbar-nav-links d-none d-lg-flex">
            <NavLinkItem to="/" icon={Home} onClick={handleNavItemClick}>
              {myHome || t["nav.home"] || "Home"}
            </NavLinkItem>
            <NavLinkItem to="/activity" icon={Activity} onClick={handleNavItemClick}>
              {t["nav.activity"] || "Activity"}
            </NavLinkItem>
            {/* <NavLinkItem to="/profile" icon={User} onClick={handleNavItemClick}>
              {t["nav.profile"] || "Profile"}
            </NavLinkItem> */}

            {/* Policies dropdown */}
            <div ref={policiesRef} className="navbar-policies-dropdown">
              <button
                className="navbar-nav-link"
                onClick={() => setShowPoliciesMenu(p => !p)}
              >
                <span>{t["nav.policies"] || "Policies"}</span>
                <ChevronDown size={13} style={{ opacity: 0.6 }} />
              </button>
              {showPoliciesMenu && (
                <div className="navbar-policies-menu">
                  {[
                    { to: "/aboutus", labelKey: "nav.about_us", fallback: "About Us" },
                    { to: "/privacypolicy", labelKey: "nav.privacy_policy", fallback: "Privacy Policy" },
                    { to: "/refcanclepolicy", labelKey: "nav.refund_cancel", fallback: "Refund & Cancel" },
                    { to: "/contactus", labelKey: "nav.contact_us", fallback: "Contact Us" },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      className="navbar-policies-item"
                      onClick={() => { handleNavItemClick(); setShowPoliciesMenu(false); }}
                    >
                      {t[item.labelKey] || item.fallback}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right cluster */}
          <div className="navbar-right-cluster">
            {isAuthenticated && (
              <>
                {/* User greeting pill */}
                <div
                  className="navbar-greeting-pill d-none d-md-flex"
                  onClick={handleGoToProfile}
                  style={{ cursor: "pointer" }}
                  title="Go to Profile"
                >
                  <span className="navbar-greet-text">
                    {isPrime && (
                      <BadgeCheck size={21} style={{ color: "#38bdf8", marginRight: "4px", verticalAlign: "middle" }} fill="currentColor" stroke="white" />
                    )}
                    {t["nav.hi_greeting"] ? `${t["nav.hi_greeting"]}, ${userName.split(" ")[0]}` : `Hi, ${userName.split(" ")[0]}`}
                  </span>
                </div>

                {/* Subscribe button */}
                <button
                  title={t["nav.become_prime"] || "Become a Prime Member"}
                  onClick={openSubscription}
                  className="navbar-subscribe-btn d-none d-sm-flex"
                >
                  <img
                    src={SubscribeIcon}
                    alt={t["nav.become_prime"] || "Subscribe – Become a Prime Member"}
                    className="navbar-subscribe-img"
                  />
                </button>

                {/* Bell — always opens; onClose in the panel sets it false */}
                {/* <button
                  onClick={() => setShowNotifications(true)}
                  title={t["nav.notifications"] || "Notifications"}
                  className="navbar-icon-btn"
                >
                  <Bell size={17} />
                  {notificationCount > 0 && (
                    <span className="navbar-badge">{notificationCount > 9 ? "9+" : notificationCount}</span>
                  )}
                </button> */}

                {/* ── Language selector ──────────────────────────────────────
                    Uses LANGUAGES from useI18n() — the full list defined in
                    i18nContext.js. Calling setLang(code) switches the language
                    everywhere in the app instantly.
                ─────────────────────────────────────────────────────────── */}
                <div ref={langRef} className="navbar-lang-dropdown">
                  <button
                    className="navbar-icon-btn navbar-icon-btn--lang"
                    onClick={() => setShowLangMenu(p => !p)}
                    title={t["nav.language"] || "Language"}
                  >
                    <Globe size={14} />
                    <span className="d-none d-md-inline">{lang.toUpperCase()}</span>
                  </button>

                  {showLangMenu && (
                    <div className="navbar-lang-menu">
                      {LANGUAGES.map(l => (
                        <button
                          key={l.code}
                          className={`navbar-lang-item${lang === l.code ? " active" : ""}`}
                          onClick={() => handleLangChange(l.code)}
                        >
                          {l.flag}&nbsp;&nbsp;{l.label}
                          {lang === l.code && (
                            <span className="navbar-lang-item-check">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Logout */}
                <button
                  onClick={() => handleLogout(false)}
                  title={t["logout"] || "Logout"}
                  className="navbar-logout-btn d-none d-sm-flex align-items-center"
                >
                  <img
                    src={LogoutIcon}
                    alt={t["logout"] || "Logout"}
                    className="navbar-logout-img"
                  />
                </button>
              </>
            )}

            {/* Dark / light toggle */}
            {/* <ThemeToggle /> */}

            {/* Palette picker trigger — opens the App-level modal */}
            <ThemePickerTrigger onClick={openThemePicker} />

            {/* Mobile hamburger */}
            <button
              className="navbar-hamburger d-lg-none"
              onClick={() => setIsCollapsed(p => !p)}
              aria-label="Toggle menu"
            >
              <span className="navbar-hamburger-line" style={{ transform: !isCollapsed ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
              <span className="navbar-hamburger-line" style={{ opacity: !isCollapsed ? 0 : 1 }} />
              <span className="navbar-hamburger-line" style={{ transform: !isCollapsed ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        {!isCollapsed && (
          <div /*ref={navbarRef}*/ className="navbar-mobile-drawer">
            {/* Nav links */}
            {[
              { to: "/", icon: Home, label: myHome || t["nav.home"] || "Home" },
              { to: "/activity", icon: Activity, label: t["nav.activity"] || "Activity" },
              { to: "/profile", icon: User, label: t["nav.profile"] || "Profile" },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                className="navbar-mobile-link"
                onClick={handleNavItemClick}
              >
                <item.icon size={17} style={{ color: "#38bdf8" }} />
                {item.label}
              </Link>
            ))}

            {/* Policies sub-links */}
            <div className="navbar-mobile-section">
              <div className="navbar-mobile-section-label">
                {t["nav.policies"] || "Policies"}
              </div>
              {[
                { to: "/aboutus", labelKey: "nav.about_us", fallback: "About Us" },
                { to: "/privacypolicy", labelKey: "nav.privacy_policy", fallback: "Privacy Policy" },
                { to: "/refcanclepolicy", labelKey: "nav.refund_cancel", fallback: "Refund & Cancel" },
                { to: "/contactus", labelKey: "nav.contact_us", fallback: "Contact Us" },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  className="navbar-mobile-link navbar-mobile-link--small"
                  onClick={handleNavItemClick}
                >
                  {t[item.labelKey] || item.fallback}
                </Link>
              ))}
            </div>

            {/* Mobile language picker */}
            <div className="navbar-mobile-section">
              <div className="navbar-mobile-section-label">
                {t["nav.language"] || "Language"}
              </div>
              <div className="navbar-mobile-lang-grid">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { handleLangChange(l.code); handleNavItemClick(); }}
                    className={`navbar-mobile-lang-btn${lang === l.code ? " active" : ""}`}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile auth actions */}
            {isAuthenticated && (
              <div className="navbar-mobile-auth-actions">
                {/* Bell — notifications */}
                <button
                  onClick={() => { setShowNotifications(true); handleNavItemClick(); }}
                  title={t["nav.notifications"] || "Notifications"}
                  className="navbar-icon-btn navbar-mobile-bell-btn"
                >
                  <Bell size={19} />
                  {notificationCount > 0 && (
                    <span className="navbar-badge">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={openSubscription}
                  title={t["nav.become_prime"] || "Become a Prime Member"}
                  className="navbar-mobile-subscribe-btn"
                >
                  <img src={SubscribeIcon} alt={t["nav.become_prime"] || "Subscribe"} className="navbar-mobile-subscribe-img" />
                </button>
                <button
                  onClick={() => handleLogout(false)}
                  title={t["logout"] || "Logout"}
                  className="navbar-mobile-logout-btn"
                >
                  <img src={LogoutIcon} alt={t["logout"] || "Logout"} className="navbar-mobile-logout-img" />
                </button>
              </div>
            )}
            {/* Palette picker trigger — opens the App-level modal */}
            {/* <ThemePickerTrigger onClick={openThemePicker} /> */}
          </div>
        )}
      </nav>

      {/* Spacer so content doesn't hide under fixed nav */}
      <div className="navbar-spacer" />

      {/* ── KYC Required Banner ── */}
      {isAuthenticated && storedUser?.kyc?.status === 'required' && (
        <div style={{
          position: 'fixed',
          top: 62,
          left: 0,
          right: 0,
          zIndex: 1020,
          background: 'linear-gradient(90deg, #f59e0b, #d97706)',
          color: '#fff',
          fontSize: 13,
          fontWeight: 700,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          boxShadow: '0 2px 8px rgba(217,119,6,0.3)',
        }}>
          <span>⚠️ KYC verification required to claim rewards.</span>
          <Link
            to="/profile"
            onClick={() => {/* navigate to profile, user can click KYC tab */ }}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.4)',
              borderRadius: 20,
              padding: '4px 14px',
              color: '#fff',
              textDecoration: 'none',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            Verify Now →
          </Link>
        </div>
      )}

      {/* ── Notifications Panel ── */}
      <NotificationsPanel
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        setNotificationCount={setNotificationCount}
      />

      {/* ── Profile Modal ── */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered>
        <Modal.Header
          closeButton
          className="navbar-modal-header"
        >
          <Modal.Title className="navbar-modal-title">
            {selectedUser?.user_id?.name || t["nav.profile"] || "User Profile"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="navbar-modal-body">
          {selectedUser ? (
            <>
              <div className="text-center" style={{ marginBottom: "20px" }}>
                <img
                  src={selectedUser.profileavatar?.URL || "/default-avatar.png"}
                  alt={selectedUser.user_id?.name}
                  className="rounded-circle mb-3 navbar-modal-avatar"
                />
                <h5 className="navbar-modal-username">@{selectedUser.user_id?.username}</h5>
                <p className="navbar-modal-location">
                  {selectedUser.currentcity || "N/A"}{selectedUser.hometown && ` · ${selectedUser.hometown}`}
                </p>
              </div>
              <div className="navbar-modal-info-box">
                <p className="navbar-modal-info-row">
                  <span className="navbar-modal-info-label">{t["profile.gender"] || "Gender"}</span>
                  <strong className="navbar-modal-info-value">{selectedUser.sex || t["profile.not_specified"] || "Not specified"}</strong>
                </p>
                <p className="navbar-modal-info-row">
                  <span className="navbar-modal-info-label">{t["profile.relationship"] || "Relationship"}</span>
                  <strong className="navbar-modal-info-value">{selectedUser.relationship || t["profile.not_specified"] || "Not specified"}</strong>
                </p>
              </div>
            </>
          ) : (
            <div className="navbar-modal-empty">
              {t["profile.loading_profile"] || "Loading profile…"}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer className="navbar-modal-footer">
          <Button variant="outline-secondary" onClick={() => setShowProfileModal(false)}>
            {t["common.close"] || "Close"}
          </Button>
          <Button
            className="navbar-modal-add-btn"
            onClick={() => {
              const targetId = selectedUser?.user_id?._id || selectedUser?.user_id || selectedUser?._id;
              if (targetId) {
                sendRequest(targetId);
                setShowProfileModal(false);
              } else {
                console.error("❌ No valid user ID found:", selectedUser);
              }
            }}
          >
            <i className="fas fa-user-plus me-2" />
            {t["profile.add_friend"] || "Add Friend"}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}

Navbartemp.propTypes = {
  title: PropTypes.string.isRequired,
  myHome: PropTypes.string,
};