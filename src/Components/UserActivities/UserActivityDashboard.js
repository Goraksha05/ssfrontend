// UserActivityDashboard.jsx — Improved section router
import React from "react";
import DailyStreak from "./DailyStreak";
import UserReferrals from "./UserReferrals";
import PostRewards from "./PostRewards";

const sectionMeta = {
  streak: { label: "🔥 Daily Streak Rewards", accent: "#ff6b35" },
  referral: { label: "🤝 Referral Rewards", accent: "#10b981" },
  post: { label: "📝 Post Rewards", accent: "#f59e0b" },
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
          <div style={styles.empty}>
            Select an activity section to view details.
          </div>
        );
    }
  };

  return (
    <div style={styles.wrapper}>
      {meta && (
        <h2
          style={{
            ...styles.sectionTitle,
            borderLeft: `4px solid ${meta.accent}`,
            color: meta.accent,
          }}
        >
          {meta.label}
        </h2>
      )}
      <div style={styles.content}>{renderSection()}</div>
    </div>
  );
};

const styles = {
  wrapper: { width: "100%" },
  sectionTitle: {
    fontSize: "clamp(15px, 3vw, 18px)",
    fontWeight: 700,
    paddingLeft: 12,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  content: { width: "100%" },
  empty: {
    textAlign: "center",
    color: "#64748b",
    padding: "40px 0",
    fontSize: 15,
  },
};

export default UserActivityDashboard;