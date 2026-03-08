// PostRewards.jsx — Accurate post rewards UI
import React, { useContext, useState } from "react";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import PostContext from "../../Context/Posts/PostContext";
import usePostCount from "../../utils/PostCount";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { toast } from "react-toastify";
import BankDetailsModal from "../Common/BankDetailsModal";
import "./Rewards.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PostRewards = ({ userId, onActivityRecorded }) => {
  const { user } = useAuth();
  const { statePosts } = useContext(PostContext);

  const resolvedUserId =
    (userId?._id || userId?.id || userId)?.toString() ||
    (user?._id || user?.id)?.toString() ||
    null;

  const postCount = usePostCount(statePosts, resolvedUserId);

  const { slabs: rawSlabs } = usePlanSlabs("posts");
  const rewardMilestones = rawSlabs
    .map((s) => s.postsCount)
    .filter((p) => typeof p === "number")
    .sort((a, b) => a - b);

  const isSubscribed = user?.subscription?.active;

  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [loading, setLoading] = useState(false);

  // ── Claimed milestones ──────────────────────────────────────────────────
  const allClaimed = (user?.redeemedPostSlabs ?? []).map(String);

  // ── Progress bar ────────────────────────────────────────────────────────
  const nextMilestone = rewardMilestones.find((m) => postCount < m) ?? null;
  const prevMilestone = [...rewardMilestones].reverse().find((m) => postCount >= m) ?? 0;
  const progress = nextMilestone
    ? Math.min(100, Math.round(((postCount - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
    : 100;

  // ── Claim handler ────────────────────────────────────────────────────────
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
      <div className="post-locked-box">
        <span className="post-locked-emoji">🔒</span>
        <p className="post-locked-msg">Post Rewards require an active subscription.</p>
        <p className="post-locked-sub">Subscribe to start earning rewards for your posts!</p>
      </div>
    );
  }

  const canClaim =
    !!selectedMilestone &&
    !loading &&
    postCount >= Number(selectedMilestone) &&
    !allClaimed.includes(String(selectedMilestone));

  return (
    <div className="rewards-container-sm">

      {/* ── Hero Counter ── */}
      <div className="post-hero-card">
        <span className="post-hero-emoji">📝</span>
        <div>
          <div className="post-hero-count">{postCount}</div>
          <div className="post-hero-label">Total Posts</div>
        </div>
        {nextMilestone && (
          <div className="post-hero-next">
            <span className="post-next-label">Next reward at</span>
            <span className="post-next-val">{nextMilestone} posts</span>
          </div>
        )}
      </div>

      {/* ── Progress bar ── */}
      {nextMilestone && (
        <div className="rewards-progress-wrap">
          <div className="rewards-progress-row">
            <span className="rewards-progress-text">{postCount} / {nextMilestone} posts</span>
            <span className="rewards-progress-pct post">{progress}%</span>
          </div>
          <div className="rewards-progress-track">
            <div
              className="rewards-progress-bar post"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="rewards-progress-hint">
            {nextMilestone - postCount} more post{nextMilestone - postCount !== 1 ? "s" : ""} to unlock your next reward
          </span>
        </div>
      )}

      {/* ── Milestone chips ── */}
      <div className="rewards-chips-row">
        {rewardMilestones.map((m) => {
          const isClaimed = allClaimed.includes(String(m));
          const isActive  = postCount >= m;
          const stateClass = isClaimed ? "claimed" : isActive ? "active-post" : "locked";
          return (
            <div key={m} className={`post-chip ${stateClass}`}>
              {isClaimed ? "✅" : isActive ? "🏆" : "🔒"} {m}p
            </div>
          );
        })}
      </div>

      {/* ── Claim selector ── */}
      <div className="rewards-claim-section">
        <label className="rewards-claim-label">🎁 Claim a post reward:</label>
        <select
          value={selectedMilestone}
          onChange={(e) => setSelectedMilestone(e.target.value)}
          className="rewards-select"
        >
          <option value="">Select a milestone…</option>
          {rewardMilestones.map((m) => {
            const key       = String(m);
            const isClaimed = allClaimed.includes(key);
            const isActive  = postCount >= m;
            return (
              <option key={m} value={key} disabled={!isActive || isClaimed}>
                {m} Posts {isClaimed ? "✅ Claimed" : !isActive ? "🔒 Locked" : "— Available"}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          className="rewards-claim-btn post"
          disabled={!canClaim}
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

export default PostRewards;