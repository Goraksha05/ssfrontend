// PostRewards.jsx — Redesigned with KYC + subscription eligibility enforcement
import React, { useContext, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import PostContext from "../../Context/Posts/PostContext";
import usePostCount from "../../utils/PostCount";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import { useRewardEligibility } from "../../hooks/useRewardEligibility";
import { toast } from "react-toastify";
import BankDetailsModal from "../Common/BankDetailsModal";
import "./Rewards.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ── Eligibility gate card ───────────────────────────────────────────────────── */
function PostEligibilityGate({ kycGate, subscriptionGate, blockerCode }) {
  const navigate = useNavigate();

  const items = [];
  if (!kycGate.passed) {
    items.push({
      icon:     kycGate.status === "submitted" ? "⏳" : "🔒",
      label:    kycGate.status === "submitted" ? "KYC under review" : "KYC verification required",
      sub:      kycGate.message,
      ctaLabel: kycGate.status === "submitted" ? null : kycGate.ctaLabel,
      // KYC has a real route
      onCta:    () => navigate(kycGate.ctaPath),
      variant:  kycGate.status === "submitted" ? "info" : "error",
    });
  }
  if (!subscriptionGate.passed) {
    items.push({
      icon:     "💳",
      label:    subscriptionGate.label,
      sub:      subscriptionGate.message,
      ctaLabel: subscriptionGate.ctaLabel,
      // Subscription is a modal — call ctaAction, never navigate
      onCta:    () => subscriptionGate.ctaAction?.(),
      variant:  "warn",
    });
  }

  return (
    <div className="post-gate-card">
      <div className="post-gate-card__header">
        <span className="post-gate-card__lock">🔒</span>
        <div>
          <p className="post-gate-card__title">Post rewards locked</p>
          <p className="post-gate-card__sub">Complete the steps below to start claiming</p>
        </div>
      </div>
      <div className="post-gate-card__items">
        {items.map((item) => (
          <div key={item.label} className={`post-gate-item post-gate-item--${item.variant}`}>
            <span className="post-gate-item__icon">{item.icon}</span>
            <div className="post-gate-item__body">
              <p className="post-gate-item__label">{item.label}</p>
              <p className="post-gate-item__sub">{item.sub}</p>
            </div>
            {item.ctaLabel && (
              <motion.button className="post-gate-item__cta" onClick={item.onCta}>
                {item.ctaLabel} →
              </motion.button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main component ──────────────────────────────────────────────────────────── */
const PostRewards = ({ userId, onActivityRecorded }) => {
  const { user }       = useAuth();
  const { statePosts } = useContext(PostContext);

  const resolvedUserId =
    (userId?._id || userId?.id || userId)?.toString() ||
    (user?._id  || user?.id)?.toString()             ||
    null;

  const postCount = usePostCount(statePosts, resolvedUserId);

  const { slabs: rawSlabs } = usePlanSlabs("posts");
  const rewardMilestones = rawSlabs
    .map((s) => s.postsCount)
    .filter((p) => typeof p === "number")
    .sort((a, b) => a - b);

  const {
    eligible,
    checking,
    kycGate,
    subscriptionGate,
    blockerCode,
    parseClaimError,
  } = useRewardEligibility();

  const [selectedMilestone, setSelectedMilestone] = useState("");
  const [loading,           setLoading]           = useState(false);

  const allClaimed     = (user?.redeemedPostSlabs ?? []).map(String);
  const nextMilestone  = rewardMilestones.find((m) => postCount < m) ?? null;
  const prevMilestone  = [...rewardMilestones].reverse().find((m) => postCount >= m) ?? 0;
  const progress       = nextMilestone
    ? Math.min(100, Math.round(((postCount - prevMilestone) / (nextMilestone - prevMilestone)) * 100))
    : 100;

  const handleClaim = async (bankDetails, closeModal) => {
    if (!eligible) {
      toast.warn("Complete KYC and subscribe to claim rewards.");
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BACKEND_URL}/api/activity/post-reward`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ postreward: Number(selectedMilestone), bankDetails }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw Object.assign(new Error(data.message || "Claim failed"), { response: { data } });
      }
      toast.success(data.message || "🎉 Post reward claimed!");
      onActivityRecorded?.();
      setSelectedMilestone("");
      closeModal();
    } catch (err) {
      toast.error(parseClaimError(err) || "Error claiming post reward");
    } finally {
      setLoading(false);
    }
  };

  const canClaim =
    eligible &&
    !!selectedMilestone &&
    !loading &&
    postCount >= Number(selectedMilestone) &&
    !allClaimed.includes(String(selectedMilestone));

  return (
    <div className="rewards-container-sm">

      {/* ── Eligibility gate ── */}
      {!checking && !eligible && (
        <PostEligibilityGate
          kycGate={kycGate}
          subscriptionGate={subscriptionGate}
          blockerCode={blockerCode}
        />
      )}

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
            <div className="rewards-progress-bar post" style={{ width: `${progress}%` }} />
          </div>
          <span className="rewards-progress-hint">
            {nextMilestone - postCount} more post{nextMilestone - postCount !== 1 ? "s" : ""} to unlock your next reward
          </span>
        </div>
      )}

      {/* ── Milestone chips ── */}
      <div className="rewards-chips-row">
        {rewardMilestones.map((m) => {
          const isClaimed  = allClaimed.includes(String(m));
          const isActive   = postCount >= m;
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
          disabled={!eligible && !checking}
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

        {/* Eligibility-aware button */}
        {checking ? (
          <button className="rewards-claim-btn post" disabled>Checking…</button>
        ) : !eligible ? (
          <button
            type="button"
            className="rewards-claim-btn post rewards-claim-btn--locked"
            disabled
          >
            🔒 Unlock to Claim
          </button>
        ) : (
          <button
            type="button"
            className="rewards-claim-btn post"
            disabled={!canClaim}
            data-bs-toggle="modal"
            data-bs-target="#postBankModal"
          >
            {loading ? "⏳ Claiming…" : "Claim Post Reward"}
          </button>
        )}
      </div>

      {/* ── Bank Modal ── */}
      <BankDetailsModal modalId="postBankModal" loading={loading} onSubmit={handleClaim} />
    </div>
  );
};

export default PostRewards;