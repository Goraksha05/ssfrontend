import React, { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import AdminRewardDashboard from "./AdminRewardDashboard";
import AdminRewardUndoPanel from "./AdminRewardUndoPanel";
import ClaimDashboard from "./ClaimDashboard";
import AdminUserReport from "./UserReport";
import Logo from "../XLogo/Logo"

const AdminLayout = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(() => localStorage.getItem("adminSidebarOpen") === "true");
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("adminDarkMode") === "true");
  const [activeTab, setActiveTab] = useState("rewards");

  useEffect(() => {
    localStorage.setItem("adminSidebarOpen", sidebarOpen);
  }, [sidebarOpen]);

  useEffect(() => {
    localStorage.setItem("adminDarkMode", darkMode);
  }, [darkMode]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!user?.isAdmin) return <Navigate to="/unauthorized" replace />;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const themeClass = darkMode ? "bg-dark text-white" : "bg-light text-dark";
  const sidebarBg = darkMode ? "bg-black border-end border-secondary" : "bg-white border-end";
  const navLinkClass = (tab) =>
    `nav-link px-3 py-2 my-1 rounded ${activeTab === tab ? "fw-bold bg-primary text-white" : darkMode ? "text-white" : "text-dark"} hover-bg`;

  const renderActiveTab = () => {
    switch (activeTab) {
      case "rewards":
        return <AdminRewardDashboard />;
      case "undo":
        return <AdminRewardUndoPanel />;
      case "claims":
        return <ClaimDashboard />;
      case "users-report":
        return <AdminUserReport />;
      default:
        return <AdminRewardDashboard />;
    }
  };

  return (
    <div className={`vh-100 vw-100 overflow-hidden ${themeClass}`} style={{ display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header
        className={`d-flex justify-content-between align-items-center px-4 py-2 ${darkMode ? "bg-dark" : "bg-white"} border-bottom`}
        style={{ height: "60px", flexShrink: 0 }}
      >
        <div className="d-flex align-items-center gap-3">
          <button className="btn btn-sm btn-outline-secondary d-md-none" onClick={() => setSidebarOpen(!sidebarOpen)}>
            ☰
          </button>
          <h4 className={`brand ${darkMode ? "text-warning" : "text-dark"} mb-0`}><Logo /> Admin</h4>
        </div>
        <div className="d-flex align-items-center gap-2">
          <button className="btn btn-sm btn-outline-secondary" onClick={() => setDarkMode((prev) => !prev)}>
            {darkMode ? "☀" : "🌙"}
          </button>
          <button className="btn btn-sm btn-outline-danger" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Body */}
      <div className="d-flex flex-grow-1" style={{ height: "calc(100vh - 60px)", overflow: "hidden" }}>
        {/* Sidebar */}
        <aside
          className={`${sidebarBg} ${sidebarOpen ? "d-block" : "d-none"} d-md-block`}
          style={{
            minWidth: "250px",
            maxWidth: "250px",
            height: "100%",
            padding: "1rem",
            overflowY: "auto",
            flexShrink: 0,
          }}
        >
          <h6 className={`${darkMode ? "text-warning" : "text-dark"} mb-3 d-none d-md-block`}>Admin Navigation</h6>
          <ul className="nav flex-column">
            <li className="nav-item">
              <button className={navLinkClass("rewards")} onClick={() => setActiveTab("rewards")}>
                🎯 Reward Dashboard
              </button>
            </li>
            <li className="nav-item">
              <button className={navLinkClass("undo")} onClick={() => setActiveTab("undo")}>
                ♻ Undo Rewards
              </button>
            </li>
            <li className="nav-item">
              <button className={navLinkClass("claims")} onClick={() => setActiveTab("claims")}>
                🧾 Claim Monitor
              </button>
            </li>
            <li className="nav-item">
              <button className={navLinkClass("users-report")} onClick={() => setActiveTab("users-report")}>
                📥 Users Report
              </button>
            </li>
          </ul>

          <div className="mt-4 d-md-none">
            <button className="btn btn-sm btn-outline-secondary w-100 mb-2" onClick={() => setDarkMode((prev) => !prev)}>
              {darkMode ? "☀ Light Mode" : "🌙 Dark Mode"}
            </button>
            <button className="btn btn-sm btn-danger w-100" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={`flex-grow-1 ${darkMode ? "bg-secondary text-white" : "bg-light text-dark"}`}
          style={{ height: "100%", overflowY: "auto", padding: "1.5rem" }}
        >
          {renderActiveTab()}
        </main>
      </div>

      <style>{`
        .hover-bg:hover {
          background-color: ${darkMode ? "#333" : "#f2f2f2"};
          text-decoration: none;
        }
        button.nav-link {
          width: 100%;
          text-align: left;
          background: none;
          border: none;
        }
      `}</style>
    </div>
  );
};

export default AdminLayout;
