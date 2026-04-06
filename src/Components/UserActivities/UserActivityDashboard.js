// UserActivityDashboard.jsx — Improved section router
import React from "react";
import DailyStreak from "./DailyStreak";
import UserReferrals from "./UserReferrals";
import PostRewards from "./PostRewards";

const sectionMeta = {
  streak:   { label: "🔥 Daily Streak Rewards", accent: "#ff6b35" },
  referral: { label: "🤝 Referral Rewards",     accent: "#10b981" },
  post:     { label: "📝 Post Rewards",          accent: "#f59e0b" },
};

const UserActivityDashboard = ({
  currentUserId,
  posts = [],
  showSection,
  onActivityRecorded,
}) => {
  const meta = sectionMeta[showSection];

  const renderSection = () => {
    switch (showSection) {
      case "streak":
        return <DailyStreak onActivityRecorded={onActivityRecorded} />;
      case "referral":
        return <UserReferrals onActivityRecorded={onActivityRecorded} />;
      case "post":
        return (
          <PostRewards
            userId={currentUserId}
            onActivityRecorded={onActivityRecorded}
          />
        );
      default:
        return (
          <div className="uad-empty">
            Select an activity section to view details.
          </div>
        );
    }
  };

  return (
    <div className="uad-wrapper">
      {meta && (
        <h2
          className="uad-section-title"
          style={{ "--section-accent": meta.accent }}
        >
          {meta.label}
        </h2>
      )}
      <div className="uad-content">{renderSection()}</div>
    </div>
  );
};

export default UserActivityDashboard;