// UserReferrals.jsx — Full referral reward UI with two-tier milestone structure
//
// Referral JSON structure (plan-aware):
//   Big milestones  (3, 6, 10): groceryCoupons + shares + referralToken
//   Token milestones (11–30):   referralToken only (200/280/360 per plan)
//
// Progress bar tracks toward the next BIG milestone (3→6→10) first,
// then surfaces token milestones individually after 10.

import React, { useContext, useEffect, useState, useMemo } from "react";
import { StreakContext } from "../../Context/Activity/StreakContext";
import { useReferral } from "../../Context/Activity/ReferralContext";
import { useAuth } from "../../Context/Authorisation/AuthContext";
import usePlanSlabs from "../../hooks/usePlanSlabs";
import ShareModal from "./ShareModal";
import { toast } from "react-toastify";
import apiRequest from "../../utils/apiRequest";
import BankDetailsModal from "../Common/BankDetailsModal";
import "./Rewards.css";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

/* ── Milestone classifier ── */
const isBigMilestone   = (s) => s.groceryCoupons > 0 || s.shares > 0;
const isTokenMilestone = (s) => s.groceryCoupons === 0 && s.shares === 0 && s.referralToken > 0;

const UserReferrals = ({ onActivityRecorded }) => {
  const { user } = useAuth();
  const { activities } = useContext(StreakContext);
  const { referralCount = 0, fetchReferralData, referredUsers = [] } = useReferral();

  const { slabs: rawSlabs } = usePlanSlabs("referral");

  const sortedSlabs = useMemo(() =>
    [...rawSlabs]
      .filter(s => typeof s.referralCount === "number")
      .sort((a, b) => a.referralCount - b.referralCount),
    [rawSlabs]
  );
  const bigSlabs   = useMemo(() => sortedSlabs.filter(isBigMilestone),   [sortedSlabs]);
  const tokenSlabs = useMemo(() => sortedSlabs.filter(isTokenMilestone), [sortedSlabs]);

  const [selectedSlab,     setSelectedSlab]     = useState(null);
  const [claimedSlabs,     setClaimedSlabs]     = useState([]);
  const [loading,          setLoading]          = useState(false);
  const [showShareModal,   setShowShareModal]   = useState(false);
  const [showReferredList, setShowReferredList] = useState(false);
  const [showTokenSlabs,   setShowTokenSlabs]   = useState(false);

  const token = localStorage.getItem("token");

  const referralId = user?.referralId;
  const inviteLink = referralId
    ? `${window.location.origin}/invite/${referralId}`
    : `${window.location.origin}/invite`;

  const isUserSubscribed  = !!user?.subscription?.active;
  const activeReferrals   = referredUsers.filter(u => u.subscription?.active);
  const inactiveReferrals = referredUsers.filter(u => !u.subscription?.active);
  const activeCount       = activeReferrals.length;

  // ── Claimed slabs ─────────────────────────────────────────────────────────
  useEffect(() => {
    const fromUser = (user?.redeemedReferralSlabs ?? []).map(Number).filter(Boolean);
    const fromActivity = Array.isArray(activities)
      ? activities
          .filter(a => a?.type === "referral_reward" && a.slabAwarded != null)
          .map(a => Number(a.slabAwarded))
      : [];
    setClaimedSlabs([...new Set([...fromUser, ...fromActivity])]);
  }, [activities, user]);

  // ── Progress toward next BIG milestone ───────────────────────────────────
  const nextBig = bigSlabs.find(s => activeCount < s.referralCount);
  const prevBig = [...bigSlabs].reverse().find(s => activeCount >= s.referralCount);
  const bigProgress = nextBig
    ? Math.min(100, Math.round(((activeCount - (prevBig?.referralCount ?? 0)) / (nextBig.referralCount - (prevBig?.referralCount ?? 0))) * 100))
    : 100;

  const claimableTokens = tokenSlabs.filter(
    s => activeCount >= s.referralCount && !claimedSlabs.includes(s.referralCount)
  );

  // ── Claim handler ─────────────────────────────────────────────────────────
  const handleClaim = async (bankDetails, closeModal) => {
    setLoading(true);
    try {
      const res = await apiRequest.post(
        `${BACKEND_URL}/api/activity/referral`,
        { referralCount: selectedSlab, bankDetails },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success(res.data.message || `✅ Reward for ${selectedSlab} referrals claimed!`);
      onActivityRecorded?.();
      fetchReferralData();
      setSelectedSlab(null);
      closeModal();
    } catch (err) {
      toast.error(err?.response?.data?.message || "❌ Failed to claim reward.");
    } finally {
      setLoading(false);
    }
  };

  // ── Claim gate ────────────────────────────────────────────────────────────
  const canClaim = isUserSubscribed &&
    selectedSlab != null &&
    !claimedSlabs.includes(selectedSlab) &&
    activeCount >= selectedSlab;

  let disabledReason = "";
  if (!isUserSubscribed)                        disabledReason = "Active subscription required";
  else if (!selectedSlab)                       disabledReason = "Select a milestone first";
  else if (claimedSlabs.includes(selectedSlab)) disabledReason = "Already claimed";
  else if (activeCount < selectedSlab)          disabledReason = `Need ${selectedSlab} active referrals (you have ${activeCount})`;

  const copyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success("🔗 Referral link copied!");
  };

  return (
    <div className="rewards-container-sm">

      {/* ── Stats hero ── */}
      <div className="referral-hero-row">
        <div className="referral-hero-card">
          <span className="referral-hero-num">{referralCount}</span>
          <span className="referral-hero-label">Total Referrals</span>
        </div>
        <div className="referral-hero-card active">
          <span className="referral-hero-num">{activeCount}</span>
          <span className="referral-hero-label">Active Members</span>
        </div>
        <div className="referral-hero-card inactive">
          <span className="referral-hero-num">{inactiveReferrals.length}</span>
          <span className="referral-hero-label">Inactive</span>
        </div>
      </div>

      {/* Inactive warning */}
      {inactiveReferrals.length > 0 && (
        <div className="referral-info-box">
          ⚠️ {inactiveReferrals.length} referred member{inactiveReferrals.length !== 1 ? "s" : ""} do not have an active
          subscription. Reward eligibility is based on <strong>active referrals only</strong>.
        </div>
      )}

      {/* ── BIG milestones ── */}
      <div className="referral-section-header">🏆 Big Milestones</div>

      {nextBig && (
        <div className="rewards-progress-wrap">
          <div className="rewards-progress-row">
            <span className="rewards-progress-text">{activeCount} / {nextBig.referralCount} active referrals</span>
            <span className="rewards-progress-pct referral">{bigProgress}%</span>
          </div>
          <div className="rewards-progress-track">
            <div
              className="rewards-progress-bar referral"
              style={{ width: `${bigProgress}%` }}
            />
          </div>
          <span className="rewards-progress-hint">
            {nextBig.referralCount - activeCount} more active referral{nextBig.referralCount - activeCount !== 1 ? "s" : ""} to unlock next big reward
          </span>
        </div>
      )}

      <div className="referral-chips-row">
        {bigSlabs.map(s => {
          const isClaimed = claimedSlabs.includes(s.referralCount);
          const isActive  = activeCount >= s.referralCount;
          const stateClass = isClaimed ? "claimed" : isActive ? "active" : "locked";
          return (
            <div key={s.referralCount} className={`referral-big-chip ${stateClass}`}>
              <span>{isClaimed ? "✅" : isActive ? "🏆" : "🔒"}</span>
              <span className="referral-chip-count">{s.referralCount}</span>
              <span className="referral-chip-sub">referrals</span>
              <div className="referral-chip-rewards">
                {s.groceryCoupons > 0 && <span className="referral-reward-pill">🛒 ₹{s.groceryCoupons.toLocaleString("en-IN")}</span>}
                {s.shares         > 0 && <span className="referral-reward-pill">📈 {s.shares} shares</span>}
                {s.referralToken  > 0 && <span className="referral-reward-pill">🪙 {s.referralToken} tokens</span>}
              </div>
              {isClaimed && <span className="referral-claimed-badge">Claimed</span>}
            </div>
          );
        })}
      </div>

      {/* ── Token milestones ── */}
      {tokenSlabs.length > 0 && (
        <div>
          <button
            className="rewards-toggle-btn"
            onClick={() => setShowTokenSlabs(v => !v)}
          >
            {showTokenSlabs ? "▲ Hide" : "▼ Show"} Per-Referral Token Rewards (11–{tokenSlabs[tokenSlabs.length - 1]?.referralCount})
            {claimableTokens.length > 0 && (
              <span className="referral-claimable-badge">{claimableTokens.length} claimable</span>
            )}
          </button>

          {showTokenSlabs && (
            <div className="referral-token-grid">
              {tokenSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const isActive  = activeCount >= s.referralCount;
                const stateClass = isClaimed ? "claimed" : isActive ? "active" : "";
                return (
                  <div key={s.referralCount} className={`referral-token-chip ${stateClass}`}>
                    {isClaimed ? "✅" : isActive ? "🪙" : "🔒"}
                    <span> {s.referralCount}r</span>
                    <span style={{ opacity: 0.7, fontSize: 10 }}> +{s.referralToken}t</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Referral link ── */}
      <div className="referral-link-box">
        <code className="referral-link-code">{inviteLink}</code>
        <div className="referral-link-actions">
          <button className="referral-copy-btn"  onClick={copyLink}>📋 Copy</button>
          <button className="referral-share-btn" onClick={() => setShowShareModal(true)}>🔗 Share</button>
        </div>
      </div>

      {/* ── Referred users list ── */}
      {referredUsers.length > 0 && (
        <div>
          <button
            className="rewards-toggle-btn"
            onClick={() => setShowReferredList(v => !v)}
          >
            {showReferredList ? "▲ Hide" : "▼ Show"} referred users ({referredUsers.length})
          </button>

          {showReferredList && (
            <div className="referral-user-list">
              {referredUsers.map((u, i) => (
                <div key={u._id || i} className="referral-user-row">
                  <div className="referral-user-avatar">{(u.name || "?")[0].toUpperCase()}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="referral-user-name">{u.name || "Unknown"}</div>
                    <div className="referral-user-email">{u.email || ""}</div>
                  </div>
                  <span className={`referral-user-badge ${u.subscription?.active ? "active" : "inactive"}`}>
                    {u.subscription?.active ? "✅ Active" : "⏳ Inactive"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Claim selector ── */}
      <div className="rewards-claim-section">
        <label className="rewards-claim-label">🎁 Claim a Referral Reward:</label>
        <select
          value={selectedSlab ?? ""}
          onChange={(e) => setSelectedSlab(Number(e.target.value))}
          className="rewards-select"
        >
          <option value="">Select a milestone…</option>
          {bigSlabs.length > 0 && (
            <optgroup label="── Big Milestones (Coupons + Shares + Tokens) ──">
              {bigSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const hasEnough = activeCount >= s.referralCount;
                return (
                  <option key={s.referralCount} value={s.referralCount} disabled={!hasEnough || isClaimed}>
                    {s.referralCount} Referrals — ₹{s.groceryCoupons.toLocaleString("en-IN")} coupons, {s.shares} shares, {s.referralToken} tokens
                    {isClaimed ? " ✅ Claimed" : !hasEnough ? " 🔒 Locked" : " — Available"}
                  </option>
                );
              })}
            </optgroup>
          )}
          {tokenSlabs.length > 0 && (
            <optgroup label="── Per-Referral Token Rewards ──">
              {tokenSlabs.map(s => {
                const isClaimed = claimedSlabs.includes(s.referralCount);
                const hasEnough = activeCount >= s.referralCount;
                return (
                  <option key={s.referralCount} value={s.referralCount} disabled={!hasEnough || isClaimed}>
                    {s.referralCount} Referrals — {s.referralToken} tokens
                    {isClaimed ? " ✅ Claimed" : !hasEnough ? " 🔒 Locked" : " — Available"}
                  </option>
                );
              })}
            </optgroup>
          )}
        </select>

        {disabledReason && (
          <div className="referral-warning-banner">⚠️ {disabledReason}</div>
        )}

        <button
          type="button"
          className="rewards-claim-btn referral"
          disabled={!canClaim || loading}
          data-bs-toggle="modal"
          data-bs-target="#referralBankModal"
        >
          {loading ? "⏳ Claiming…" : "Claim Reward"}
        </button>
      </div>

      <BankDetailsModal
        modalId="referralBankModal"
        loading={loading}
        onSubmit={handleClaim}
      />

      {showShareModal && (
        <ShareModal inviteLink={inviteLink} onClose={() => setShowShareModal(false)} />
      )}
    </div>
  );
};

export default UserReferrals;