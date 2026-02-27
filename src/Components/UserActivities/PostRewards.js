// PostRewards.jsx – Improved, mobile-responsive post rewards UI
import React, { useContext, useState } from "react";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import PostContext from "../../Context/Posts/PostContext";
import usePostCount from "../../utils/PostCount";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { toast } from "react-toastify";
import BankDetailsModal from "../Common/BankDetailsModal";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PostRewards = ({ userId, onActivityRecorded, activities = [] }) => {
  const { user } = useAuth();
  const { statePosts } = useContext(PostContext);

  // ── Normalize userId ──────────────────────────────────────────────────────
  // The parent may pass the whole user object, user._id, or user.id.
  // We resolve to a plain string so usePostCount always gets what it expects.
  const resolvedUserId =
    (userId?._id || userId?.id || userId)?.toString() ||
    (user?._id || user?.id)?.toString() ||
    null;

  const postCount = usePostCount(statePosts, resolvedUserId);
  const rewardMilestones = usePlanSlabs("posts").map((s) => s.postsCount);
  const isSubscribed = user?.subscription?.active;

  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Claimed milestones ────────────────────────────────────────────────────
  // The activity route returns: { type: 'post', date, slabAwarded? }
  // RewardClaim records milestone as a number (the postsCount slab).
  // We check both shapes to be safe.
  const claimedPostRewards = activities
    .filter((a) => {
      if (!a) return false;
      // Shape from GET /api/activity/user  → type === 'post' with slabAwarded
      if (a.type === "post" && a.slabAwarded !== undefined) return true;
      // Legacy / alternative shape that stored postreward directly
      if (a.postreward !== undefined) return true;
      return false;
    })
    .map((a) => String(a.slabAwarded ?? a.postreward));

  // Also respect user.redeemedPostSlabs if available (most reliable source)
  const redeemedFromUser = (user?.redeemedPostSlabs ?? []).map(String);
  const allClaimed = [...new Set([...claimedPostRewards, ...redeemedFromUser])];

  // ── Progress bar ──────────────────────────────────────────────────────────
  const nextMilestone = rewardMilestones.find((m) => postCount < m) ?? null;
  const prevMilestone = [...rewardMilestones].reverse().find((m) => postCount >= m) ?? 0;
  const progress = nextMilestone
    ? Math.round(((postCount - prevMilestone) / (nextMilestone - prevMilestone)) * 100)
    : 100;

  // ── Claim handler ─────────────────────────────────────────────────────────
  const handleClaim = async (bankDetails, closeModal) => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/activity/post-reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          postreward: Number(selectedMilestone),
          bankDetails,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Claim failed");
      toast.success(data.message || "🎉 Post reward claimed!");
      onActivityRecorded?.();
      setSelectedMilestone("");
      closeModal();
    } catch (err) {
      toast.error(err.message || "Error claiming post reward");
    } finally {
      setLoading(false);
    }
  };

  // ── Not subscribed ────────────────────────────────────────────────────────
  if (!isSubscribed) {
    return (
      <div style={styles.lockedBox}>
        <span style={styles.lockEmoji}>🔒</span>
        <p style={styles.lockMsg}>Post Rewards are available after an active subscription.</p>
        <p style={styles.lockSub}>Subscribe to start earning rewards for your posts!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* ── Counter ── */}
      <div style={styles.heroCard}>
        <span style={styles.heroEmoji}>📝</span>
        <div>
          <div style={styles.heroCount}>{postCount}</div>
          <div style={styles.heroLabel}>Total Posts</div>
        </div>
        {nextMilestone && (
          <div style={styles.heroNext}>
            <span style={styles.nextLabel}>Next reward at</span>
            <span style={styles.nextVal}>{nextMilestone} posts</span>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {nextMilestone && (
        <div style={styles.progressWrap}>
          <div style={styles.progressRow}>
            <span style={styles.progressText}>{postCount} / {nextMilestone} posts</span>
            <span style={styles.progressPct}>{progress}%</span>
          </div>
          <div style={styles.progressTrack}>
            <div style={{ ...styles.progressBar, width: `${progress}%` }} />
          </div>
          <span style={styles.progressHint}>
            {nextMilestone - postCount} more posts to unlock your next reward
          </span>
        </div>
      )}

      {/* ── Milestone chips ── */}
      <div style={styles.chipsRow}>
        {rewardMilestones.map((m) => {
          const isClaimed = allClaimed.includes(String(m));
          const isActive = postCount >= m;
          return (
            <div
              key={m}
              style={{
                ...styles.chip,
                ...(isClaimed ? styles.chipClaimed : {}),
                ...(isActive && !isClaimed ? styles.chipActive : {}),
                ...(!isActive ? styles.chipLocked : {}),
              }}
            >
              {isClaimed ? "✅" : isActive ? "🏆" : "🔒"} {m}p
            </div>
          );
        })}
      </div>

      {/* ── Claim selector ── */}
      <div style={styles.claimSection}>
        <label style={styles.claimLabel}>🎁 Claim a post reward:</label>
        <select
          value={selectedMilestone}
          onChange={(e) => setSelectedMilestone(e.target.value)}
          style={styles.select}
        >
          <option value="">Select a milestone…</option>
          {rewardMilestones.map((m) => {
            const key = String(m);
            const isClaimed = allClaimed.includes(key);
            const isActive = postCount >= m;
            return (
              <option key={m} value={key} disabled={!isActive || isClaimed}>
                {m} Posts{" "}
                {isClaimed ? "✅ Claimed" : !isActive ? "🔒 Locked" : "— Available"}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          style={{
            ...styles.claimBtn,
            ...(!selectedMilestone || loading ? styles.claimBtnDisabled : {}),
          }}
          disabled={!selectedMilestone || loading}
          data-bs-toggle="modal"
          data-bs-target="#postBankModal"
        >
          {loading ? "⏳ Claiming…" : "Claim Post Reward"}
        </button>
      </div>

      {/* ── Bank Modal ── */}
      <BankDetailsModal
        modalId="postBankModal"
        loading={loading}
        onSubmit={handleClaim}
      />
    </div>
  );
};

// ── Styles ────────────────────────────────────────────────────────────────────
const styles = {
  container: { display: "flex", flexDirection: "column", gap: 18 },

  lockedBox: {
    display: "flex", flexDirection: "column", alignItems: "center",
    gap: 10, padding: "40px 20px", textAlign: "center",
    background: "#0f172a", borderRadius: 14,
    border: "1px dashed #334155",
  },
  lockEmoji: { fontSize: 40 },
  lockMsg: { color: "#fbbf24", fontWeight: 700, fontSize: 15, margin: 0 },
  lockSub: { color: "#64748b", fontSize: 13, margin: 0 },

  heroCard: {
    display: "flex", alignItems: "center", gap: 20,
    background: "linear-gradient(135deg, #422006, #78350f)",
    borderRadius: 14, padding: "20px 24px", flexWrap: "wrap",
  },
  heroEmoji: { fontSize: 44, lineHeight: 1 },
  heroCount: { fontSize: 48, fontWeight: 900, color: "#fbbf24", lineHeight: 1 },
  heroLabel: { color: "#fde68a", fontSize: 14, fontWeight: 600, marginTop: 2 },
  heroNext: { marginLeft: "auto", textAlign: "right" },
  nextLabel: { display: "block", color: "#94a3b8", fontSize: 12 },
  nextVal: { display: "block", color: "#f59e0b", fontWeight: 700, fontSize: 16 },

  progressWrap: { display: "flex", flexDirection: "column", gap: 6 },
  progressRow: { display: "flex", justifyContent: "space-between" },
  progressText: { color: "#94a3b8", fontSize: 13 },
  progressPct: { color: "#f59e0b", fontWeight: 700, fontSize: 13 },
  progressTrack: { height: 8, borderRadius: 99, background: "#334155", overflow: "hidden" },
  progressBar: {
    height: "100%", borderRadius: 99,
    background: "linear-gradient(90deg, #f59e0b, #fbbf24)",
    transition: "width 0.6s ease",
  },
  progressHint: { color: "#64748b", fontSize: 12 },

  chipsRow: { display: "flex", flexWrap: "wrap", gap: 8 },
  chip: {
    padding: "6px 12px", borderRadius: 99, fontSize: 12, fontWeight: 700,
    border: "1px solid #334155",
  },
  chipActive: { background: "#292524", border: "1px solid #f59e0b", color: "#f59e0b" },
  chipClaimed: { background: "#14532d", border: "1px solid #16a34a", color: "#86efac" },
  chipLocked: { background: "#1e293b", color: "#475569" },

  claimSection: { display: "flex", flexDirection: "column", gap: 10 },
  claimLabel: { color: "#94a3b8", fontWeight: 600, fontSize: 14 },
  select: {
    background: "#0f172a", border: "1px solid #334155", borderRadius: 10,
    color: "#e2e8f0", padding: "10px 14px", fontSize: 14, width: "100%",
  },
  claimBtn: {
    background: "linear-gradient(135deg, #f59e0b, #d97706)",
    border: "none", borderRadius: 10, color: "#0f172a",
    padding: "12px 0", fontWeight: 800, fontSize: 15,
    cursor: "pointer", width: "100%",
    boxShadow: "0 4px 15px rgba(245,158,11,0.4)",
  },
  claimBtnDisabled: { opacity: 0.45, cursor: "not-allowed" },
};

export default PostRewards;