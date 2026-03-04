import React, { useEffect, useState, useRef, useCallback } from "react";
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../Context/Authorisation/AuthContext";
import { useSubscription } from "../Context/Subscription/SubscriptionContext";
import { useI18n } from "../Context/i18nContext";           // ← i18nContext hook
import '@fortawesome/fontawesome-free/css/all.min.css';
import Logo from "./XLogo/logoImage";
import { BadgeCheck, Search, Bell, Home, Activity, User, ChevronDown, Globe, X } from 'lucide-react';
import { useFriend } from "../Context/Friend/FriendContext";
import { Modal, Button } from "react-bootstrap";
import NotificationsPanel from '../Components/NotificationsPanel';
import apiRequest from "../utils/apiRequest";
import SubscribeIcon from '../Assets/PrimeMembers.png';
import LogoutIcon from '../Assets/LogoutButton.png';
import ThemeToggle from '../Components/ThemeToggle';

// ─── NOTE on i18n.js ──────────────────────────────────────────────────────────
// The old `i18n.js` (i18next/react-i18next) is no longer imported here.
// All language state is managed by <I18nProvider> via the useI18n() hook.
// You can safely DELETE src/i18n/i18n.js unless another part of the app
// still imports it.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ─── Inline styles ───────────────────────────────────────────────────── */
const styles = {
  nav: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1030,
    background: "linear-gradient(135deg, #0a0f1e 0%, #0d1b2a 60%, #0f2040 100%)",
    borderBottom: "1px solid rgba(0,180,255,0.12)",
    boxShadow: "0 4px 32px rgba(0,0,0,0.5), 0 1px 0 rgba(0,180,255,0.08)",
    backdropFilter: "blur(12px)",
    fontFamily: "'Nunito', sans-serif",
  },
  inner: {
    maxWidth: "1400px",
    margin: "0 auto",
    display: "flex",
    alignItems: "center",
    padding: "0 16px",
    height: "62px",
    gap: "12px",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    textDecoration: "none",
    flexShrink: 0,
    marginRight: "8px",
  },
  searchWrap: {
    position: "relative",
    flex: "1",
    maxWidth: "340px",
    minWidth: "160px",
  },
  searchInner: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "50px",
    padding: "0 14px",
    gap: "8px",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  searchInput: {
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#e8f4ff",
    fontSize: "14px",
    width: "100%",
    padding: "9px 0",
  },
  navLinks: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    flexShrink: 0,
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 13px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "rgba(220,240,255,0.7)",
    fontSize: "14px",
    fontWeight: 600,
    transition: "background 0.18s, color 0.18s",
    whiteSpace: "nowrap",
  },
  navLinkHover: {
    background: "rgba(0,180,255,0.1)",
    color: "#7dd3fc",
  },
  rightCluster: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginLeft: "auto",
    flexShrink: 0,
  },
  greetingPill: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "50px",
    padding: "5px 14px 5px 6px",
    cursor: "default",
  },
  avatarCircle: {
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0ea5e9, #6366f1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "13px",
    fontWeight: 800,
    color: "#fff",
    flexShrink: 0,
  },
  greetText: {
    color: "#e2f3ff",
    fontSize: "13px",
    fontWeight: 700,
    whiteSpace: "nowrap",
  },
  iconBtn: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "38px",
    height: "38px",
    borderRadius: "10px",
    border: "none",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(200,230,255,0.75)",
    cursor: "pointer",
    transition: "background 0.18s, color 0.18s",
    flexShrink: 0,
  },
  badge: {
    position: "absolute",
    top: "4px",
    right: "4px",
    width: "16px",
    height: "16px",
    borderRadius: "50%",
    background: "#ef4444",
    color: "#fff",
    fontSize: "9px",
    fontWeight: 800,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: 1,
    border: "1.5px solid #0a0f1e",
  },
  dropdownResults: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: 0,
    right: 0,
    background: "#0f1e35",
    border: "1px solid rgba(0,180,255,0.18)",
    borderRadius: "14px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
    overflow: "hidden",
    zIndex: 2000,
  },
  dropdownItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },
  dropdownAvatar: {
    width: "34px",
    height: "34px",
    borderRadius: "50%",
    objectFit: "cover",
    border: "2px solid rgba(0,180,255,0.3)",
    flexShrink: 0,
  },
  policiesDropdown: {
    position: "relative",
    display: "inline-block",
  },
  policiesMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#0f1e35",
    border: "1px solid rgba(0,180,255,0.18)",
    borderRadius: "14px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
    minWidth: "200px",
    overflow: "hidden",
    zIndex: 2000,
  },
  policiesItem: {
    display: "block",
    padding: "10px 18px",
    color: "rgba(200,230,255,0.8)",
    fontSize: "14px",
    fontWeight: 600,
    textDecoration: "none",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },
  langDropdown: {
    position: "relative",
  },
  langMenu: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    background: "#0f1e35",
    border: "1px solid rgba(0,180,255,0.18)",
    borderRadius: "14px",
    boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
    minWidth: "180px",
    maxHeight: "320px",
    overflowY: "auto",
    zIndex: 2000,
  },
  langItem: {
    display: "block",
    width: "100%",
    padding: "10px 18px",
    color: "rgba(200,230,255,0.8)",
    fontSize: "13px",
    fontWeight: 600,
    background: "transparent",
    border: "none",
    textAlign: "left",
    cursor: "pointer",
    borderBottom: "1px solid rgba(255,255,255,0.04)",
    transition: "background 0.15s",
  },
  hamburger: {
    display: "none",
    flexDirection: "column",
    gap: "5px",
    width: "38px",
    height: "38px",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "10px",
    cursor: "pointer",
    flexShrink: 0,
  },
  hamburgerLine: {
    width: "18px",
    height: "2px",
    background: "rgba(200,230,255,0.8)",
    borderRadius: "2px",
    transition: "all 0.2s",
  },
  mobileDrawer: {
    background: "#0b1528",
    borderTop: "1px solid rgba(0,180,255,0.1)",
    padding: "12px 16px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  mobileLinkItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    borderRadius: "10px",
    textDecoration: "none",
    color: "rgba(200,230,255,0.8)",
    fontSize: "15px",
    fontWeight: 600,
    transition: "background 0.15s",
  },
  modalOverlay: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "10vh",
  },
};

