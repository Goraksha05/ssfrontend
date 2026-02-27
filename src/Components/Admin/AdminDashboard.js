// src/components/Admin/AdminDashboard.js

import React, { useState } from "react";
import AdminRewardDashboard from "./AdminRewardDashboard";
import AdminRewardUndoPanel from "./AdminRewardUndoPanel";
import ClaimDashboard from "./ClaimDashboard";
import AdminUserReport from "./UserReport";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("rewards");

  const tabStyle = (tab) =>
    `btn ${activeTab === tab ? "btn-primary" : "btn-outline-secondary"} me-2`;

  return (
    <div className="container-fluid py-4">
      <h2 className="mb-4 text-center text-warning">🎛 Admin Control Panel</h2>

      {/* Tab Navigation */}
      <div className="mb-4 d-flex flex-wrap justify-content-center gap-2">
        <button className={tabStyle("rewards")} onClick={() => setActiveTab("rewards")}>
          🎯 Reward Summary
        </button>
        <button className={tabStyle("undo")} onClick={() => setActiveTab("undo")}>
          ♻ Undo Reward
        </button>
        <button className={tabStyle("claims")} onClick={() => setActiveTab("claims")}>
          🧾 Claim Monitor
        </button>
        <button className={tabStyle("report")} onClick={() => setActiveTab("report")}>
          📥 User Report
        </button>
      </div>

      {/* Panels */}
      <div className="bg-white rounded shadow p-3">
        {activeTab === "rewards" && <AdminRewardDashboard />}
        {activeTab === "undo" && <AdminRewardUndoPanel />}
        {activeTab === "claims" && <ClaimDashboard />}
        {activeTab === "report" && <AdminUserReport />}
      </div>
    </div>
  );
};

export default AdminDashboard;
