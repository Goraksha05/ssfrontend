import React, { useEffect, useState, useRef, useCallback } from "react";
// import { createRoot } from 'react-dom/client';
import PropTypes from "prop-types";
import { Link, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
// import axios from "axios";
import { useAuth } from "../Context/Authorisation/AuthContext";
import { useSubscription } from "../Context/Subscription/SubscriptionContext";
// import socket from "../WebSocket/WebSocketClient";
// import NotificationPopup from './Notifications/NotificationPopup';
// import { AuthProvider } from '../Context/Authorisation/AuthContext';
import i18n from '../i18n/i18n';
// import { useTranslation } from 'react-i18next';
import '@fortawesome/fontawesome-free/css/all.min.css';
import Logo from "./XLogo/logoImage";
import { BadgeCheck, Search } from 'lucide-react';
import { useFriend } from "../Context/Friend/FriendContext";
import { Modal, Button } from "react-bootstrap";
import NotificationsPanel from '../Components/NotificationsPanel'
import apiRequest from "../utils/apiRequest";
import SubscribeIcon from '../Assets/PrimeMembers.png';
import LogoutIcon from '../Assets/LogoutButton.png';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function Navbartemp({ title, myHome }) {
  const { isAuthenticated, logout } = useAuth();
  const { openSubscription } = useSubscription();
  const navigate = useNavigate();
  const [userName, setUserName] = useState("Unknown");
  const logoutTimer = useRef(null);
  const { notificationCount, setNotificationCount } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  // const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const navbarRef = useRef();
  const searchRef = useRef();
  const [currentLang, setCurrentLang] = useState(i18n.language || 'en');

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [selectedUser, setSelectedUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const { sendRequest } = useFriend();
  const { authtoken } = useAuth();

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

  const handleLogout = useCallback((auto = false) => {
    if (!auto) {
      const confirmLogout = window.confirm("Are you sure you want to log out?");
      if (!confirmLogout) return; // ❌ cancel logout
    }

    // ✅ Clear local storage
    localStorage.removeItem("token");
    localStorage.removeItem("User");

    // ✅ Call logout context
    logout();

    // ✅ Navigate to login
    navigate("/login");

    if (!auto) {
      window.location.reload();
    } else {
      console.warn("⚠ Auto-logout due to inactivity.");
    }
  }, [logout, navigate]);

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

    activityEvents.forEach(event =>
      window.addEventListener(event, handleUserActivity)
    );
    resetTimer();

    return () => {
      activityEvents.forEach(event =>
        window.removeEventListener(event, handleUserActivity)
      );
      if (logoutTimer.current) clearTimeout(logoutTimer.current);
    };
  }, [handleLogout]);


  useEffect(() => {
    i18n.changeLanguage(currentLang);
  }, [currentLang]);

  // Collapse on outside click + Escape (Navbar + Search separately)
  useEffect(() => {
    const handleClickOrEscape = (event) => {
      // Escape key closes both
      if (event.key === "Escape") {
        setIsCollapsed(true); // collapse navbar
        setShowSearchResults(false); // collapse search
        setSearchQuery(""); // optional reset
        return;
      }

      // Outside click for Navbar
      if (navbarRef.current && !navbarRef.current.contains(event.target)) {
        setIsCollapsed(true);
      }

      // Outside click for Search
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSearchResults(false);
        setSearchQuery(""); // optional reset
      }
    };

    document.addEventListener("mousedown", handleClickOrEscape);
    document.addEventListener("keydown", handleClickOrEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOrEscape);
      document.removeEventListener("keydown", handleClickOrEscape);
    };
  }, []);

  const toggleNotificationPanel = () => {
    setShowNotifications(prev => !prev);
  };
  // const openNotificationWindow = () => {
  //   const newWindow = window.open('', '', 'width=400,height=600,left=100,top=100');
  //   if (!newWindow) return;

  //   newWindow.document.write(`
  //     <html>
  //       <head>
  //         <title>Notifications</title>
  //         <style>
  //           body {
  //             font-family: sans-serif;
  //             margin: 0;
  //             padding: 1rem;
  //           }
  //         </style>
  //       </head>
  //       <body>
  //         <div id="notification-root"></div>
  //       </body>
  //     </html>
  //   `);
  //   newWindow.document.close();

  //   const interval = setInterval(() => {
  //     const container = newWindow.document.getElementById('notification-root');
  //     if (container) {
  //       clearInterval(interval);
  //       const root = createRoot(container);
  //       root.render(
  //         <AuthProvider>
  //           <NotificationPopup />
  //         </AuthProvider>
  //       );
  //     }
  //   }, 50);
  // };
  // Force navbar collapse when selecting an item
  const handleNavItemClick = () => {
    setIsCollapsed(true);
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark shadow-sm fixed-top">
        <div className="container-fluid">
          {/* Brand Logo */}
          <Link className="navbar-brand fw-bold text-light" to="/">
            <Logo />
          </Link>

          {/* Search bar */}
          <form
            ref={searchRef} // <-- attach ref
            className="d-flex position-relative my-2 my-lg-0"
            style={{ maxWidth: "320px" }}
          >
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-0 rounded-pill">
                <Search size={18} className="me-1 text-muted" />
                <input
                  type="search"
                  className="form-control form-control-sm border-0 shadow-none"
                  placeholder="Search your Friends..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                />
              </span>
            </div>

            {/* Fade dropdown */}
            <div
              className={`dropdown-results ${showSearchResults ? "show" : ""}`}
              style={{ zIndex: 2000 }}
            >
              <ul className="list-group shadow-sm rounded">
                {searchResults.length > 0 ? (
                  searchResults.map((user) => (
                    <li
                      key={user._id}
                      className="list-group-item list-group-item-action d-flex align-items-center"
                      onClick={() => {
                        setShowSearchResults(false);
                        setSearchQuery(""); // ready for next search
                        openProfileModal(user._id);
                      }}
                      style={{ cursor: "pointer" }}
                    >
                      <img
                        src={user.profileImage || "/default-avatar.png"}
                        alt={user.name}
                        className="rounded-circle me-2"
                        style={{ width: "28px", height: "28px", objectFit: "cover" }}
                      />
                      <div>
                        <div className="fw-semibold">{user.name}</div>
                        <small className="text-muted">@{user.username}</small>
                      </div>
                    </li>
                  ))
                ) : (
                  <li className="list-group-item text-muted">No users found</li>
                )}
              </ul>
            </div>
          </form>

          {/* Mobile Toggle */}
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
            aria-controls="navbarNav"
            aria-expanded="false"
            aria-label="Toggle navigation"
            onClick={() => setIsCollapsed(prev => (prev ? false : true))}
          >
            <span className="navbar-toggler-icon"></span>
          </button>

          {/* Navbar collapse */}
          <div
            className={`collapse navbar-collapse ${!isCollapsed ? "show" : ""}`}
            ref={navbarRef}
          >
            {/* Left Nav */}
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <Link className="nav-link" to="/" onClick={handleNavItemClick}>{myHome}</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/activity" onClick={handleNavItemClick}>Activity</Link>
              </li>
              <li className="nav-item">
                <Link className="nav-link" to="/profile" onClick={handleNavItemClick}>Profile</Link>
              </li>
              <li className="nav-item dropdown">
                <Link
                  className="nav-link dropdown-toggle"
                  to="#"
                  role="button"
                  data-bs-toggle="dropdown"
                >
                  Policies
                </Link>
                <ul className="dropdown-menu">
                  <li><Link className="dropdown-item" to="/aboutus" onClick={handleNavItemClick}>About Us</Link></li>
                  <li><Link className="dropdown-item" to="/privacypolicy" onClick={handleNavItemClick}>Privacy Policy</Link></li>
                  <li><Link className="dropdown-item" to="/refcanclepolicy" onClick={handleNavItemClick}>Refund Cancel Policy</Link></li>
                  <li><hr className="dropdown-divider" /></li>
                  <li><Link className="dropdown-item" to="/contactus" onClick={handleNavItemClick}>Contact Us</Link></li>
                </ul>
              </li>
            </ul>

            {/* Right Nav (Auth only) */}
            {isAuthenticated && (
              <div className="d-flex align-items-center flex-wrap gap-2 ms-lg-3">
                {/* Greeting */}
                <span className="fw-bold d-flex text-light align-items-center"
                  style={{ textShadow: "2px 1px 2px rgba(226, 57, 6, 1)" }}
                >
                  {(() => {
                    const storedUser = JSON.parse(localStorage.getItem("User") || "{}");
                    if (storedUser?.subscription?.active) {
                      return (
                        <BadgeCheck
                          size={28}
                          className="text-primary me-1"
                          fill="currentColor"
                          stroke="white"
                          title="Verified Subscription"
                          style={{ cursor: 'pointer', minWidth: '24px', minHeight: '24px' }}
                        />
                      );
                    }
                    return null;
                  })()}
                  Hi {userName}
                </span>

                {/* Logout */}
                <button
                  onClick={() => handleLogout(false)}
                  title="Logout"
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={LogoutIcon}
                    alt="Logout"
                    style={{ width: "40px", height: "40px" }}
                  />
                </button>

                <button
                  title="Become a Prime Member"
                  onClick={openSubscription}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={SubscribeIcon}
                    alt="Subscribe"
                    style={{ width: "165px", height: "auto" }}
                  />
                </button>

                {/* Notifications */}
                <button
                  onClick={toggleNotificationPanel}
                  className="btn btn-primary position-relative"
                >
                  <i className="fas fa-bell"></i>
                  {notificationCount > 0 && (
                    <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                      {notificationCount}
                    </span>
                  )}
                </button>

                {/* Language Selector */}
                <div className="dropdown">
                  <button
                    className="btn btn-secondary dropdown-toggle"
                    type="button"
                    data-bs-toggle="dropdown"
                  >
                    <i className="fas fa-globe me-1"></i> {currentLang.toUpperCase()}
                  </button>
                  <ul className="dropdown-menu dropdown-menu-end">
                    <li><button className="dropdown-item" onClick={() => setCurrentLang("en")}>🇬🇧 English</button></li>
                    <li><button className="dropdown-item" onClick={() => setCurrentLang("hi")}>🇮🇳 हिंदी</button></li>
                    <li><button className="dropdown-item" onClick={() => setCurrentLang("ta")}>🇮🇳 தமிழ்</button></li>
                    <li><button className="dropdown-item" onClick={() => setCurrentLang("bn")}>🇮🇳 বাংলা</button></li>
                    <li><button className="dropdown-item" onClick={() => setCurrentLang("mr")}>🇮🇳 मराठी</button></li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      <NotificationsPanel
        show={showNotifications}
        onClose={() => setShowNotifications(false)}
        setNotificationCount={setNotificationCount}
      />

      {/* -----------------Profile Modal JSX---------------------- */}
      <Modal show={showProfileModal} onHide={() => setShowProfileModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>{selectedUser?.user_id?.name || "User Profile"}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {selectedUser ? (
            <>
              <div className="text-center">
                <img
                  src={selectedUser.profileavatar?.URL || "/default-avatar.png"}
                  alt={selectedUser.user_id?.name}
                  className="rounded-circle mb-3"
                  style={{ width: "100px", height: "100px" }}
                />
                <h5>@{selectedUser.user_id?.username}</h5>
                <p>
                  {selectedUser.currentcity || "N/A"}{" "}
                  {selectedUser.hometown && `| ${selectedUser.hometown}`}
                </p>
              </div>

              <div className="mt-3">
                <p><strong>Gender:</strong> {selectedUser.sex || "Not specified"}</p>
                <p><strong>Material Status:</strong> {selectedUser.relationship || "Not specified"}</p>
              </div>
            </>
          ) : (
            <p>Loading...</p>
          )}
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowProfileModal(false)}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const targetId =
                selectedUser.user_id?._id || selectedUser.user_id || selectedUser._id;

              if (targetId) {
                sendRequest(targetId);
                setShowProfileModal(false);
              } else {
                console.error("❌ No valid user ID found in selectedUser:", selectedUser);
              }
            }}
          >
            Send Friend Request
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
