import React from "react";
import { useParams } from "react-router-dom";
import AdminRewardDashboard from "./AdminRewardDashboard";
import AdminRewardUndoPanel from "./AdminRewardUndoPanel";
import ClaimDashboard from "./ClaimDashboard";

const AdminRewardsPage = () => {
  const { section = "dashboard" } = useParams();

  if (section === "undo") return <AdminRewardUndoPanel />;
  if (section === "claims") return <ClaimDashboard />;

  return <AdminRewardDashboard />;
};

export default AdminRewardsPage;