/* ─── Small reusable hover-aware link ────────────────────────────────── */
function NavLinkItem({ to, icon: Icon, children, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <Link
      to={to}
      style={{ ...styles.navLink, ...(hover ? styles.navLinkHover : {}) }}
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
  const [logoutHover, setLogoutHover] = useState(false);
  const [subHover, setSubHover] = useState(false);
  const [bellHover, setBellHover] = useState(false);

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

  return (
    <>
      {/* ══════════════════════════════════════════════════════════ NAV */}
      <nav style={styles.nav}>
        <div style={styles.inner}>

          {/* Brand */}
          <Link style={styles.brand} to="/">
            <Logo />
          </Link>

          {/* Search bar */}
          <div ref={searchRef} style={{ ...styles.searchWrap, display: "flex", flexDirection: "column" }}>
            <div
              style={{
                ...styles.searchInner,
                ...(searchFocused ? { borderColor: "rgba(0,180,255,0.45)", boxShadow: "0 0 0 3px rgba(0,180,255,0.1)" } : {}),
              }}
            >
              <Search size={15} style={{ color: "rgba(150,200,255,0.5)", flexShrink: 0 }} />
              <input
                type="search"
                style={styles.searchInput}
                placeholder={t.searchPlaceholder || "Search friends..."}
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchQuery && (
                <button
                  style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(150,200,255,0.5)", padding: 0, display: "flex" }}
                  onClick={() => { setSearchQuery(""); setShowSearchResults(false); }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search results dropdown */}
            {showSearchResults && (
              <div style={styles.dropdownResults}>
                {searchResults.length > 0 ? searchResults.map((user) => (
                  <div
                    key={user._id}
                    style={styles.dropdownItem}
                    onClick={() => { setShowSearchResults(false); setSearchQuery(""); openProfileModal(user._id); }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(0,180,255,0.08)"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <img
                      src={user.profileImage || "/default-avatar.png"}
                      alt={user.name}
                      style={styles.dropdownAvatar}
                    />
                    <div>
                      <div style={{ color: "#e2f3ff", fontSize: "14px", fontWeight: 700 }}>{user.name}</div>
                      <div style={{ color: "rgba(150,200,255,0.55)", fontSize: "12px" }}>@{user.username}</div>
                    </div>
                    <span style={{ marginLeft: "auto", color: "rgba(0,180,255,0.6)", fontSize: "12px" }}>
                      {t.viewProfile || "View →"}
                    </span>
                  </div>
                )) : (
                  <div style={{ padding: "14px 18px", color: "rgba(150,200,255,0.5)", fontSize: "13px" }}>
                    {t.noUsersFound || "No users found"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Desktop nav links */}
          <div style={styles.navLinks} className="d-none d-lg-flex">
            <NavLinkItem to="/" icon={Home} onClick={handleNavItemClick}>
              {myHome || t.navHome || "Home"}
            </NavLinkItem>
            <NavLinkItem to="/activity" icon={Activity} onClick={handleNavItemClick}>
              {t.navActivity || "Activity"}
            </NavLinkItem>
            <NavLinkItem to="/profile" icon={User} onClick={handleNavItemClick}>
              {t.navProfile || "Profile"}
            </NavLinkItem>

            {/* Policies dropdown */}
            <div ref={policiesRef} style={styles.policiesDropdown}>
              <button
                style={{ ...styles.navLink, background: "none", border: "none" }}
                onClick={() => setShowPoliciesMenu(p => !p)}
              >
                <span>{t.navPolicies || "Policies"}</span>
                <ChevronDown size={13} style={{ opacity: 0.6 }} />
              </button>
              {showPoliciesMenu && (
                <div style={styles.policiesMenu}>
                  {[
                    { to: "/aboutus",         labelKey: "policyAboutUs",       fallback: "About Us" },
                    { to: "/privacypolicy",   labelKey: "policyPrivacy",       fallback: "Privacy Policy" },
                    { to: "/refcanclepolicy", labelKey: "policyRefund",        fallback: "Refund & Cancel" },
                    { to: "/contactus",       labelKey: "policyContact",       fallback: "Contact Us" },
                  ].map(item => (
                    <Link
                      key={item.to}
                      to={item.to}
                      style={styles.policiesItem}
                      onClick={() => { handleNavItemClick(); setShowPoliciesMenu(false); }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(0,180,255,0.08)"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {t[item.labelKey] || item.fallback}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right cluster */}
          <div style={styles.rightCluster}>
            {isAuthenticated && (
              <>
                {/* User greeting pill */}
                <div style={styles.greetingPill} className="d-none d-md-flex">
                  <span style={{ ...styles.greetText, fontSize: "18px" }}>
                    {isPrime && (
                      <BadgeCheck size={21} style={{ color: "#38bdf8", marginRight: "4px", verticalAlign: "middle" }} fill="currentColor" stroke="white" />
                    )}
                    {t.greeting
                      ? t.format("greeting", { name: userName.split(" ")[0] })
                      : `Hi, ${userName.split(" ")[0]}`}
                  </span>
                </div>

                {/* Subscribe button */}
                <button
                  title={t.subscribeCta || "Become a Prime Member"}
                  onClick={openSubscription}
                  className="d-none d-sm-flex"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                    borderRadius: "50px",
                    overflow: "hidden",
                    transform: subHover ? "scale(1.04)" : "scale(1)",
                    filter: subHover ? "brightness(1.12) drop-shadow(0 0 8px rgba(0,200,255,0.5))" : "drop-shadow(0 2px 6px rgba(0,0,0,0.4))",
                    transition: "transform 0.18s, filter 0.18s",
                  }}
                  onMouseEnter={() => setSubHover(true)}
                  onMouseLeave={() => setSubHover(false)}
                >
                  <img
                    src={SubscribeIcon}
                    alt={t.subscribeCta || "Subscribe – Become a Prime Member"}
                    style={{ height: "38px", width: "auto", display: "block" }}
                  />
                </button>

                {/* Bell */}
                <button
                  onClick={() => setShowNotifications(p => !p)}
                  title={t.notifications || "Notifications"}
                  style={{
                    ...styles.iconBtn,
                    ...(bellHover ? { background: "rgba(99,102,241,0.18)", color: "#a5b4fc" } : {}),
                  }}
                  onMouseEnter={() => setBellHover(true)}
                  onMouseLeave={() => setBellHover(false)}
                >
                  <Bell size={17} />
                  {notificationCount > 0 && (
                    <span style={styles.badge}>{notificationCount > 9 ? "9+" : notificationCount}</span>
                  )}
                </button>

                {/* ── Language selector ──────────────────────────────────────
                    Uses LANGUAGES from useI18n() — the full list defined in
                    i18nContext.js. Calling setLang(code) switches the language
                    everywhere in the app instantly.
                ─────────────────────────────────────────────────────────── */}
                <div ref={langRef} style={styles.langDropdown}>
                  <button
                    style={{ ...styles.iconBtn, width: "auto", padding: "0 10px", gap: "5px", fontSize: "12px", fontWeight: 700 }}
                    onClick={() => setShowLangMenu(p => !p)}
                    title={t.selectLanguage || "Language"}
                  >
                    <Globe size={14} />
                    <span className="d-none d-md-inline">{lang.toUpperCase()}</span>
                  </button>

                  {showLangMenu && (
                    <div style={styles.langMenu}>
                      {LANGUAGES.map(l => (
                        <button
                          key={l.code}
                          style={{
                            ...styles.langItem,
                            ...(lang === l.code ? { color: "#38bdf8", background: "rgba(0,180,255,0.08)" } : {}),
                          }}
                          onClick={() => handleLangChange(l.code)}
                          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,180,255,0.08)"}
                          onMouseLeave={e => e.currentTarget.style.background = lang === l.code ? "rgba(0,180,255,0.08)" : "transparent"}
                        >
                          {l.flag}&nbsp;&nbsp;{l.label}
                          {lang === l.code && (
                            <span style={{ marginLeft: "auto", fontSize: "10px", opacity: 0.6 }}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Logout */}
                <button
                  onClick={() => handleLogout(false)}
                  title={t.logout || "Logout"}
                  className="d-none d-sm-flex align-items-center"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    flexShrink: 0,
                    transform: logoutHover ? "scale(1.08)" : "scale(1)",
                    filter: logoutHover ? "brightness(1.15) drop-shadow(0 0 8px rgba(255,60,60,0.55))" : "drop-shadow(0 2px 5px rgba(0,0,0,0.5))",
                    transition: "transform 0.18s, filter 0.18s",
                  }}
                  onMouseEnter={() => setLogoutHover(true)}
                  onMouseLeave={() => setLogoutHover(false)}
                >
                  <img
                    src={LogoutIcon}
                    alt={t.logout || "Logout"}
                    style={{ width: "38px", height: "38px", display: "block" }}
                  />
                </button>
              </>
            )}

            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              style={{ ...styles.hamburger, display: "flex" }}
              className="d-lg-none"
              onClick={() => setIsCollapsed(p => !p)}
              aria-label="Toggle menu"
            >
              <span style={{ ...styles.hamburgerLine, transform: !isCollapsed ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
              <span style={{ ...styles.hamburgerLine, opacity: !isCollapsed ? 0 : 1 }} />
              <span style={{ ...styles.hamburgerLine, transform: !isCollapsed ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
            </button>
          </div>
        </div>

        {/* ── Mobile Drawer ── */}
        {!isCollapsed && (
          <div ref={navbarRef} style={styles.mobileDrawer}>
            {/* Nav links */}
            {[
              { to: "/",         icon: Home,     label: myHome || t.navHome     || "Home"     },
              { to: "/activity", icon: Activity, label: t.navActivity            || "Activity" },
              { to: "/profile",  icon: User,     label: t.navProfile             || "Profile"  },
            ].map(item => (
              <Link
                key={item.to}
                to={item.to}
                style={styles.mobileLinkItem}
                onClick={handleNavItemClick}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(0,180,255,0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <item.icon size={17} style={{ color: "#38bdf8" }} />
                {item.label}
              </Link>
            ))}

            {/* Policies sub-links */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "6px", marginTop: "2px" }}>
              <div style={{ color: "rgba(150,200,255,0.4)", fontSize: "11px", fontWeight: 700, padding: "4px 14px 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {t.navPolicies || "Policies"}
              </div>
              {[
                { to: "/aboutus",         labelKey: "policyAboutUs",  fallback: "About Us"       },
                { to: "/privacypolicy",   labelKey: "policyPrivacy",  fallback: "Privacy Policy" },
                { to: "/refcanclepolicy", labelKey: "policyRefund",   fallback: "Refund & Cancel"},
                { to: "/contactus",       labelKey: "policyContact",  fallback: "Contact Us"     },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{ ...styles.mobileLinkItem, fontSize: "13px", padding: "8px 14px", color: "rgba(180,210,255,0.65)" }}
                  onClick={handleNavItemClick}
                >
                  {t[item.labelKey] || item.fallback}
                </Link>
              ))}
            </div>

            {/* Mobile language picker */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", marginTop: "2px" }}>
              <div style={{ color: "rgba(150,200,255,0.4)", fontSize: "11px", fontWeight: 700, padding: "4px 14px 6px", letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {t.selectLanguage || "Language"}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "0 14px 6px" }}>
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { handleLangChange(l.code); handleNavItemClick(); }}
                    style={{
                      background: lang === l.code ? "rgba(0,180,255,0.15)" : "rgba(255,255,255,0.05)",
                      border: lang === l.code ? "1px solid rgba(0,180,255,0.4)" : "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "20px",
                      padding: "5px 12px",
                      color: lang === l.code ? "#38bdf8" : "rgba(200,230,255,0.7)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile auth actions */}
            {isAuthenticated && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "8px", marginTop: "2px", display: "flex", gap: "12px", alignItems: "center", justifyContent: "center" }}>
                <button
                  onClick={openSubscription}
                  title={t.subscribeCta || "Become a Prime Member"}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    transition: "transform 0.18s, filter 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.05)"; e.currentTarget.style.filter = "drop-shadow(0 0 8px rgba(0,200,255,0.5))"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "none"; }}
                >
                  <img src={SubscribeIcon} alt={t.subscribeCta || "Subscribe"} style={{ height: "42px", width: "auto", display: "block" }} />
                </button>
                <button
                  onClick={() => handleLogout(false)}
                  title={t.logout || "Logout"}
                  style={{
                    background: "none", border: "none", padding: 0, cursor: "pointer",
                    transition: "transform 0.18s, filter 0.18s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.1)"; e.currentTarget.style.filter = "drop-shadow(0 0 8px rgba(255,60,60,0.55))"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.filter = "none"; }}
                >
                  <img src={LogoutIcon} alt={t.logout || "Logout"} style={{ width: "42px", height: "42px", display: "block" }} />
                </button>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Spacer so content doesn't hide under fixed nav */}
      <div style={{ height: "62px" }} />

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
          style={{ background: "linear-gradient(135deg,#0f1e35,#0a1628)", borderBottom: "1px solid rgba(0,180,255,0.15)", color: "#e2f3ff" }}
        >
          <Modal.Title style={{ fontFamily: "'Nunito',sans-serif", fontWeight: 800 }}>
            {selectedUser?.user_id?.name || t.userProfile || "User Profile"}
          </Modal.Title>
        </Modal.Header>

        <Modal.Body style={{ background: "#0d1b2a", color: "#cce3f5" }}>
          {selectedUser ? (
            <>
              <div className="text-center" style={{ marginBottom: "20px" }}>
                <img
                  src={selectedUser.profileavatar?.URL || "/default-avatar.png"}
                  alt={selectedUser.user_id?.name}
                  className="rounded-circle mb-3"
                  style={{ width: "88px", height: "88px", objectFit: "cover", border: "3px solid rgba(0,180,255,0.4)", boxShadow: "0 0 20px rgba(0,180,255,0.2)" }}
                />
                <h5 style={{ color: "#e2f3ff", fontWeight: 800, marginBottom: "4px" }}>@{selectedUser.user_id?.username}</h5>
                <p style={{ color: "rgba(150,200,255,0.6)", fontSize: "13px", margin: 0 }}>
                  {selectedUser.currentcity || "N/A"}{selectedUser.hometown && ` · ${selectedUser.hometown}`}
                </p>
              </div>
              <div style={{ background: "rgba(0,180,255,0.05)", borderRadius: "10px", padding: "14px 16px", border: "1px solid rgba(0,180,255,0.1)" }}>
                <p style={{ margin: "0 0 8px", fontSize: "14px" }}>
                  <span style={{ color: "rgba(150,200,255,0.5)", marginRight: "8px" }}>{t.gender || "Gender"}</span>
                  <strong style={{ color: "#e2f3ff" }}>{selectedUser.sex || t.notSpecified || "Not specified"}</strong>
                </p>
                <p style={{ margin: 0, fontSize: "14px" }}>
                  <span style={{ color: "rgba(150,200,255,0.5)", marginRight: "8px" }}>{t.relationship || "Relationship"}</span>
                  <strong style={{ color: "#e2f3ff" }}>{selectedUser.relationship || t.notSpecified || "Not specified"}</strong>
                </p>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px", color: "rgba(150,200,255,0.5)" }}>
              {t.loadingProfile || "Loading profile…"}
            </div>
          )}
        </Modal.Body>

        <Modal.Footer style={{ background: "#0a1628", borderTop: "1px solid rgba(0,180,255,0.1)" }}>
          <Button variant="outline-secondary" onClick={() => setShowProfileModal(false)}>
            {t.close || "Close"}
          </Button>
          <Button
            style={{ background: "linear-gradient(135deg,#0ea5e9,#6366f1)", border: "none", fontWeight: 700, boxShadow: "0 4px 15px rgba(14,165,233,0.3)" }}
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
            {t.addFriend || "Add Friend"}
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